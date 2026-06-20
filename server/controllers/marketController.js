const MarketPrice = require('../models/MarketPrice');
const Holding = require('../models/Holding');

// Lazy-load yahoo-finance2 (ESM module)

let yahooFinance = null;

const getYahooFinance = async () => {
  if (!yahooFinance) {
    const YahooFinance = (await import("yahoo-finance2")).default;

    yahooFinance = new YahooFinance();
  }

  return yahooFinance;
};
// GET /api/market/stock/:symbol
exports.getStockPrice = async (req, res) => {
  try {
    let { symbol } = req.params;

    // Add .NS suffix for NSE if not present
    if (!symbol.includes('.')) {
      symbol = `${symbol}.NS`;
    }

    // Check cache (5 min TTL)
    const cached = await MarketPrice.findOne({ symbol });
    if (cached && (Date.now() - cached.lastFetched.getTime()) < 5 * 60 * 1000) {
      return res.json(cached);
    }

    const yf = await getYahooFinance();
    const quote = await yf.quote(symbol);

    const priceData = {
      symbol,
      assetType: 'stock',
      name: quote.shortName || quote.longName || symbol,
      price: quote.regularMarketPrice || 0,
      previousClose: quote.regularMarketPreviousClose || 0,
      dayChange: quote.regularMarketChange || 0,
      dayChangePercent: quote.regularMarketChangePercent || 0,
      high52w: quote.fiftyTwoWeekHigh || 0,
      low52w: quote.fiftyTwoWeekLow || 0,
      lastFetched: new Date()
    };

    await MarketPrice.findOneAndUpdate(
      { symbol },
      priceData,
      { upsert: true, new: true }
    );

    res.json(priceData);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching stock price.', error: error.message });
  }
};

// GET /api/market/mf/:schemeCode
exports.getMutualFundNAV = async (req, res) => {
  try {
    const { schemeCode } = req.params;
    const symbol = `MF_${schemeCode}`;

    // Check cache (30 min TTL for MF)
    const cached = await MarketPrice.findOne({ symbol });
    if (cached && (Date.now() - cached.lastFetched.getTime()) < 30 * 60 * 1000) {
      return res.json(cached);
    }

    const response = await fetch(`https://api.mfapi.in/mf/${schemeCode}/latest`);
    const data = await response.json();

    if (!data || !data.data || data.data.length === 0) {
      return res.status(404).json({ message: 'Mutual fund not found.' });
    }

    const latest = data.data[0];
    const priceData = {
      symbol,
      assetType: 'mutual_fund',
      name: data.meta?.scheme_name || schemeCode,
      price: parseFloat(latest.nav) || 0,
      lastFetched: new Date()
    };

    await MarketPrice.findOneAndUpdate(
      { symbol },
      priceData,
      { upsert: true, new: true }
    );

    res.json(priceData);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching MF NAV.', error: error.message });
  }
};

// GET /api/market/gold
exports.getGoldPrice = async (req, res) => {
  try {
    const symbol = 'GOLD_INR';

    // Check cache (15 min TTL)
    const cached = await MarketPrice.findOne({ symbol });
    if (cached && (Date.now() - cached.lastFetched.getTime()) < 15 * 60 * 1000) {
      return res.json(cached);
    }

    const yf = await getYahooFinance();
    let pricePerGram = 0;

    try {
      // GC=F = COMEX Gold futures (USD per troy ounce)
      // USDINR=X = USD to INR exchange rate
      const [goldQuote, usdInrQuote] = await Promise.all([
        yf.quote('GC=F'),
        yf.quote('USDINR=X')
      ]);

      const goldUsdPerOz = goldQuote.regularMarketPrice || 0;
      const usdToInr = usdInrQuote.regularMarketPrice || 85;
      // 1 troy ounce = 31.1035 grams
      pricePerGram = Math.round((goldUsdPerOz * usdToInr) / 31.1035);
    } catch (e) {
      console.error('Gold price fetch error:', e.message);
      pricePerGram = cached?.price || 7500;
    }

    const priceData = {
      symbol,
      assetType: 'gold',
      name: 'Gold (per gram)',
      price: pricePerGram,
      lastFetched: new Date()
    };

    await MarketPrice.findOneAndUpdate(
      { symbol },
      priceData,
      { upsert: true, new: true }
    );

    res.json(priceData);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching gold price.', error: error.message });
  }
};

