// One-off migration: find stock holdings whose ticker symbol no longer
// resolves on Yahoo Finance (so their price can't be fetched), re-resolve the
// correct symbol by company name, and update both the Holding and its
// Transactions. Also refreshes currentPrice with the live quote.
//
// Usage:
//   From the host (Docker stack up):   node scripts/fixSymbols.js
//   Inside the server container:       docker compose exec server node scripts/fixSymbols.js
//   Add --dry to preview changes without writing.
//   Override the connection with:      --uri=mongodb://host:port/db
//
// The .env URI uses the Docker service hostname `mongodb`, which only resolves
// inside the container. When run from the host this script rewrites that host
// to `localhost` (the compose file maps 27017), so it works either way.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const mongoose = require('mongoose');
const Holding = require('../models/Holding');
const Transaction = require('../models/Transaction');
const { tryQuote, resolveStockSymbol } = require('../services/marketData');

const DRY_RUN = process.argv.includes('--dry');

const resolveMongoUri = () => {
  const arg = process.argv.find(a => a.startsWith('--uri='));
  if (arg) return arg.slice('--uri='.length);
  let uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/wealthorbit';
  // Running on the host: the Docker service hostname won't resolve here.
  if (!process.env.RUNNING_IN_DOCKER) {
    uri = uri.replace('//mongodb:', '//localhost:').replace('@mongodb:', '@localhost:');
  }
  return uri;
};

const run = async () => {
  const uri = resolveMongoUri();
  await mongoose.connect(uri);
  console.log(`Connected to MongoDB${DRY_RUN ? ' (DRY RUN — no writes)' : ''}\n`);

  const holdings = await Holding.find({ assetType: 'stock' });
  console.log(`Checking ${holdings.length} stock holdings...\n`);

  let fixed = 0;
  let okAlready = 0;
  let unresolved = 0;

  for (const h of holdings) {
    const quote = await tryQuote(h.symbol);
    if (quote) {
      okAlready++;
      continue;
    }

    // Symbol is broken — try to resolve a correct one by name.
    const resolved = await resolveStockSymbol(h.name, h.symbol);

    if (resolved.symbol && resolved.symbol !== h.symbol && resolved.price != null) {
      console.log(`FIX  ${h.name}`);
      console.log(`     ${h.symbol || '(none)'}  ->  ${resolved.symbol}   (₹${resolved.price})`);

      if (!DRY_RUN) {
        // Update transactions first so recalculateHolding keying stays consistent.
        await Transaction.updateMany(
          { userId: h.userId, name: h.name, symbol: h.symbol },
          { $set: { symbol: resolved.symbol } }
        );
        h.symbol = resolved.symbol;
        h.currentPrice = resolved.price;
        await h.save();
      }
      fixed++;
    } else {
      console.log(`SKIP ${h.name} (${h.symbol || 'no symbol'}) — could not resolve a valid ticker`);
      unresolved++;
    }
  }

  console.log(`\nDone. fixed=${fixed}, already OK=${okAlready}, unresolved=${unresolved}`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
