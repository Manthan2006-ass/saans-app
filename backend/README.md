# SAANS 2.0 Backend Service

Production-grade Node.js / Express backend architected with standard separation of concerns.

## 📁 Directory Structure

```
backend/
├── postman/                  # Postman collections & API specifications
│   └── collections/
│       └── saans_api_collection.json
├── public/
│   └── temp/                 # Temporary storage for uploads / processing
│       └── .gitkeep
├── src/
│   ├── constants.js          # App constants (DB_NAME, PORT, etc.)
│   ├── app.js                # Express app initialization, middlewares & route mounting
│   ├── index.js              # Server entry point: DB connection, crons & listener
│   ├── server.js             # Backward compatibility entry point
│   ├── config/               # Configuration aliases (db.js)
│   ├── controllers/          # Request handlers (station, forecast)
│   ├── db/                   # MongoDB database connection lifecycle
│   │   └── index.js
│   ├── middlewares/          # Custom express middlewares (errorHandler, etc.)
│   │   └── errorHandler.js
│   ├── models/               # Mongoose schemas & models (Station, Reading)
│   ├── routes/               # Modular Express API routers
│   ├── services/             # Domain logic (liveIngest, forecast, planner)
│   └── utils/                # Standard utilities (asyncHandler, ApiError, ApiResponse)
├── .env                      # Local environment configuration
├── .env.example              # Template environment configuration
├── .gitignore                # Git ignore rules
├── .prettierrc               # Prettier code formatting rules
├── .prettierignore           # Prettier ignore patterns
└── package.json              # Backend package manifest & scripts
```

## 🚀 Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env` and configure your credentials:
```bash
PORT=3001
MONGODB_URI=mongodb://127.0.0.1:27017/saans
OPENAQ_API_KEY=your_key_here
```

### 3. Run Development Server
```bash
npm run dev
```
Server runs at `http://localhost:3001`.
