const Transaction = require('../models/Transaction');
const FamilyMembership = require('../models/FamilyMembership');

// GET /api/transactions — Own transactions with filters
exports.getMyTransactions = async (req, res) => {
  try {
    const { assetType, type, startDate, endDate, search, page = 1, limit = 20 } = req.query;

    const filter = { userId: req.userId };

    if (assetType) filter.assetType = assetType;
    if (type) filter.type = type;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { symbol: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await Transaction.countDocuments(filter);
    const transactions = await Transaction.find(filter)
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({
      transactions,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching transactions.', error: error.message });
  }
};

const Holding = require('../models/Holding');

// Normalize instrument identifiers so buys & sells of the SAME asset always
// group together. Case/whitespace/blank-symbol differences must NOT split them,
// otherwise a sell lands in its own group and never reduces the holding.
const cleanSymbol = (s) => String(s || '').trim().toUpperCase();
const cleanName = (n) => String(n || '').trim().replace(/\s+/g, ' ');

// A trade belongs to an instrument if EITHER its ticker symbol OR its name
// matches — this reconciles rows where the buy carries the symbol but the sell
// only has the name (or vice-versa).
const instrumentQuery = (userId, assetType, name, symbol) => {
  const sym = cleanSymbol(symbol);
  const nm = cleanName(name);
  const or = [];
  if (sym) or.push({ symbol: sym });
  if (nm) or.push({ name: nm });
  const query = { userId, assetType };
  if (or.length) query.$or = or;
  return query;
};

const recalculateHolding = async (userId, assetType, name, symbol) => {
  const query = instrumentQuery(userId, assetType, name, symbol);

  const txns = await Transaction.find(query).sort({ date: 1 });

  if (txns.length === 0) {
    await Holding.findOneAndDelete(query);
    return;
  }

  // Average-cost method: buys add quantity & cost; sells reduce quantity at the
  // running average cost. The net quantity is what remains in the portfolio.
  let totalQty = 0;
  let totalInvested = 0;
  let lastPrice = 0;

  for (const txn of txns) {
    if (txn.type === 'buy') {
      totalQty += txn.quantity;
      totalInvested += txn.totalAmount;
      lastPrice = txn.price;
    } else if (txn.type === 'sell') {
      const avgBuyPrice = totalQty > 0 ? (totalInvested / totalQty) : 0;
      totalQty -= txn.quantity;
      if (totalQty < 0) totalQty = 0;
      totalInvested = avgBuyPrice * totalQty;
    }
  }

  // Fully sold (or oversold) → the position leaves the portfolio entirely,
  // while the buy & sell rows stay in the transaction history.
  if (totalQty <= 0) {
    await Holding.findOneAndDelete(query);
    return;
  }

  const holding = await Holding.findOne(query);
  const avgBuyPrice = totalInvested / totalQty;
  if (holding) {
    holding.quantity = totalQty;
    holding.totalInvested = totalInvested;
    holding.avgBuyPrice = avgBuyPrice;
    await holding.save();
  } else {
    await Holding.create({
      userId, assetType,
      name: cleanName(name),
      symbol: cleanSymbol(symbol),
      quantity: totalQty, totalInvested, avgBuyPrice,
      currentPrice: lastPrice
    });
  }
};

// Export for use in uploadController
exports.recalculateHolding = recalculateHolding;
exports.cleanSymbol = cleanSymbol;
exports.cleanName = cleanName;

// POST /api/transactions — Add a transaction manually
exports.addTransaction = async (req, res) => {
  try {
    const { assetType, name, symbol, type, quantity, price, date, notes } = req.body;

    const qty = Number(quantity);
    const prc = Number(price);
    const total = qty * prc;
    const cleanedName = cleanName(name);
    const cleanedSymbol = cleanSymbol(symbol);

    const transaction = await Transaction.create({
      userId: req.userId,
      assetType,
      name: cleanedName,
      symbol: cleanedSymbol,
      type,
      quantity: qty,
      price: prc,
      totalAmount: total,
      date: date || new Date(),
      notes,
      source: 'manual'
    });

    await recalculateHolding(req.userId, assetType, name, symbol);

    res.status(201).json({ message: 'Transaction added and portfolio updated.', transaction });
  } catch (error) {
    res.status(500).json({ message: 'Error adding transaction.', error: error.message });
  }
};

// PUT /api/transactions/:id — Edit transaction
exports.updateTransaction = async (req, res) => {
  try {
    const txn = await Transaction.findOne({ _id: req.params.id, userId: req.userId });
    if (!txn) return res.status(404).json({ message: 'Transaction not found.' });
    
    const oldAssetType = txn.assetType;
    const oldName = txn.name;
    const oldSymbol = txn.symbol;
    
    Object.assign(txn, req.body);
    txn.name = cleanName(txn.name);
    txn.symbol = cleanSymbol(txn.symbol);
    txn.quantity = Number(req.body.quantity);
    txn.price = Number(req.body.price);
    txn.totalAmount = txn.quantity * txn.price;
    await txn.save();
    
    if (oldAssetType !== txn.assetType || oldName !== txn.name || oldSymbol !== txn.symbol) {
      await recalculateHolding(txn.userId, oldAssetType, oldName, oldSymbol);
    }
    await recalculateHolding(txn.userId, txn.assetType, txn.name, txn.symbol);
    
    res.json({ message: 'Transaction updated successfully.', transaction: txn });
  } catch (error) {
    res.status(500).json({ message: 'Error updating transaction.', error: error.message });
  }
};

// DELETE /api/transactions/:id — Delete transaction
exports.deleteTransaction = async (req, res) => {
  try {
    const txn = await Transaction.findOne({ _id: req.params.id, userId: req.userId });
    if (!txn) return res.status(404).json({ message: 'Transaction not found.' });
    
    const { userId, assetType, name, symbol } = txn;
    await Transaction.deleteOne({ _id: txn._id });
    
    await recalculateHolding(userId, assetType, name, symbol);
    
    res.json({ message: 'Transaction deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting transaction.', error: error.message });
  }
};

// DELETE /api/transactions/all — Delete all transactions and reset portfolio
exports.deleteAllTransactions = async (req, res) => {
  try {
    // Delete all transactions for this user
    await Transaction.deleteMany({ userId: req.userId });
    
    // Reset all holdings for this user
    await Holding.deleteMany({ userId: req.userId });
    
    // Reset snapshot history
    const PortfolioSnapshot = require('../models/PortfolioSnapshot');
    await PortfolioSnapshot.deleteMany({ userId: req.userId });

    res.json({ message: 'All transactions and portfolio data have been permanently deleted.' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting all transactions.', error: error.message });
  }
};
