import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
// CRITICAL: Lazy-load NetInfo to prevent TurboModule crash at module load
// import NetInfo, { NetInfoState } from '@react-native-community/netinfo'; // REMOVED - lazy load
import { logger } from '@/utils/logger';

// Lazy-loaded NetInfo module
let NetInfo: any = null;
let netInfoLoadAttempted = false;

function loadNetInfoModule(): boolean {
  if (netInfoLoadAttempted) {
    return NetInfo !== null;
  }
  
  netInfoLoadAttempted = true;
  
  try {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/afa84dc3-87dd-40fd-a42e-55a0db841d20',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'utils/offlineManager.native.ts:18',message:'Before NetInfo require',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H6'})}).catch(()=>{});
    // #endregion
    NetInfo = require('@react-native-community/netinfo').default;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/afa84dc3-87dd-40fd-a42e-55a0db841d20',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'utils/offlineManager.native.ts:22',message:'After NetInfo require success',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H6'})}).catch(()=>{});
    // #endregion
    return true;
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/afa84dc3-87dd-40fd-a42e-55a0db841d20',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'utils/offlineManager.native.ts:27',message:'NetInfo require failed',data:{error:String(error)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H6'})}).catch(()=>{});
    // #endregion
    // Module not available - will assume online
    return false;
  }
}

interface OfflineAction {
  id: string;
  type: string;
  data: unknown;
  timestamp: number;
  retryCount: number;
}

class OfflineManager {
  private static instance: OfflineManager;
  private isOnline: boolean = true;
  private pendingActions: OfflineAction[] = [];
  private listeners: ((isOnline: boolean) => void)[] = [];
  private syncInProgress: boolean = false;
  private unsubscribeNetInfo: (() => void) | null = null;
  private isInitialized: boolean = false;

  // CRITICAL: DO NOT call native modules in constructor
  // Constructor runs at module load time, BEFORE React Native is ready
  private constructor() {
    // Defer all initialization - do NOT call initializeNetworkListener() here
    // Do NOT call loadPendingActions() here
    // These will be called lazily on first use
  }

  static getInstance(): OfflineManager {
    if (!OfflineManager.instance) {
      OfflineManager.instance = new OfflineManager();
    }
    // Ensure initialization happens on first access
    OfflineManager.instance.ensureInitialized();
    return OfflineManager.instance;
  }

  // Lazy initialization - only call native modules AFTER this is explicitly invoked
  private ensureInitialized(): void {
    if (this.isInitialized) {
      return;
    }
    
    this.isInitialized = true;
    this.initializeNetworkListener();
    this.loadPendingActions();
  }

  private async initializeNetworkListener() {
    // Try to load NetInfo module
    if (!loadNetInfoModule()) {
      // NetInfo not available - assume always online
      if (__DEV__) {
        logger.warn('NetInfo not available - assuming always online');
      }
      this.isOnline = true;
      this.notifyListeners();
      return;
    }

    try {
      // Check initial network state
      const netInfoState = await NetInfo.fetch();
      this.isOnline = netInfoState.isConnected ?? true;
      this.notifyListeners();

      // Subscribe to network state changes
      this.unsubscribeNetInfo = NetInfo.addEventListener((state: any) => {
        const wasOnline = this.isOnline;
        this.isOnline = state.isConnected ?? false;
        
        if (wasOnline !== this.isOnline) {
          this.notifyListeners();
          
          // Auto-sync when coming back online
          if (this.isOnline && this.pendingActions.length > 0) {
            this.syncPendingActions();
          }
        }
      });
    } catch (error) {
      if (__DEV__) {
        logger.error('Failed to initialize network listener:', error);
      }
      // Default to online if initialization fails
      this.isOnline = true;
      this.notifyListeners();
    }
  }

