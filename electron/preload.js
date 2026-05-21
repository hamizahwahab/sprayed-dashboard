const { contextBridge, ipcRenderer } = require('electron');
const { GET_P2P_METRICS, GET_SEEDLING_METRICS, REFRESH_P2P, REFRESH_SEEDLING } = require('./ipc-channels');

let p2pRefreshHandler = null;
let seedlingRefreshHandler = null;

contextBridge.exposeInMainWorld('electronAPI', {
  // P2P Metrics
  getP2PMetrics: () => ipcRenderer.invoke(GET_P2P_METRICS),
  onRefreshP2PMetrics: (callback) => {
    p2pRefreshHandler = () => callback();
    ipcRenderer.on(REFRESH_P2P, p2pRefreshHandler);
  },
  removeRefreshListener: () => {
    if (p2pRefreshHandler) {
      ipcRenderer.removeListener(REFRESH_P2P, p2pRefreshHandler);
      p2pRefreshHandler = null;
    }
  },

  // Seedling Metrics
  getSeedlingMetrics: () => ipcRenderer.invoke(GET_SEEDLING_METRICS),
  onRefreshSeedlingMetrics: (callback) => {
    seedlingRefreshHandler = () => callback();
    ipcRenderer.on(REFRESH_SEEDLING, seedlingRefreshHandler);
  },
  removeSeedlingRefreshListener: () => {
    if (seedlingRefreshHandler) {
      ipcRenderer.removeListener(REFRESH_SEEDLING, seedlingRefreshHandler);
      seedlingRefreshHandler = null;
    }
  },
});
