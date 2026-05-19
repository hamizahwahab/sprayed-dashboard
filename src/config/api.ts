// API Configuration
// To change the port for Electron: set HTTP_PORT env var (e.g. HTTP_PORT=9000)
// For Next.js client side: set NEXT_PUBLIC_HTTP_PORT (e.g. NEXT_PUBLIC_HTTP_PORT=9000)

export const API_CONFIG = {
  // Your local HTTP server (Electron runs on port 8002 by default)
  BASE_URL: `http://localhost:${process.env.NEXT_PUBLIC_HTTP_PORT || '8002'}`,

  // P2P endpoint
  P2P_ENDPOINT: '/api/p2p-metrics',

  // Seedling endpoint
  SEEDLING_ENDPOINT: '/api/seedling-metrics',

  // Poll interval in milliseconds (60000 = 1 minute)
  POLL_INTERVAL: 60000,
};

export const P2P_API_URL = `${API_CONFIG.BASE_URL}${API_CONFIG.P2P_ENDPOINT}`;
export const SEEDLING_API_URL = `${API_CONFIG.BASE_URL}${API_CONFIG.SEEDLING_ENDPOINT}`;