  public destroy() {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
      this.unsubscribeNetInfo = null;
    }
    this.listeners = [];
  }

  private async loadPendingActions() {
    try {
      const stored = await AsyncStorage.getItem('offline_actions');
      if (stored) {
        this.pendingActions = JSON.parse(stored);
      }
    } catch (error) {
      if (__DEV__) {
        logger.error('Failed to load pending actions:', error);
      }
      this.pendingActions = [];
    }
  }

  private async savePendingActions() {
    try {
      await AsyncStorage.setItem('offline_actions', JSON.stringify(this.pendingActions));
    } catch (error) {
      if (__DEV__) {
        logger.error('Failed to save pending actions:', error);
      }
    }
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.isOnline));
  }

  public addNetworkListener(listener: (isOnline: boolean) => void) {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  public isConnected(): boolean {
    return this.isOnline;
  }

  public async queueAction(type: string, data: unknown): Promise<string> {
    const action: OfflineAction = {
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      timestamp: Date.now(),
      retryCount: 0,
    };

    this.pendingActions.push(action);
    await this.savePendingActions();

    if (this.isOnline) {
      this.syncPendingActions();
    }

    return action.id;
  }

  private async syncPendingActions() {
    if (this.syncInProgress || !this.isOnline || this.pendingActions.length === 0) {
      return;
    }

    this.syncInProgress = true;

    try {
      const actionsToSync = [...this.pendingActions];
      const successfulActions: string[] = [];

      for (const action of actionsToSync) {
        try {
          await this.executeAction(action);
          successfulActions.push(action.id);
        } catch (error) {
          if (__DEV__) {
            logger.error(`Failed to sync action ${action.id}:`, error);
          }
          
          // Increment retry count
          action.retryCount++;
          
          // Remove action if it has exceeded max retries
          if (action.retryCount >= 3) {
            if (__DEV__) {
              logger.warn(`Removing action ${action.id} after ${action.retryCount} failed attempts`);
            }
            successfulActions.push(action.id);
          }
        }
      }

      // Remove successful actions
      this.pendingActions = this.pendingActions.filter(
        action => !successfulActions.includes(action.id)
      );

      await this.savePendingActions();
    } catch (error) {
      if (__DEV__) {
        logger.error('Failed to sync pending actions:', error);
      }
    } finally {
      this.syncInProgress = false;
    }
  }

  private async executeAction(action: OfflineAction): Promise<void> {
    switch (action.type) {
      case 'save_game':
        await this.executeSaveGame(action.data);
        break;
      case 'upload_leaderboard':
        await this.executeUploadLeaderboard(action.data);
        break;
      case 'purchase_validation':
        await this.executePurchaseValidation(action.data);
        break;
      default:
        if (__DEV__) {
          logger.warn(`Unknown action type: ${action.type}`);
        }
    }
  }

  private async executeSaveGame(data: unknown): Promise<void> {
    try {
      const { uploadGameState } = await import('@/lib/progress/cloud');
      if (data && typeof data === 'object' && 'state' in data && 'updatedAt' in data) {
        await uploadGameState(data as { state: unknown; updatedAt: number });
      }
    } catch (error) {
      if (__DEV__) {
        logger.error('Failed to execute save game:', error);
      }
      throw error;
    }
  }

  private async executeUploadLeaderboard(data: unknown): Promise<void> {
    try {
      const { uploadLeaderboardScore } = await import('@/lib/progress/cloud');
      if (data && typeof data === 'object' && 'category' in data && 'name' in data && 'score' in data) {
        await uploadLeaderboardScore(data as { category: string; name: string; score: number });
      }
    } catch (error) {
      if (__DEV__) {
        logger.error('Failed to execute leaderboard upload:', error);
      }
      throw error;
    }
  }

  private async executePurchaseValidation(data: unknown): Promise<void> {
    try {
      // Purchase validation would be handled by IAP service
      if (__DEV__) {
        logger.info('Executing purchase validation:', data);
      }
    } catch (error) {
      if (__DEV__) {
        logger.error('Failed to execute purchase validation:', error);
      }
      throw error;
    }
  }

  public getPendingActionsCount(): number {
    return this.pendingActions.length;
  }

  public async clearPendingActions(): Promise<void> {
    this.pendingActions = [];
    await this.savePendingActions();
  }

  public getConnectionStatus(): {
    isOnline: boolean;
    pendingActions: number;
    lastSync: number | null;
  } {
    return {
      isOnline: this.isOnline,
      pendingActions: this.pendingActions.length,
      lastSync: this.pendingActions.length > 0 ? 
        Math.max(...this.pendingActions.map(a => a.timestamp)) : null,
    };
  }
}

export const offlineManager = OfflineManager.getInstance();

// React hook for network status
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = React.useState(offlineManager.isConnected());
  const [pendingActions, setPendingActions] = React.useState(0);

  React.useEffect(() => {
    const unsubscribe = offlineManager.addNetworkListener((online) => {
      setIsOnline(online);
      setPendingActions(offlineManager.getPendingActionsCount());
    });

    return unsubscribe;
  }, []);

  return { isOnline, pendingActions };
}

