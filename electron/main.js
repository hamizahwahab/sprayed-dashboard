require('dotenv').config();

const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const initSqlJs = require('sql.js');
const { GET_P2P_METRICS, GET_SEEDLING_METRICS, REFRESH_P2P, REFRESH_SEEDLING } = require('./ipc-channels');

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

// Helper to check API key (timing-safe comparison)
function isValidApiKey(req) {
  if (isDevMode) return true;
  const apiKey = req.headers['x-api-key'];
  if (typeof apiKey !== 'string') return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(apiKey), Buffer.from(API_KEY));
  } catch {
    return false;
  }
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
  const SQL = await initSqlJs({
    // In development, WASM is in node_modules; in production, it's in extraResources
    locateFile: (file) => app.isPackaged
      ? path.join(process.resourcesPath, file)
      : path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file),
  });
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

  // UNIQUE indexes on date — required for INSERT OR IGNORE to reject duplicates
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_p2p_date ON p2p_metrics(date)`);
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_seedling_date ON seedling_metrics(date)`);

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

// Whitelist of allowed table names — prevents SQL injection via table variable
const ALLOWED_TABLES = new Set(['p2p_metrics', 'seedling_metrics']);

// Safe db.exec() wrapper that validates table names against whitelist
function execSQL(sql, table) {
  if (!ALLOWED_TABLES.has(table)) {
    throw new Error(
      `Invalid table: "${table}". Allowed: ${[...ALLOWED_TABLES].join(', ')}`
    );
  }
  return db.exec(sql);
}

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

// Convert sql.js exec() result to an array of column-keyed objects
function rowsToObjects(results) {
  if (results.length === 0 || results[0].values.length === 0) return [];
  const columns = results[0].columns;
  return results[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => obj[col] = row[i]);
    return obj;
  });
}

// ──────────────────────────────────────────────
//  Route handlers
// ──────────────────────────────────────────────

// Handle GET for a given table
function handleGetMetrics(res, table, label) {
  try {
    const results = execSQL(`SELECT * FROM ${table} ORDER BY date ASC`, table);
    const metrics = rowsToObjects(results);
    jsonResponse(res, 200, metrics);
  } catch (err) {
    console.error(`Error fetching ${label}:`, err);
    jsonResponse(res, 500, { error: `Failed to fetch ${label}` });
  }
}

// ── Delete sub-handlers ──

// Truncate entire table (with confirm=yes safety check)
async function handleDeleteTruncate(req, res, table, label, refreshChannel) {
  const confirm = new URL(req.url, `http://${req.headers.host || 'localhost'}`).searchParams.get('confirm');
  if (confirm !== 'yes') {
    jsonResponse(res, 400, {
      error: 'Missing or invalid confirm parameter. Use ?truncate=true&confirm=yes to proceed.',
    });
    return;
  }

  try {
    execSQL(`DELETE FROM ${table}`, table);
    execSQL(`DELETE FROM sqlite_sequence WHERE name = '${table}'`, table);
    saveDatabase();

    if (refreshChannel && mainWindow) {
      mainWindow.webContents.send(refreshChannel);
    }

    jsonResponse(res, 200, {
      success: true,
      message: `Truncated ${label} — all records deleted`,
    });
  } catch (err) {
    console.error(`Error truncating ${label}:`, err);
    jsonResponse(res, 500, { error: `Failed to truncate ${label}` });
  }
}

// Delete a record by id
async function handleDeleteById(res, table, label, refreshChannel, id) {
  try {
    // Check if record exists first
    const checkResult = execSQL(`SELECT id FROM ${table} WHERE id = ${id}`, table);
    if (checkResult.length === 0 || checkResult[0].values.length === 0) {
      jsonResponse(res, 404, { error: `No record found in ${table} with id ${id}` });
      return;
    }

    execSQL(`DELETE FROM ${table} WHERE id = ${id}`, table);
    saveDatabase();

    if (refreshChannel && mainWindow) {
      mainWindow.webContents.send(refreshChannel);
    }

    jsonResponse(res, 200, {
      success: true,
      message: `Deleted record from ${label} with id ${id}`,
    });
  } catch (err) {
    console.error(`Error deleting ${label}:`, err);
    jsonResponse(res, 500, { error: `Failed to delete ${label}` });
  }
}

// Delete a record by date
async function handleDeleteByDate(res, table, label, refreshChannel, date) {
  try {
    // Check if record exists first
    const checkResult = execSQL(`SELECT id FROM ${table} WHERE date = '${date}'`, table);
    if (checkResult.length === 0 || checkResult[0].values.length === 0) {
      jsonResponse(res, 404, { error: `No record found in ${table} for date "${date}"` });
      return;
    }

    execSQL(`DELETE FROM ${table} WHERE date = '${date}'`, table);
    saveDatabase();

    if (refreshChannel && mainWindow) {
      mainWindow.webContents.send(refreshChannel);
    }

    jsonResponse(res, 200, {
      success: true,
      message: `Deleted record from ${label} for date "${date}"`,
    });
  } catch (err) {
    console.error(`Error deleting ${label}:`, err);
    jsonResponse(res, 500, { error: `Failed to delete ${label}` });
  }
}

// Handle DELETE for a given table by date or id
function isValidPositiveInt(val) {
  if (val === undefined || val === null || val === '') return false;
  const n = Number(val);
  return Number.isInteger(n) && n > 0;
}

