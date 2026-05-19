const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // P2P Metrics
  getP2PMetrics: () => ipcRenderer.invoke('db:getP2PMetrics'),
  onRefreshP2PMetrics: (callback) => {
    ipcRenderer.on('p2p-metrics:refresh', () => callback());
  },
  removeRefreshListener: () => {
    ipcRenderer.removeAllListeners('p2p-metrics:refresh');
  },

  // Seedling Metrics
  getSeedlingMetrics: () => ipcRenderer.invoke('db:getSeedlingMetrics'),
  onRefreshSeedlingMetrics: (callback) => {
    ipcRenderer.on('seedling-metrics:refresh', () => callback());
  },
  removeSeedlingRefreshListener: () => {
    ipcRenderer.removeAllListeners('seedling-metrics:refresh');
  },
});
