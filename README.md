# 🪐 WealthOrbit — Family Wealth Management System

A full-stack web platform to monitor and manage your family's complete financial wealth from a single dashboard. Track stocks, mutual funds, gold, silver, fixed deposits, and other income across multiple families.

## ✨ Features

- **Multi-Family Support** — One user can belong to multiple families with different roles
- **Role-Based Access** — Family heads see all members' data; members see only their own
- **Portfolio Tracking** — Stocks, Mutual Funds, Gold, Silver, FDs, Other Income
- **Live Market Data** — Auto-updated stock prices (NSE/BSE), MF NAV, gold & silver rates
- **AI Report Processing** — Upload Demat PDFs, Gemini AI extracts holdings automatically
- **Analytics Dashboard** — Line charts, pie charts, bar charts, P&L tracking
- **Transaction History** — Filterable buy/sell records with search
- **Report Generation** — Individual & family reports with CSV export
- **Dark/Light Theme** — Premium glassmorphism UI with theme persistence
- **Responsive Design** — Works on desktop, tablet, and mobile

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, React Router, Recharts, Lucide Icons |
| Backend | Node.js, Express.js |
| Database | MongoDB Atlas (Mongoose) |
| AI | LangChain.js + Google Gemini |
| Market Data | yahoo-finance2, MFAPI.in, Metals.dev |
| Auth | JWT (access + refresh tokens) |
| Styling | Vanilla CSS with CSS custom properties |

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB Atlas account (free tier works)
- Google Gemini API key (for AI features)

### 1. Clone & Install
```bash
git clone <repo-url>
cd WealthOrbit
npm run install-all
```

### 2. Configure Environment
Copy `.env.example` to `.env` and fill in:
```bash
cp .env.example .env
```
- **MONGODB_URI** — Your MongoDB Atlas connection string
- **GEMINI_API_KEY** — Your Google Gemini API key
- **JWT_SECRET** — Any secure random string
- **JWT_REFRESH_SECRET** — Any secure random string (different from above)

### 3. Run Development
```bash
npm run dev
```
This starts both:
- **Backend** → http://localhost:5000
- **Frontend** → http://localhost:5173

## 📁 Project Structure

```
WealthOrbit/
├── client/                 # React frontend (Vite)
│   └── src/
│       ├── components/     # Layout, common UI components
│       ├── context/        # Auth, Theme, Family, Toast
│       ├── pages/          # Dashboard, Portfolio, Transactions, etc.
│       ├── services/       # API client (axios)
│       └── utils/          # Formatters, helpers
├── server/                 # Express backend
│   ├── config/             # MongoDB connection
│   ├── controllers/        # Route handlers
│   ├── middleware/          # Auth, family access, upload
│   ├── models/             # Mongoose schemas
│   └── routes/             # API routes
├── .env.example            # Environment template
└── package.json            # Root scripts
```

## 🔐 User Roles

| Role | Permissions |
|------|-------------|
| **Head** | View all family members' portfolios, manage members, promote/demote roles, generate family reports |
| **Member** | View own portfolio only, personal reports, upload reports |

- A user can belong to **multiple families** with different roles in each
- The family creator is automatically the first **head**
- Heads can promote other members to head

## 📊 API Endpoints

| Module | Endpoints |
|--------|-----------|
| Auth | `POST /api/auth/register, login, refresh` `GET /api/auth/me` |
| Users | `GET/PUT /api/users/profile, password, theme` |
| Families | `POST/GET /api/families` `POST/DELETE /api/families/:id/members` |
| Portfolio | `GET /api/portfolio` `POST/PUT/DELETE /api/portfolio/holdings` |
| Transactions | `GET/POST /api/transactions` |
| Market | `GET /api/market/stock/:symbol, mf/:code, gold, silver` |
| Upload | `POST /api/upload/demat-report` `POST /api/upload/:id/confirm` |
| Reports | `GET /api/reports/individual, family/:id` |