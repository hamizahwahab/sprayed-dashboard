const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const initSqlJs = require('sql.js');

let mainWindow;
let db;
let dbPath;

// Check if running in dev mode (passed via command line)
const isDevMode = process.argv.includes('--dev');

// Custom port for dev server (default 3000)
const devPort = (() => {
  const idx = process.argv.indexOf('--port');
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return parseInt(process.argv[idx + 1], 10);
  }
  return 3000;
})();

const HTTP_PORT = parseInt(process.env.HTTP_PORT, 10) || 8002;
const API_KEY = process.env.API_KEY || 'SPRAYED-DASHBOARD-2024';

// Helper to check API key
function isValidApiKey(req) {
  if (isDevMode) return true;
  const apiKey = req.headers['x-api-key'];
  return apiKey === API_KEY;
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    fullscreen: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // In dev mode, load from localhost (default 3000, or custom --port), otherwise load static files
  if (isDevMode) {
    mainWindow.loadURL(`http://localhost:${devPort}`);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../out/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Set Content Security Policy
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const cspSources = [
      "default-src 'self'",
      `script-src 'self'${isDevMode ? " 'unsafe-inline' 'unsafe-eval'" : ''}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      `connect-src 'self'${isDevMode ? ' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:* wss://localhost:* wss://127.0.0.1:*' : ''}`,
    ].join('; ');

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [cspSources],
      },
    });
  });
}

async function initDatabase() {
  const SQL = await initSqlJs();
  dbPath = path.join(app.getPath('userData'), 'sprayed.db');

  // Load existing database or create new one
  let data = null;
  if (fs.existsSync(dbPath)) {
    data = fs.readFileSync(dbPath);
  }

  db = new SQL.Database(data);

  // P2P Metrics table: stores daily P2P sprayed data pushed via API
  // Used by Graph 1 (DAILY P2P SPRAYED). Monthly P2P is derived from this.
  db.run(`
    CREATE TABLE IF NOT EXISTS p2p_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      month TEXT NOT NULL,
      daily_value REAL NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seedling Metrics table: stores daily Seedling sprayed data pushed via API
  // Used by Graph 2 (DAILY SEEDLING SPRAYED). Monthly Seedling is derived from this.
  db.run(`
    CREATE TABLE IF NOT EXISTS seedling_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      month TEXT NOT NULL,
      daily_value REAL NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  saveDatabase();
  console.log('Database initialized at:', dbPath);
}

function saveDatabase() {
  if (db && dbPath) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

// ──────────────────────────────────────────────
//  Shared helpers
// ──────────────────────────────────────────────

const MAX_BODY_BYTES = 1024 * 16; // 16 KB max body

// Send a JSON response with status code
function jsonResponse(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// Validate a date string (must be YYYY-MM-DD format and a real date)
function isValidDate(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = new Date(str + 'T00:00:00');
  const [y, m, day] = str.split('-').map(Number);
  return !isNaN(d.getTime()) && d.getFullYear() === y && d.getMonth() + 1 === m && d.getDate() === day;
}

// Validate a numeric value (must be a finite positive number)
function isValidPositiveNumber(val) {
  if (val === undefined || val === null) return false;
  const n = parseFloat(val);
  return !isNaN(n) && isFinite(n) && n >= 0;
}

// Parse JSON body from request with size limit
function parseRequestBody(req, res) {
  return new Promise((resolve, reject) => {
    let body = '';
    let totalBytes = 0;

    req.on('data', chunk => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_BYTES) {
        jsonResponse(res, 413, { error: 'Request body too large' });
        req.destroy();
        reject(new Error('Payload too large'));
        return;
      }
      body += chunk.toString();
    });

    req.on('end', () => {
      if (!body) {
        reject(new Error('Empty body'));
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });

    req.on('error', (err) => reject(err));
  });
}

// Check for duplicate date in a given table
function dateExists(table, date) {
  const stmt = db.prepare(`SELECT COUNT(*) AS cnt FROM ${table} WHERE date = ?`);
  stmt.bind([date]);
  const row = stmt.getAsObject();
  stmt.free();
  return row.cnt > 0;
}

// ──────────────────────────────────────────────
//  Route handlers
// ──────────────────────────────────────────────

// Handle GET for a given table
function handleGetMetrics(res, table, label) {
  try {
    const results = db.exec(`SELECT * FROM ${table} ORDER BY date ASC`);
    if (results.length === 0) {
      jsonResponse(res, 200, []);
      return;
    }
    const columns = results[0].columns;
    const metrics = results[0].values.map(row => {
      const obj = {};
      columns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    });
    jsonResponse(res, 200, metrics);
  } catch (err) {
    console.error(`Error fetching ${label}:`, err);
    jsonResponse(res, 500, { error: `Failed to fetch ${label}` });
  }
}

// Handle POST for a given table and value key (e.g. "p2p_value", "seedling_value")
async function handlePostMetrics(req, res, table, valueKey, label, refreshChannel) {
  if (!isValidApiKey(req)) {
    jsonResponse(res, 401, { error: 'Unauthorized. Provide x-api-key header.' });
    return;
  }

  let parsed;
  try {
    parsed = await parseRequestBody(req, res);
  } catch (err) {
    const msg = err.message === 'Invalid JSON' ? 'Invalid JSON in request body' : 'Empty request body';
    jsonResponse(res, 400, { error: msg });
    return;
  }
  // If parseRequestBody already sent a response (413, destroyed), bail out
  if (!parsed) return;

  const { date, [valueKey]: rawValue, month: explicitMonth } = parsed;

  // ── Validate date ──
  if (!date) {
    jsonResponse(res, 400, { error: `Missing required field: date` });
    return;
  }
  if (!isValidDate(date)) {
    jsonResponse(res, 400, {
      error: `Invalid date format. Expected YYYY-MM-DD, got "${date}"`,
    });
    return;
  }

  // ── Validate value ──
  if (rawValue === undefined) {
    jsonResponse(res, 400, { error: `Missing required field: ${valueKey}` });
    return;
  }
  if (!isValidPositiveNumber(rawValue)) {
    jsonResponse(res, 400, {
      error: `Invalid ${valueKey}. Must be a non-negative number, got "${rawValue}"`,
    });
    return;
  }

  const numericValue = parseFloat(rawValue);
  const month = explicitMonth || date.substring(0, 7);

  // ── Check duplicate date ──
  if (dateExists(table, date)) {
    jsonResponse(res, 409, {
      error: `Duplicate entry for date "${date}". A record already exists in ${table}.`,
    });
    return;
  }

  // ── Insert ──
  try {
    const stmt = db.prepare(
      `INSERT INTO ${table} (date, month, daily_value) VALUES (?, ?, ?)`
    );
    stmt.run([date, month, numericValue]);
    stmt.free();
    saveDatabase();

    const lastId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];

    // Notify Electron window to refresh
    if (mainWindow && mainWindow.webContents && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(refreshChannel);
    }

    jsonResponse(res, 201, {
      success: true,
      id: lastId,
      message: `${label} saved successfully`,
    });

    console.log(`New ${label} received:`, date, numericValue);
  } catch (err) {
    console.error(`Error saving ${label}:`, err);
    jsonResponse(res, 500, { error: `Failed to save ${label}` });
  }
}

// ──────────────────────────────────────────────
//  HTTP Server
// ──────────────────────────────────────────────

function startHttpServer() {
  const server = http.createServer((req, res) => {
    const origin = req.headers.origin;
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = req.url.split('?')[0];

    // ── P2P routes ──
    if (url === '/api/p2p-metrics') {
      if (req.method === 'GET') {
        handleGetMetrics(res, 'p2p_metrics', 'P2P metrics');
        return;
      }
      if (req.method === 'POST') {
        handlePostMetrics(req, res, 'p2p_metrics', 'p2p_value', 'P2P metric', 'p2p-metrics:refresh');
        return;
      }
      jsonResponse(res, 405, { error: 'Method not allowed. Use GET or POST.' });
      return;
    }

    // ── Seedling routes ──
    if (url === '/api/seedling-metrics') {
      if (req.method === 'GET') {
        handleGetMetrics(res, 'seedling_metrics', 'Seedling metrics');
        return;
      }
      if (req.method === 'POST') {
        handlePostMetrics(req, res, 'seedling_metrics', 'seedling_value', 'Seedling metric', 'seedling-metrics:refresh');
        return;
      }
      jsonResponse(res, 405, { error: 'Method not allowed. Use GET or POST.' });
      return;
    }

    // 404 for unknown routes
    jsonResponse(res, 404, { error: 'Not found' });
  });

  server.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`HTTP Server running on http://0.0.0.0:${HTTP_PORT}`);
    console.log(`POST P2P data to: http://YOUR_IP:${HTTP_PORT}/api/p2p-metrics`);
    console.log(`POST Seedling data to: http://YOUR_IP:${HTTP_PORT}/api/seedling-metrics`);
  });

  server.on('error', (err) => {
    console.error('HTTP Server error:', err);
  });
}

function setupIPC() {
  ipcMain.handle('db:getP2PMetrics', () => {
    const results = db.exec('SELECT * FROM p2p_metrics ORDER BY date ASC');
    if (results.length === 0) return [];

    const columns = results[0].columns;
    return results[0].values.map(row => {
      const obj = {};
      columns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    });
  });

  ipcMain.handle('db:getSeedlingMetrics', () => {
    const results = db.exec('SELECT * FROM seedling_metrics ORDER BY date ASC');
    if (results.length === 0) return [];

    const columns = results[0].columns;
    return results[0].values.map(row => {
      const obj = {};
      columns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    });
  });

  ipcMain.handle('server:getInfo', () => {
    return {
      port: HTTP_PORT,
      ip: '0.0.0.0'
    };
  });
}

app.whenReady().then(async () => {
  await initDatabase();
  setupIPC();
  startHttpServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  saveDatabase();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
