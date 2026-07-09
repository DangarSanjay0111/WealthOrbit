const UploadHistory = require('../models/UploadHistory');
const Transaction = require('../models/Transaction');
const Holding = require('../models/Holding');
const { recalculateHolding, cleanSymbol, cleanName } = require('./transactionController');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const ExcelJS = require('exceljs');

// Lazy-load yahoo-finance2 (ESM) for post-import live price refresh.
let _yf = null;
const getYahoo = async () => {
  if (!_yf) {
    const YahooFinance = (await import('yahoo-finance2')).default;
    _yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
  }
  return _yf;
};

// Best-effort: fetch live prices for a user's stock/MF holdings and update
// currentPrice so imported positions show real Current Value immediately.
const refreshHoldingPrices = async (userId) => {
  try {
    const holdings = await Holding.find({
      userId,
      assetType: { $in: ['stock', 'mutual_fund'] },
      symbol: { $nin: [null, ''] },
    });
    if (!holdings.length) return;

    const symbols = [...new Set(holdings.map(h => h.symbol))];
    const yf = await getYahoo();
    const res = await yf.quote(symbols, {}, { validateResult: false });
    const quotes = Array.isArray(res) ? res : [res];
    const priceBy = new Map();
    quotes.forEach(q => { if (q && q.symbol && q.regularMarketPrice != null) priceBy.set(q.symbol, q.regularMarketPrice); });

    for (const h of holdings) {
      const p = priceBy.get(h.symbol);
      if (p) { h.currentPrice = p; await h.save(); } // pre-save hook recomputes currentValue/P&L
    }
  } catch {
    // Network/symbol errors: leave currentPrice as-is (buy price).
  }
};

// Convert an .xlsx/.xls workbook into plain CSV-like text the AI can read.
const extractExcelText = async (filePath) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const parts = [];
  workbook.eachSheet((sheet) => {
    const rows = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const cells = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        // cell.text gives the formatted/displayed value (handles dates, formulas, etc.)
        cells.push((cell.text ?? '').toString().replace(/\s+/g, ' ').trim());
      });
      rows.push(cells.join(','));
    });
    parts.push(`Sheet: ${sheet.name}\n${rows.join('\n')}`);
  });

  return parts.join('\n\n');
};

// Lazy-load LangChain Gemini LLM (ESM module)
let ChatGoogleGenerativeAI;

const initAI = async () => {
  if (!ChatGoogleGenerativeAI) {
    const genai = await import('@langchain/google-genai');
    ChatGoogleGenerativeAI = genai.ChatGoogleGenerativeAI;
  }
};

