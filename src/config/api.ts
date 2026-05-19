// API Configuration
// Change these values to connect to your data source

export const API_CONFIG = {
  // Your local HTTP server (Electron runs on port 8002)
  BASE_URL: 'http://localhost:8002',

  // P2P endpoint
  P2P_ENDPOINT: '/api/p2p-metrics',

  // Poll interval in milliseconds (60000 = 1 minute)
  POLL_INTERVAL: 60000,
};

export const P2P_API_URL = `${API_CONFIG.BASE_URL}${API_CONFIG.P2P_ENDPOINT}`;
