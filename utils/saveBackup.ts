import AsyncStorage from '@react-native-async-storage/async-storage';

interface BackupMetadata {
  slot: number;
  timestamp: number;
  reason: string;
  gameWeek: number;
  playerName: string;
}

class SaveBackupManager {
  private maxBackupsPerSlot = 3;
  
  /**
   * Create a backup before a major action
   */
  async createBackup(
    slot: number, 
    gameState: any, 
    reason: string
  ): Promise<boolean> {
    try {
      const backupKey = `backup_slot_${slot}_${Date.now()}`;
      const metadata: BackupMetadata = {
        slot,
        timestamp: Date.now(),
        reason,
        gameWeek: gameState.weeksLived || 0,
        playerName: gameState.userProfile?.name || 'Player',
      };

      const backupData = {
        metadata,
        state: gameState,
      };

      await AsyncStorage.setItem(backupKey, JSON.stringify(backupData));
      
      // Add to backup index
      await this.addToBackupIndex(slot, backupKey, metadata);
      
      // Clean old backups
      await this.cleanOldBackups(slot);
      
      console.log(`Backup created: ${backupKey} (${reason})`);
      return true;
    } catch (error) {
      console.error('Failed to create backup:', error);
      return false;
    }
  }

  /**
   * Add backup to index for tracking
   */
  private async addToBackupIndex(
    slot: number, 
    backupKey: string, 
    metadata: BackupMetadata
  ): Promise<void> {
    try {
      const indexKey = `backup_index_slot_${slot}`;
      const indexData = await AsyncStorage.getItem(indexKey);
      const index = indexData ? JSON.parse(indexData) : [];
      
      index.push({ key: backupKey, metadata });
      
      await AsyncStorage.setItem(indexKey, JSON.stringify(index));
    } catch (error) {
      console.error('Failed to update backup index:', error);
    }
  }

  /**
   * Clean old backups, keeping only the most recent ones
   */
  private async cleanOldBackups(slot: number): Promise<void> {
    try {
      const indexKey = `backup_index_slot_${slot}`;
      const indexData = await AsyncStorage.getItem(indexKey);
      
      if (!indexData) return;
      
      const index = JSON.parse(indexData);
      
      // Sort by timestamp (newest first)
      index.sort((a: any, b: any) => b.metadata.timestamp - a.metadata.timestamp);
      
      // Keep only the most recent backups
      const toKeep = index.slice(0, this.maxBackupsPerSlot);
      const toDelete = index.slice(this.maxBackupsPerSlot);
      
      // Delete old backups
      for (const backup of toDelete) {
        try {
          await AsyncStorage.removeItem(backup.key);
        } catch (error) {
          console.error(`Failed to delete backup ${backup.key}:`, error);
        }
      }
      
      // Update index
      await AsyncStorage.setItem(indexKey, JSON.stringify(toKeep));
    } catch (error) {
      console.error('Failed to clean old backups:', error);
    }
  }

  /**
   * List all backups for a slot
   */
  async listBackups(slot: number): Promise<BackupMetadata[]> {
    try {
      const indexKey = `backup_index_slot_${slot}`;
      const indexData = await AsyncStorage.getItem(indexKey);
      
      if (!indexData) return [];
      
      const index = JSON.parse(indexData);
      return index.map((item: any) => item.metadata);
    } catch (error) {
      console.error('Failed to list backups:', error);
      return [];
    }
  }

  /**
   * Restore a specific backup
   */
  async restoreBackup(backupKey: string): Promise<any | null> {
    try {
      const backupData = await AsyncStorage.getItem(backupKey);
      
      if (!backupData) {
        console.error('Backup not found:', backupKey);
        return null;
      }
      
      const backup = JSON.parse(backupData);
      return backup.state;
    } catch (error) {
      console.error('Failed to restore backup:', error);
      return null;
    }
  }

  /**
   * Delete all backups for a slot
   */
  async deleteAllBackups(slot: number): Promise<void> {
    try {
      const indexKey = `backup_index_slot_${slot}`;
      const indexData = await AsyncStorage.getItem(indexKey);
      
      if (!indexData) return;
      
      const index = JSON.parse(indexData);
      
      // Delete all backups
      for (const backup of index) {
        try {
          await AsyncStorage.removeItem(backup.key);
        } catch (error) {
          console.error(`Failed to delete backup ${backup.key}:`, error);
        }
      }
      
      // Delete index
      await AsyncStorage.removeItem(indexKey);
    } catch (error) {
      console.error('Failed to delete all backups:', error);
    }
  }
}

// Export singleton instance
export const saveBackupManager = new SaveBackupManager();

// Helper functions for common backup scenarios
export const createBackupBeforeMajorAction = async (
  slot: number,
  gameState: any,
  action: 'restart' | 'delete_save' | 'major_purchase' | 'character_death' | 'jail' | 'marriage' | 'job_change'
): Promise<boolean> => {
  const reasons = {
    restart: 'Before restarting game',
    delete_save: 'Before deleting save',
    major_purchase: 'Before major purchase',
    character_death: 'Before character death',
    jail: 'Before going to jail',
    marriage: 'Before getting married',
    job_change: 'Before changing job',
  };
  
  return saveBackupManager.createBackup(slot, gameState, reasons[action]);
};