// GET /api/market/silver
exports.getSilverPrice = async (req, res) => {
  try {
    const symbol = 'SILVER_INR';

    const cached = await MarketPrice.findOne({ symbol });
    if (cached && (Date.now() - cached.lastFetched.getTime()) < 15 * 60 * 1000) {
      return res.json(cached);
    }

    const yf = await getYahooFinance();
    let pricePerGram = 0;

    try {
      // SI=F = COMEX Silver futures (USD per troy ounce)
      const [silverQuote, usdInrQuote] = await Promise.all([
        yf.quote('SI=F'),
        yf.quote('USDINR=X')
      ]);

      const silverUsdPerOz = silverQuote.regularMarketPrice || 0;
      const usdToInr = usdInrQuote.regularMarketPrice || 85;
      // 1 troy ounce = 31.1035 grams
      pricePerGram = Math.round((silverUsdPerOz * usdToInr) / 31.1035);
    } catch (e) {
      console.error('Silver price fetch error:', e.message);
      pricePerGram = cached?.price || 90;
    }

    const priceData = {
      symbol,
      assetType: 'silver',
      name: 'Silver (per gram)',
      price: pricePerGram,
      lastFetched: new Date()
    };

    await MarketPrice.findOneAndUpdate(
      { symbol },
      priceData,
      { upsert: true, new: true }
    );

    res.json(priceData);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching silver price.', error: error.message });
  }
};

// POST /api/market/refresh — Refresh all portfolio prices
exports.refreshPrices = async (req, res) => {
  try {
    const holdings = await Holding.find({
      userId: req.userId,
      assetType: { $in: ['stock', 'mutual_fund', 'gold', 'silver'] }
    });

    let updated = 0;
    const yf = await getYahooFinance();

    // Cache to avoid fetching gold/silver multiple times in one loop
    let goldPricePerGram = null;
    let silverPricePerGram = null;

    for (const holding of holdings) {
      try {
        if ((holding.assetType === 'stock' || holding.assetType === 'mutual_fund') && holding.symbol) {
          const quote = await yf.quote(holding.symbol);
          holding.currentPrice = quote.regularMarketPrice || holding.currentPrice;
          await holding.save();
          updated++;
        } else if (holding.assetType === 'gold') {
          if (!goldPricePerGram) {
            const [goldQuote, usdInrQuote] = await Promise.all([
              yf.quote('GC=F'), yf.quote('USDINR=X')
            ]);
            goldPricePerGram = Math.round(((goldQuote.regularMarketPrice || 0) * (usdInrQuote.regularMarketPrice || 85)) / 31.1035);
          }
          if (goldPricePerGram > 0) {
            holding.currentPrice = goldPricePerGram;
            await holding.save();
            updated++;
          }
        } else if (holding.assetType === 'silver') {
          if (!silverPricePerGram) {
            const [silverQuote, usdInrQuote] = await Promise.all([
              yf.quote('SI=F'), yf.quote('USDINR=X')
            ]);
            silverPricePerGram = Math.round(((silverQuote.regularMarketPrice || 0) * (usdInrQuote.regularMarketPrice || 85)) / 31.1035);
          }
          if (silverPricePerGram > 0) {
            holding.currentPrice = silverPricePerGram;
            await holding.save();
            updated++;
          }
        }
      } catch (e) {
        console.error(`Failed to update ${holding.name}:`, e.message);
      }
    }

    res.json({ message: `Refreshed ${updated} holdings.`, updated });
  } catch (error) {
    res.status(500).json({ message: 'Error refreshing prices.', error: error.message });
  }
};

// GET /api/market/search?q=...
exports.searchMarket = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.json({ results: [] });
    }

    const yf = await getYahooFinance();

    const results = await yf.search(q, {
      quotesCount: 10,
      newsCount: 0
    });

    // console.log(JSON.stringify(results, null, 2));
    const filtered = (results.quotes || [])
      .filter(r => r.symbol) // Filter out news articles or weird empty objects
      .slice(0, 10)
      .map(r => ({
        symbol: r.symbol,
        name: r.shortname || r.longname || r.symbol || r.name,
        exchange: r.exchange,
        type: r.quoteType
      }));

      // Intentionally suppressed for prod
    res.json({ results: filtered });

  } catch (error) {
    res.status(500).json({
      message: "Search failed"
    });
  }
};