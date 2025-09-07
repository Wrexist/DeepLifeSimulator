import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

interface SoundEffect {
  id: string;
  source: any; // require() statement
  volume?: number;
}

class SoundManager {
  private isEnabled: boolean = true;
  private isInitialized: boolean = false;

  async initialize(): Promise<void> {
    try {
      if (this.isInitialized) return;

      // Test haptics to ensure it's working
      if (Platform.OS !== 'web') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      this.isInitialized = true;
      console.log('Haptic feedback manager initialized successfully');
    } catch (error) {
      console.warn('Failed to initialize haptic feedback manager:', error);
      this.isEnabled = false;
    }
  }

  async loadSound(soundId: string, source: any): Promise<void> {
    try {
      if (!this.isEnabled || !this.isInitialized) return;
      console.log(`Haptic feedback prepared for: ${soundId}`);
    } catch (error) {
      console.warn(`Failed to prepare haptic feedback for ${soundId}:`, error);
    }
  }

  async playSound(soundId: string): Promise<void> {
    try {
      if (!this.isEnabled || !this.isInitialized) return;

      if (Platform.OS !== 'web') {
        // Map sound types to haptic feedback
        switch (soundId) {
          case 'button_click':
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            break;
          case 'success':
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            break;
          case 'error':
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            break;
          case 'notification':
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            break;
          case 'money':
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            break;
          case 'level_up':
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            break;
          default:
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        console.log(`Haptic feedback played for: ${soundId}`);
      }
    } catch (error) {
      console.warn(`Failed to play haptic feedback for ${soundId}:`, error);
    }
  }

  async unloadSound(soundId: string): Promise<void> {
    try {
      console.log(`Haptic feedback unloaded for: ${soundId}`);
    } catch (error) {
      console.warn(`Failed to unload haptic feedback for ${soundId}:`, error);
    }
  }

  async unloadAllSounds(): Promise<void> {
    try {
      console.log('All haptic feedback unloaded');
    } catch (error) {
      console.warn('Failed to unload all haptic feedback:', error);
    }
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    console.log(`Sound ${enabled ? 'enabled' : 'disabled'}`);
  }

  setVolume(volume: number): void {
    // Volume control not applicable for haptic feedback
    console.log(`Haptic intensity set to: ${volume}`);
  }

  isSoundEnabled(): boolean {
    return this.isEnabled;
  }

  getVolume(): number {
    return 1.0; // Always full intensity for haptics
  }

  // Predefined haptic feedback effects
  async playButtonClick(): Promise<void> {
    await this.playSound('button_click');
  }

  async playSuccess(): Promise<void> {
    await this.playSound('success');
  }

  async playError(): Promise<void> {
    await this.playSound('error');
  }

  async playNotification(): Promise<void> {
    await this.playSound('notification');
  }

  async playMoney(): Promise<void> {
    await this.playSound('money');
  }

  async playLevelUp(): Promise<void> {
    await this.playSound('level_up');
  }
}

// Export singleton instance
export const soundManager = new SoundManager();

// Helper functions for easy usage
export const initializeSound = (): Promise<void> => soundManager.initialize();
export const playSound = (soundId: string): Promise<void> => soundManager.playSound(soundId);
export const setSoundEnabled = (enabled: boolean): void => soundManager.setEnabled(enabled);
export const setSoundVolume = (volume: number): void => soundManager.setVolume(volume);
export const isSoundEnabled = (): boolean => soundManager.isSoundEnabled();
export const getSoundVolume = (): number => soundManager.getVolume();

// Predefined haptic feedback helpers
export const playButtonClick = (): Promise<void> => soundManager.playButtonClick();
export const playSuccess = (): Promise<void> => soundManager.playSuccess();
export const playError = (): Promise<void> => soundManager.playError();
export const playNotification = (): Promise<void> => soundManager.playNotification();
export const playMoney = (): Promise<void> => soundManager.playMoney();
export const playLevelUp = (): Promise<void> => soundManager.playLevelUp();
