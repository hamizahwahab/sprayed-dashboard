const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getP2PMetrics: () => ipcRenderer.invoke('db:getP2PMetrics'),
  onRefreshP2PMetrics: (callback) => {
    ipcRenderer.on('p2p-metrics:refresh', () => callback());
  },
  removeRefreshListener: () => {
    ipcRenderer.removeAllListeners('p2p-metrics:refresh');
  },
});
