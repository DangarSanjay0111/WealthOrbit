const MarketPrice = require('../models/MarketPrice');

// Lazy-load yahoo-finance2 (ESM module), shared across calls.
let yahooFinance = null;
const getYahooFinance = async () => {
  if (!yahooFinance) {
    const YahooFinance = (await import('yahoo-finance2')).default;
    yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
  }
  return yahooFinance;
};

const CACHE_TTL_MS = 5 * 60 * 1000; // reuse a quote for 5 minutes

// Fetch a batch of symbols from Yahoo in a SINGLE HTTP round-trip and upsert
// them into the MarketPrice cache with one bulkWrite. Returns a
// Map<symbol, {price, previousClose, dayChange}> for whatever resolved.
// `symbolMap` is a Map<symbol, assetType>.
const fetchAndCacheBatch = async (symbolMap) => {
  const out = new Map();
  const symbols = Array.from(symbolMap.keys());
  if (symbols.length === 0) return out;

  try {
    const yf = await getYahooFinance();
    // Batched request; validateResult:false so one odd field doesn't sink the batch.
    const res = await yf.quote(symbols, {}, { validateResult: false });
    const quotes = Array.isArray(res) ? res : [res];

    const ops = [];
    quotes.forEach(quote => {
      if (!quote || quote.symbol == null || quote.regularMarketPrice == null) return;
      const symbol = quote.symbol;
      const data = {
        symbol,
        assetType: symbolMap.get(symbol) || 'stock',
        name: quote.shortName || quote.longName || symbol,
        price: quote.regularMarketPrice || 0,
        previousClose: quote.regularMarketPreviousClose || 0,
        dayChange: quote.regularMarketChange || 0,
        dayChangePercent: quote.regularMarketChangePercent || 0,
        high52w: quote.fiftyTwoWeekHigh || 0,
        low52w: quote.fiftyTwoWeekLow || 0,
        lastFetched: new Date(),
      };
      out.set(symbol, { price: data.price, previousClose: data.previousClose, dayChange: data.dayChange });
      ops.push({ updateOne: { filter: { symbol }, update: { $set: data }, upsert: true } });
    });

    if (ops.length) await MarketPrice.bulkWrite(ops, { ordered: false });
  } catch (err) {
    // Network / symbol errors: leave `out` empty; callers fall back to stale cache.
  }
  return out;
};

// Compute the combined 1-day gain for a set of holdings.
// Only stock + mutual_fund holdings carry a reliable day-change (from Yahoo);
// gold/silver/FD/other-income are ignored for the day metric.
//
// Speed strategy (stale-while-revalidate):
//   1. One batched cache read covers every symbol.
//   2. Fresh cache entries are used as-is.
//   3. Stale entries are served immediately AND refreshed in the background
//      (fire-and-forget) so the response never waits on Yahoo for them.
//   4. Only brand-new symbols with no cache at all block the response, and even
//      those go out in a single batched Yahoo call.
//
// Returns { todaysGain, todaysGainPercent, asOf, priced } where `priced` is the
// number of holdings that contributed.
async function computeTodaysGain(holdings) {
  const relevant = holdings.filter(
    h => (h.assetType === 'stock' || h.assetType === 'mutual_fund') && h.symbol && (h.quantity || 0) > 0
  );

  // Dedupe symbols so each is quoted at most once per request.
  const uniqueSymbols = new Map(); // symbol -> assetType
  relevant.forEach(h => { if (!uniqueSymbols.has(h.symbol)) uniqueSymbols.set(h.symbol, h.assetType); });

  const symbols = Array.from(uniqueSymbols.keys());
  const quotes = new Map(); // symbol -> {price, previousClose, dayChange}

  if (symbols.length > 0) {
    // 1) One batched cache read for every symbol.
    const cachedDocs = await MarketPrice.find({ symbol: { $in: symbols } }).lean();
    const cacheBy = new Map(cachedDocs.map(d => [d.symbol, d]));

    const missing = new Map(); // no cache at all -> must fetch to have any value
    const stale = new Map();   // cached but expired -> serve stale now, refresh in bg

    symbols.forEach(symbol => {
      const c = cacheBy.get(symbol);
      if (!c) { missing.set(symbol, uniqueSymbols.get(symbol)); return; }
      quotes.set(symbol, {
        price: c.price || 0,
        previousClose: c.previousClose || 0,
        dayChange: c.dayChange || 0,
      });
      const fresh = c.lastFetched && (Date.now() - new Date(c.lastFetched).getTime()) < CACHE_TTL_MS;
      if (!fresh) stale.set(symbol, uniqueSymbols.get(symbol));
    });

    // 2) Only brand-new symbols block the response (single batched Yahoo call).
    if (missing.size > 0) {
      const fetched = await fetchAndCacheBatch(missing);
      fetched.forEach((q, symbol) => quotes.set(symbol, q));
    }

    // 3) Stale-but-present symbols: refresh in the background, don't block.
    if (stale.size > 0) {
      fetchAndCacheBatch(stale).catch(() => {});
    }
  }

  let todaysGain = 0;
  let prevValue = 0;
  let priced = 0;

  relevant.forEach(h => {
    const q = quotes.get(h.symbol);
    if (!q) return;
    const qty = h.quantity || 0;
    todaysGain += qty * q.dayChange;
    prevValue += qty * q.previousClose;
    priced += 1;
  });

  const todaysGainPercent = prevValue > 0 ? (todaysGain / prevValue) * 100 : 0;

  return {
    todaysGain,
    todaysGainPercent,
    priced,
    asOf: new Date(),
  };
}

module.exports = { computeTodaysGain };
