/// <reference types="next" />
/// <reference types="next/image-types/global" />

import type { P2PMetric } from './index';

interface ElectronAPI {
  getP2PMetrics: () => Promise<P2PMetric[]>;
  onRefreshP2PMetrics: (callback: () => void) => void;
  removeRefreshListener: () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