async function handleDeleteMetrics(req, res, table, label, refreshChannel) {
  if (!isValidApiKey(req)) {
    jsonResponse(res, 401, { error: 'Unauthorized. Provide x-api-key header.' });
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const truncate = parsedUrl.searchParams.get('truncate');
  const idRaw = parsedUrl.searchParams.get('id');
  const date = parsedUrl.searchParams.get('date');

  // Truncate (delete all rows) — highest priority
  if (truncate === 'true' || truncate === '1') {
    await handleDeleteTruncate(req, res, table, label, refreshChannel);
    return;
  }

  // id takes priority if both are provided
  if (idRaw) {
    if (!isValidPositiveInt(idRaw)) {
      jsonResponse(res, 400, { error: `Invalid id. Must be a positive integer, got "${idRaw}"` });
      return;
    }
    await handleDeleteById(res, table, label, refreshChannel, parseInt(idRaw, 10));
    return;
  }

  if (date) {
    if (!isValidDate(date)) {
      jsonResponse(res, 400, { error: `Invalid date format. Expected YYYY-MM-DD, got "${date}"` });
      return;
    }
    await handleDeleteByDate(res, table, label, refreshChannel, date);
    return;
  }

  jsonResponse(res, 400, {
    error: 'Missing query parameter. Provide ?date=YYYY-MM-DD, ?id=<number>, or ?truncate=true&confirm=yes',
  });
}

async function handlePostMetrics(req, res, table, valueKey, label, refreshChannel) {
  if (!isValidApiKey(req)) {
    jsonResponse(res, 401, { error: 'Unauthorized. Provide x-api-key header.' });
    return;
  }

  let parsed;
  try {
    parsed = await parseRequestBody(req, res);
  } catch (err) {
    if (err.message === 'Payload too large') {
      jsonResponse(res, 413, { error: 'Request body too large' });
      return;
    }
    const msg = err.message === 'Invalid JSON' ? 'Invalid JSON in request body' : 'Empty request body';
    jsonResponse(res, 400, { error: msg });
    return;
  }

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

  // ── Insert with duplicate handling (INSERT OR IGNORE) ──
  try {
    // Use db.run() + getRowsModified() — db.exec() returns [] for INSERT,
    // so rowsAffected is always 0. Inputs are validated so SQL injection
    // is not a concern (date checked by isValidDate, month derived from date,
    // numericValue checked by isValidPositiveNumber).
    const insertSql = `INSERT OR IGNORE INTO ${table} (date, month, daily_value) VALUES ('${date}', '${month}', ${numericValue})`;
    db.run(insertSql);

    // getRowsModified() returns 1 if inserted, 0 if ignored (duplicate date)
    if (db.getRowsModified() === 0) {
      jsonResponse(res, 409, {
        error: `Duplicate entry for date "${date}". A record already exists in ${table}.`,
      });
      return;
    }

    saveDatabase();

    // Use MAX(id) instead of last_insert_rowid() — MAX is more reliable across sql.js versions
    const idResult = execSQL(`SELECT MAX(id) AS id FROM ${table}`, table);
    const lastId = idResult.length > 0 && idResult[0].values.length > 0
      ? idResult[0].values[0][0]
      : null;

    // Notify Electron window to refresh
    if (mainWindow && mainWindow.webContents && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(refreshChannel);
      console.log(`[IPC] Sent refresh event: ${refreshChannel}`);
    } else {
      console.log(`[IPC] Skipped refresh — mainWindow unavailable or destroyed`);
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

// Dispatch GET/POST/DELETE for a metrics route
function dispatchMetricsRoute(req, res, table, valueKey, label, refreshChannel) {
  if (req.method === 'GET') {
    handleGetMetrics(res, table, label);
    return;
  }
  if (req.method === 'POST') {
    handlePostMetrics(req, res, table, valueKey, label, refreshChannel);
    return;
  }
  if (req.method === 'DELETE') {
    handleDeleteMetrics(req, res, table, label, refreshChannel);
    return;
  }
  jsonResponse(res, 405, { error: 'Method not allowed. Use GET, POST, or DELETE.' });
}

const metricRoutes = [
  { url: '/api/p2p-metrics', table: 'p2p_metrics', valueKey: 'p2p_value', label: 'P2P metric', refresh: REFRESH_P2P },
  { url: '/api/seedling-metrics', table: 'seedling_metrics', valueKey: 'seedling_value', label: 'Seedling metric', refresh: REFRESH_SEEDLING },
];

function startHttpServer() {
  const server = http.createServer((req, res) => {
    const origin = req.headers.origin;
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = req.url.split('?')[0];

    for (const route of metricRoutes) {
      if (url === route.url) {
        dispatchMetricsRoute(req, res, route.table, route.valueKey, route.label, route.refresh);
        return;
      }
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

function createGetMetricsHandler(table) {
  return () => {
    const results = execSQL(`SELECT * FROM ${table} ORDER BY date ASC`, table);
    return rowsToObjects(results);
  };
}

function setupIPC() {
  ipcMain.handle(GET_P2P_METRICS, createGetMetricsHandler('p2p_metrics'));
  ipcMain.handle(GET_SEEDLING_METRICS, createGetMetricsHandler('seedling_metrics'));

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