// POST /api/upload/demat-report
exports.uploadReport = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload a PDF or CSV file.' });
    }

    const { familyId } = req.body;
    if (!familyId) {
      return res.status(400).json({ message: 'Family ID is required.' });
    }

    // Create upload history record
    const uploadRecord = await UploadHistory.create({
      userId: req.userId,
      familyId,
      fileName: req.file.originalname,
      status: 'processing'
    });

    try {
      await initAI();

      let extractedText = '';
      const fileName = req.file.originalname.toLowerCase();
      const isPdf = req.file.mimetype === 'application/pdf' || fileName.endsWith('.pdf');
      const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls') ||
        req.file.mimetype === 'application/vnd.ms-excel' ||
        req.file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      if (isPdf) {
        const pdfBuffer = fs.readFileSync(req.file.path);
        const pdfData = await pdfParse(pdfBuffer);
        extractedText = pdfData.text;
      } else if (isExcel) {
        extractedText = await extractExcelText(req.file.path);
      } else {
        // CSV / plain text
        extractedText = fs.readFileSync(req.file.path, 'utf8');
      }

      if (!extractedText || !extractedText.trim()) {
        throw new Error('Could not read any content from the uploaded file.');
      }

      // Use Gemini to extract structured data
      const model = new ChatGoogleGenerativeAI({
        model: 'gemini-2.5-flash',
        apiKey: process.env.GEMINI_API_KEY,
        temperature: 0
      });

      const prompt = `You are a financial data extraction expert. Analyze the following Demat account statement, contract note, tradebook, or portfolio report and extract ALL investment transactions with PERFECT accuracy.

BUY vs SELL — THE MOST IMPORTANT RULE:
- Read the transaction type for EACH row and set "type" to exactly "buy" or "sell".
- A row is a SELL when it says: Sell, Sold, Sale, S, Debit (of shares), "Sell" side, delivery out, or the quantity is shown as negative. Otherwise it is a BUY (Buy, Bought, B, Credit of shares, delivery in).
- If the document is a TRANSACTION/TRADE history, output ONE record per individual trade row and preserve every buy AND every sell separately — do NOT merge them and do NOT convert sells into buys.
- Only when the document is purely a CURRENT-HOLDINGS snapshot (no trade type column at all) should you treat each holding as a single "buy".
- Every quantity, price and amount must be a positive number; encode direction only via the "type" field.

Return a JSON object with this exact structure:
{
  "transactions": [
    {
      "assetType": "stock" or "mutual_fund" or "gold" or "silver" or "fixed_deposit",
      "name": "Company/Fund Name",
      "symbol": "TICKER_SYMBOL.EXCHANGE",
      "type": "buy" or "sell",
      "quantity": number,
      "price": number (price per unit),
      "totalAmount": number (quantity * price),
      "date": "YYYY-MM-DD"
    }
  ]
}

CRITICAL RULES FOR SYMBOL:
- The "symbol" field is MANDATORY for every transaction. You MUST provide a valid stock ticker symbol.
- Append the correct Yahoo Finance exchange suffix based on the stock's exchange:
  * NSE (National Stock Exchange of India): append .NS (e.g., "RELIANCE.NS", "TCS.NS", "INFY.NS")
  * BSE (Bombay Stock Exchange): append .BO (e.g., "RELIANCE.BO", "TCS.BO")
  * NASDAQ: no suffix needed (e.g., "AAPL", "GOOGL", "MSFT")
  * NYSE: no suffix needed (e.g., "JPM", "V")
  * London Stock Exchange: append .L (e.g., "HSBA.L")
  * Other exchanges: use the appropriate Yahoo Finance suffix
- If the ISIN is given (e.g., INE002A01018), look up the corresponding ticker symbol
- If the company or fund name is given but no symbol, derive the ticker from the name (e.g., "Reliance Industries" → "RELIANCE.NS", "Parag Parikh Flexi Cap Fund" → "0P0000XVMA.BO")
- NEVER leave symbol empty or as ""
- CONSISTENCY (CRITICAL): For the SAME instrument, use the EXACT SAME "symbol" AND the EXACT SAME "name" spelling across ALL of its rows — every buy and every sell. Never spell "Reliance Industries" one way on the buy and another on the sell, and never use .NS on the buy and .BO on the sell. Pick ONE canonical ticker (prefer NSE / .NS for Indian stocks) and reuse it for that instrument everywhere. This is required so a later SELL correctly cancels an earlier BUY of the same stock.

Other rules:
- If the document only shows current holdings (not explicit buy/sell history), treat each holding as a "buy" transaction
- Extract ALL items found in the document — every trade row, buys and sells alike
- If a numeric field is not available, use 0, but never invent quantities or prices
- Parse amounts correctly (remove commas, handle lakhs/crores notation); quantity, price, totalAmount are always positive
- For date, use the actual trade/transaction date of that row; fall back to the report date only if a row has none
- Return ONLY valid JSON, no additional text

Document content:
${extractedText.substring(0, 30000)}`;

      const response = await model.invoke(prompt);
      console.log('[Upload] AI Raw Response:', response.content);
      let extractedData;

      try {
        let content = Array.isArray(response.content)
          ? response.content.map(c => (typeof c === 'string' ? c : c.text || '')).join('')
          : response.content;
        content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        // Extract the JSON object even if the model wraps it in prose
        const start = content.indexOf('{');
        const end = content.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
          content = content.slice(start, end + 1);
        }

        extractedData = JSON.parse(content);
        console.log('[Upload] Parsed Data:', JSON.stringify(extractedData, null, 2));
      } catch (parseErr) {
        console.error('[Upload] JSON Parse Failed. Raw:', response.content);
        throw new Error('AI could not extract structured data from this document. The format may not be supported.');
      }

      // Update upload record
      uploadRecord.extractedData = extractedData;
      uploadRecord.status = 'completed';
      uploadRecord.transactionsCreated = extractedData.transactions?.length || 0;
      await uploadRecord.save();

      // Clean up uploaded file
      fs.unlink(req.file.path, () => {});

      res.json({
        message: 'Report processed successfully. Review the extracted transactions.',
        uploadId: uploadRecord._id,
        extractedData
      });
    } catch (aiError) {
      console.error('[Upload] AI Error:', aiError.message);
      uploadRecord.status = 'failed';
      uploadRecord.errorMessage = aiError.message;
      await uploadRecord.save();

      fs.unlink(req.file.path, () => {});

      res.status(500).json({
        message: 'Failed to process report.',
        error: aiError.message,
        uploadId: uploadRecord._id
      });
    }
  } catch (error) {
    console.error('[Upload] General Error:', error.message);
    res.status(500).json({ message: 'Upload failed.', error: error.message });
  }
};

