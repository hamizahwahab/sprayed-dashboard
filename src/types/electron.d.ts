/// <reference types="next" />
/// <reference types="next/image-types/global" />

import type { P2PMetric, SeedlingMetric } from './index';

interface ElectronAPI {
  getP2PMetrics: () => Promise<P2PMetric[]>;
  onRefreshP2PMetrics: (callback: () => void) => void;
  removeRefreshListener: () => void;
  getSeedlingMetrics: () => Promise<SeedlingMetric[]>;
  onRefreshSeedlingMetrics: (callback: () => void) => void;
  removeSeedlingRefreshListener: () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
