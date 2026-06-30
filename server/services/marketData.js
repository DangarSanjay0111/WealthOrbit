// Shared Yahoo Finance access + ticker symbol resolution.
// yahoo-finance2 is an ESM module, so it is lazy-loaded on first use.

let yahooFinance = null;

const getYahooFinance = async () => {
  if (!yahooFinance) {
    const YahooFinance = (await import('yahoo-finance2')).default;
    yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
  }
  return yahooFinance;
};

// Returns a live quote for `symbol`, or null if the symbol is invalid /
// unavailable. yf.quote() can either throw or resolve to undefined for an
// unknown ticker, so both cases are normalised to null here.
const tryQuote = async (symbol) => {
  if (!symbol) return null;
  try {
    const yf = await getYahooFinance();
    const quote = await yf.quote(symbol);
    if (quote && typeof quote.regularMarketPrice === 'number') {
      return quote;
    }
    return null;
  } catch (e) {
    return null;
  }
};

// Resolve a usable Yahoo Finance ticker for a stock.
//
// The AI extractor guesses ticker symbols from company names, which is often
// wrong for recently-listed / less-common stocks. This validates the guess
// against Yahoo Finance and, when it is invalid, searches by company name and
// picks the best Indian listing (preferring NSE `.NS`, then BSE `.BO`).
//
// Returns { symbol, price, name } where `symbol` is the resolved ticker (falls
// back to the original candidate if nothing better is found) and `price`/`name`
// come from the live quote when available.
const resolveStockSymbol = async (name, candidate) => {
  // 1. Trust the candidate if it already resolves to a live price.
  const direct = await tryQuote(candidate);
  if (direct) {
    return { symbol: candidate, price: direct.regularMarketPrice, name: direct.shortName || direct.longName || name };
  }

  // 2. Otherwise search by company name and pick the best match.
  if (name) {
    try {
      const yf = await getYahooFinance();
      const results = await yf.search(name, { quotesCount: 10, newsCount: 0 });
      const equities = (results.quotes || []).filter(q => q.symbol && (q.quoteType === 'EQUITY' || !q.quoteType));

      // Prefer NSE, then BSE, then anything else that returns a price.
      const ranked = [
        ...equities.filter(q => q.symbol.endsWith('.NS')),
        ...equities.filter(q => q.symbol.endsWith('.BO')),
        ...equities.filter(q => !q.symbol.endsWith('.NS') && !q.symbol.endsWith('.BO')),
      ];

      for (const q of ranked) {
        const quote = await tryQuote(q.symbol);
        if (quote) {
          return { symbol: q.symbol, price: quote.regularMarketPrice, name: quote.shortName || quote.longName || name };
        }
      }
    } catch (e) {
      // fall through to returning the candidate unchanged
    }
  }

  // 3. Nothing resolved — return the candidate as-is so behaviour is unchanged.
  return { symbol: candidate || '', price: null, name };
};

module.exports = { getYahooFinance, tryQuote, resolveStockSymbol };