// POST /api/upload/:id/confirm — Confirm extracted transactions and recalculate portfolio
exports.confirmUpload = async (req, res) => {
  try {
    const upload = await UploadHistory.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!upload) {
      return res.status(404).json({ message: 'Upload not found.' });
    }

    if (upload.status !== 'completed') {
      return res.status(400).json({ message: 'Upload is not in a confirmable state.' });
    }

    const { extractedData } = upload;
    const rawTxns = Array.isArray(extractedData?.transactions) ? extractedData.transactions : [];

    // 1) Normalize every extracted row to a clean, consistent shape.
    const rows = rawTxns.map(t => {
      const qty = Number(t.quantity) || 0;
      const prc = Number(t.price) || 0;
      return {
        assetType: t.assetType || 'stock',
        name: cleanName(t.name),
        symbol: cleanSymbol(t.symbol),
        type: t.type === 'sell' ? 'sell' : 'buy',
        quantity: qty,
        price: prc,
        totalAmount: Number(t.totalAmount) || (qty * prc) || 0,
        date: t.date ? new Date(t.date) : new Date(),
      };
    }).filter(r => r.name || r.symbol); // drop empty junk rows

    // 2) Reconcile identities within the batch: if one row for an instrument has
    //    the ticker symbol and another (e.g. the matching sell) is missing it,
    //    backfill from the sibling so buys and sells net against each other.
    const symbolByName = new Map();
    const nameBySymbol = new Map();
    for (const r of rows) {
      if (r.name && r.symbol && !symbolByName.has(r.name)) symbolByName.set(r.name, r.symbol);
      if (r.symbol && r.name && !nameBySymbol.has(r.symbol)) nameBySymbol.set(r.symbol, r.name);
    }
    for (const r of rows) {
      if (!r.symbol && r.name && symbolByName.has(r.name)) r.symbol = symbolByName.get(r.name);
      if (!r.name && r.symbol && nameBySymbol.has(r.symbol)) r.name = nameBySymbol.get(r.symbol);
    }

    // 3) Create the transaction rows and collect the distinct instruments.
    let transactionsCreated = 0;
    const instruments = new Map();
    for (const r of rows) {
      await Transaction.create({
        userId: req.userId,
        assetType: r.assetType,
        name: r.name,
        symbol: r.symbol,
        type: r.type,
        quantity: r.quantity,
        price: r.price,
        totalAmount: r.totalAmount,
        date: r.date,
        source: 'ai_upload'
      });
      transactionsCreated++;

      const key = `${r.assetType}|${r.symbol || r.name}`;
      if (!instruments.has(key)) instruments.set(key, r);
    }

    // 4) Recalculate each affected instrument once — nets all buys vs sells so a
    //    fully-sold position is removed and a partially-sold one is reduced.
    for (const inst of instruments.values()) {
      await recalculateHolding(req.userId, inst.assetType, inst.name, inst.symbol);
    }

    if (transactionsCreated > 0) {
      // Pull live prices so imported holdings show real Current Value.
      await refreshHoldingPrices(req.userId);
    }

    // Positions that remain in the portfolio after netting.
    const holdingsCreated = await Holding.countDocuments({ userId: req.userId });

    res.json({
      message: 'Transactions imported and portfolio recalculated.',
      transactionsCreated,
      holdingsCreated
    });
  } catch (error) {
    res.status(500).json({ message: 'Error confirming upload.', error: error.message });
  }
};

// GET /api/upload/history
exports.getUploadHistory = async (req, res) => {
  try {
    const { familyId } = req.query;
    const filter = { userId: req.userId };
    if (familyId) filter.familyId = familyId;

    const uploads = await UploadHistory.find(filter)
      .sort({ createdAt: -1 })
      .select('-extractedData');

    res.json({ uploads });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching upload history.', error: error.message });
  }
};
