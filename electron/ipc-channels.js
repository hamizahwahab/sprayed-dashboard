// Shared IPC channel names — single source of truth for main process and preload
// Both files import this to guarantee channel names stay in sync
module.exports = {
  GET_P2P_METRICS: 'db:getP2PMetrics',
  GET_SEEDLING_METRICS: 'db:getSeedlingMetrics',
  REFRESH_P2P: 'p2p-metrics:refresh',
  REFRESH_SEEDLING: 'seedling-metrics:refresh',
};
