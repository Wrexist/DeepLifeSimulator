import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '@/utils/logger';

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

  private constructor() {
    this.initializeNetworkListener();
    this.loadPendingActions();
  }

  static getInstance(): OfflineManager {
    if (!OfflineManager.instance) {
      OfflineManager.instance = new OfflineManager();
    }
    return OfflineManager.instance;
  }

  private async initializeNetworkListener() {
    try {
      // Use navigator.onLine for web
      if (typeof navigator !== 'undefined') {
        this.isOnline = navigator.onLine ?? true;
        this.notifyListeners();
        
        window.addEventListener('online', () => {
          this.isOnline = true;
          this.notifyListeners();
          if (this.pendingActions.length > 0) {
            this.syncPendingActions();
          }
        });
        window.addEventListener('offline', () => {
          this.isOnline = false;
          this.notifyListeners();
        });
      } else {
        // Default to online if navigator is not available
        this.isOnline = true;
        this.notifyListeners();
      }
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
    // Clean up event listeners on web
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', () => {});
      window.removeEventListener('offline', () => {});
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

