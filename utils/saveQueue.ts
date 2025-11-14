import AsyncStorage from '@react-native-async-storage/async-storage';

interface SaveOperation {
  id: string;
  slot: number;
  data: any;
  timestamp: number;
  retryCount: number;
}

type ToastCallback = (message: string, type: 'success' | 'error') => void;

class SaveQueue {
  private queue: SaveOperation[] = [];
  private isProcessing = false;
  private maxRetries = 3;
  private retryDelay = 1000; // 1 second
  private toastCallback: ToastCallback | null = null;
  private lastToastTime = 0;
  private toastCooldown = 2000; // 2 seconds cooldown between toasts

  // Register toast callback
  setToastCallback(callback: ToastCallback) {
    this.toastCallback = callback;
  }

  private shouldShowToast(): boolean {
    const now = Date.now();
    if (now - this.lastToastTime < this.toastCooldown) {
      return false;
    }
    this.lastToastTime = now;
    return true;
  }

  async addToQueue(slot: number, data: any): Promise<void> {
    const operation: SaveOperation = {
      id: `save_${Date.now()}_${Math.random()}`,
      slot,
      data,
      timestamp: Date.now(),
      retryCount: 0,
    };

    this.queue.push(operation);
    
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const operation = this.queue.shift();
      if (!operation) continue;

      try {
        await this.performSave(operation);
        console.log(`Save successful for slot ${operation.slot}`);
        
        // Don't show success toast - silent saves
      } catch (error) {
        console.error(`Save failed for slot ${operation.slot}:`, error);
        
        if (operation.retryCount < this.maxRetries) {
          operation.retryCount++;
          operation.timestamp = Date.now();
          
          // Add back to queue with delay
          setTimeout(() => {
            this.queue.unshift(operation);
            if (!this.isProcessing) {
              this.processQueue();
            }
          }, this.retryDelay * operation.retryCount);
        } else {
          console.error(`Save operation failed permanently for slot ${operation.slot} after ${this.maxRetries} retries`);
          
          // Show error toast (always show errors)
          if (this.toastCallback) {
            this.toastCallback('Save Failed! Please try again.', 'error');
          }
        }
      }
    }

    this.isProcessing = false;
  }

  private async performSave(operation: SaveOperation): Promise<void> {
    try {
      const key = `save_slot_${operation.slot}`;
      const serializedData = JSON.stringify(operation.data);
      
      await AsyncStorage.setItem(key, serializedData);
      
      // Also save the last slot reference
      await AsyncStorage.setItem('lastSlot', operation.slot.toString());
    } catch (error) {
      console.error('AsyncStorage save error:', error);
      throw error;
    }
  }

  // Force save a specific slot immediately (bypasses queue)
  async forceSave(slot: number, data: any): Promise<void> {
    try {
      const key = `save_slot_${slot}`;
      const serializedData = JSON.stringify(data);
      
      await AsyncStorage.setItem(key, serializedData);
      await AsyncStorage.setItem('lastSlot', slot.toString());
      
      console.log(`Force save successful for slot ${slot}`);
      
      // Don't show success toast - silent saves
    } catch (error) {
      console.error(`Force save failed for slot ${slot}:`, error);
      
      // Show error toast (always show errors)
      if (this.toastCallback) {
        this.toastCallback('Save Failed! Please try again.', 'error');
      }
      
      throw error;
    }
  }

  // Get queue status
  getStatus() {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
    };
  }

  // Clear queue (useful for testing or emergency situations)
  clearQueue(): void {
    this.queue = [];
    this.isProcessing = false;
  }
}

// Export singleton instance
export const saveQueue = new SaveQueue();

// Helper function for easy usage
export const queueSave = (slot: number, data: any): Promise<void> => {
  return saveQueue.addToQueue(slot, data);
};

export const forceSave = (slot: number, data: any): Promise<void> => {
  return saveQueue.forceSave(slot, data);
};
