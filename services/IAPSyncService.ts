import AsyncStorage from '@react-native-async-storage/async-storage';
import { iapService } from './IAPService';
import { logger } from '@/utils/logger';

export interface IAPAction {
  id: string;
  type: 'purchase' | 'restore' | 'sync';
  productId?: string;
  timestamp: number;
  data?: any;
}

class IAPSyncService {
  private static instance: IAPSyncService;
  private syncQueue: IAPAction[] = [];
  private isSyncing = false;
  private listeners: ((action: IAPAction) => void)[] = [];
  private maxRetries = 3;
  private retryDelays = [1000, 2000, 4000]; // Exponential backoff

  private constructor() {
    this.loadPendingActions();
    this.setupIAPListeners();
  }

  static getInstance(): IAPSyncService {
    if (!IAPSyncService.instance) {
      IAPSyncService.instance = new IAPSyncService();
    }
    return IAPSyncService.instance;
  }

  /**
   * Setup listeners for IAP service events
   */
  private setupIAPListeners(): void {
    // Listen to IAP service state changes
    iapService.addListener((state) => {
      if (state.purchases && state.purchases.length > 0) {
        // New purchases detected, trigger sync
        this.triggerSync();
      }
    });
  }

  /**
   * Queue an IAP action for synchronization
   */
  async queueAction(action: Omit<IAPAction, 'id' | 'timestamp'>): Promise<string> {
    const fullAction: IAPAction = {
      ...action,
      id: `${action.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    this.syncQueue.push(fullAction);
    await this.savePendingActions();

    // Trigger sync if online
    this.triggerSync();

    return fullAction.id;
  }

  /**
   * Trigger synchronization of queued actions
   */
  private async triggerSync(): Promise<void> {
    if (this.isSyncing || this.syncQueue.length === 0) {
      return;
    }

    this.isSyncing = true;

    try {
      await this.syncPendingActions();
    } catch (error) {
      logger.error('IAP sync error:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync all pending actions
   */
  private async syncPendingActions(): Promise<void> {
    const actionsToSync = [...this.syncQueue];
    const successfulActions: string[] = [];

    for (const action of actionsToSync) {
      try {
        await this.executeAction(action);
        successfulActions.push(action.id);
        this.notifyListeners(action);
      } catch (error) {
        logger.error(`Failed to sync action ${action.id}:`, error);
        // Action will remain in queue for retry
      }
    }

    // Remove successful actions from queue
    this.syncQueue = this.syncQueue.filter(
      action => !successfulActions.includes(action.id)
    );

    if (successfulActions.length > 0) {
      await this.savePendingActions();
    }
  }

  /**
   * Execute a single IAP action
   */
  private async executeAction(action: IAPAction): Promise<void> {
    switch (action.type) {
      case 'purchase':
        // Purchase already completed, just sync state
        await this.syncPurchaseState(action.productId!);
        break;
      case 'restore':
        // Restore purchases
        await iapService.restorePurchases();
        break;
      case 'sync':
        // Sync game state after IAP
        await this.syncGameState();
        break;
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  /**
   * Sync purchase state to game
   */
  private async syncPurchaseState(productId: string): Promise<void> {
    // Check if purchase exists in IAP service
    const hasPurchased = iapService.hasPurchased(productId);
    if (hasPurchased) {
      // Set trigger for game state reload
      await AsyncStorage.setItem('iap_trigger_reload', Date.now().toString());
    }
  }

  /**
   * Sync game state after IAP purchase
   */
  private async syncGameState(): Promise<void> {
    // Trigger game state reload
    await AsyncStorage.setItem('iap_trigger_reload', Date.now().toString());
  }

  /**
   * Retry failed action with exponential backoff
   */
  private async retryAction(action: IAPAction, attempt: number): Promise<void> {
    if (attempt >= this.maxRetries) {
      logger.warn(`Action ${action.id} failed after ${this.maxRetries} attempts`);
      return;
    }

    const delay = this.retryDelays[attempt] || this.retryDelays[this.retryDelays.length - 1];
    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      await this.executeAction(action);
      // Remove from queue on success
      this.syncQueue = this.syncQueue.filter(a => a.id !== action.id);
      await this.savePendingActions();
    } catch (error) {
      // Retry again
      await this.retryAction(action, attempt + 1);
    }
  }

  /**
   * Save pending actions to storage
   */
  private async savePendingActions(): Promise<void> {
    try {
      await AsyncStorage.setItem('iap_sync_queue', JSON.stringify(this.syncQueue));
    } catch (error) {
      logger.error('Failed to save IAP sync queue:', error);
    }
  }

  /**
   * Load pending actions from storage
   */
  private async loadPendingActions(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem('iap_sync_queue');
      if (data) {
        this.syncQueue = JSON.parse(data);
        // Trigger sync for any pending actions
        if (this.syncQueue.length > 0) {
          this.triggerSync();
        }
      }
    } catch (error) {
      logger.error('Failed to load IAP sync queue:', error);
      this.syncQueue = [];
    }
  }

  /**
   * Add listener for sync events
   */
  addListener(listener: (action: IAPAction) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Notify all listeners of an action
   */
  private notifyListeners(action: IAPAction): void {
    this.listeners.forEach(listener => {
      try {
        listener(action);
      } catch (error) {
        logger.error('Error in IAP sync listener:', error);
      }
    });
  }

  /**
   * Get current queue status
   */
  getQueueStatus(): { pending: number; isSyncing: boolean } {
    return {
      pending: this.syncQueue.length,
      isSyncing: this.isSyncing,
    };
  }

  /**
   * Clear all pending actions (use with caution)
   */
  async clearQueue(): Promise<void> {
    this.syncQueue = [];
    await AsyncStorage.removeItem('iap_sync_queue');
  }
}

export const iapSyncService = IAPSyncService.getInstance();
export default iapSyncService;

