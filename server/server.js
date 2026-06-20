const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const connectDB = require('./config/db');
const { initCronJobs } = require('./cron/snapshotJob');

// Load env vars
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Initialize background jobs
initCronJobs();

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/families', require('./routes/families'));
app.use('/api/portfolio', require('./routes/portfolio'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/market', require('./routes/market'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/reports', require('./routes/reports'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err);

  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ message: 'Validation error.', errors: messages });
  }

  if (err.code === 11000) {
    return res.status(400).json({ message: 'Duplicate entry found.' });
  }

  if (err.message && err.message.includes('Only PDF')) {
    return res.status(400).json({ message: err.message });
  }

  res.status(500).json({ message: 'Internal server error.' });
});

// Start server
const PORT = process.env.PORT || 5000;
const cron = require('node-cron');
const Holding = require('./models/Holding');

const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`\n🚀 WealthOrbit Server running on port ${PORT}`);
    console.log(`📊 API: http://localhost:${PORT}/api`);
    console.log(`💚 Health: http://localhost:${PORT}/api/health\n`);
  });

  // Schedule auto-refresh of market prices every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    console.log('[CRON] Starting 6-hour market price refresh...');
    try {
      const holdings = await Holding.find({
        assetType: { $in: ['stock', 'mutual_fund'] }
      });

      let yahooFinance = null;
      const getYahooFinance = async () => {
        if (!yahooFinance) {
          yahooFinance = (await import('yahoo-finance2')).default;
        }
        return yahooFinance;
      };

      const yf = await getYahooFinance();
      let updated = 0;

      for (const holding of holdings) {
        try {
          if ((holding.assetType === 'stock' || holding.assetType === 'mutual_fund') && holding.symbol) {
            const quote = await yf.quote(holding.symbol);
            if (quote.regularMarketPrice) {
              holding.currentPrice = quote.regularMarketPrice;
              await holding.save();
              updated++;
            }
          }
        } catch (err) {
          // ignore individual failures
        }
      }
      console.log(`[CRON] Refreshed ${updated} holdings.`);
    } catch (err) {
      console.error('[CRON] Auto-refresh failed:', err.message);
    }
  });
};

startServer();
