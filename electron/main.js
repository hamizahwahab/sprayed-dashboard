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
const HTTP_PORT = 8002;
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

  // In dev mode, load from localhost:3000, otherwise load static files
  if (isDevMode) {
    mainWindow.loadURL('http://localhost:3000');
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

// HTTP Server for receiving data pushes
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

    // GET /api/p2p-metrics - Get P2P metrics
    if (req.method === 'GET' && url === '/api/p2p-metrics') {
      try {
        const results = db.exec('SELECT * FROM p2p_metrics ORDER BY date ASC');
        if (results.length === 0) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify([]));
          return;
        }

        const columns = results[0].columns;
        const metrics = results[0].values.map(row => {
          const obj = {};
          columns.forEach((col, i) => obj[col] = row[i]);
          return obj;
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(metrics));
      } catch (err) {
        console.error('Error fetching p2p metrics:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to fetch p2p metrics' }));
      }
      return;
    }

    // POST /api/p2p-metrics - Add new P2P data point
    if (req.method === 'POST' && url === '/api/p2p-metrics') {
      if (!isValidApiKey(req)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }

      let body = '';

      req.on('data', chunk => {
        body += chunk.toString();
      });

      req.on('end', () => {
        try {
          const data = JSON.parse(body);

          if (!data.date || data.p2p_value === undefined) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing date or p2p_value' }));
            return;
          }

          const date = data.date;
          const month = data.month || date.substring(0, 7);
          const p2pValue = parseFloat(data.p2p_value) || 0;

          const stmt = db.prepare(
            'INSERT INTO p2p_metrics (date, month, daily_value) VALUES (?, ?, ?)'
          );
          stmt.run([date, month, p2pValue]);
          stmt.free();

          saveDatabase();

          const lastId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];

          if (mainWindow && mainWindow.webContents && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('p2p-metrics:refresh');
          }

          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            id: lastId,
            message: 'P2P metric saved successfully'
          }));

          console.log('New P2P metric received:', date, p2pValue);
        } catch (err) {
          console.error('Error saving p2p metric:', err);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }

    // 404 for unknown routes
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`HTTP Server running on http://0.0.0.0:${HTTP_PORT}`);
    console.log(`POST P2P data to: http://YOUR_IP:${HTTP_PORT}/api/p2p-metrics`);
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
