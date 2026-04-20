/**
 * Type declaration for platform-specific offlineManager modules.
 * Metro resolves offlineManager.native.ts or offlineManager.web.ts at runtime.
 * This file lets TypeScript resolve the bare `@/utils/offlineManager` import.
 */

export interface OfflineManagerInstance {
  isOnline: boolean;
  isConnected(): boolean;
  addNetworkListener(callback: (online: boolean) => void): () => void;
  addAction(action: { type: string; data: unknown }): Promise<void>;
  getQueueSize(): number;
  processQueue(): Promise<void>;
}

export function useNetworkStatus(): { isOnline: boolean; pendingActions: number };

export const offlineManager: OfflineManagerInstance;
