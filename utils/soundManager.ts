import { Platform } from 'react-native';
// CRITICAL: Lazy-load expo-haptics to prevent TurboModule crash at module load
// import * as Haptics from 'expo-haptics'; // REMOVED - lazy load instead
import { logger } from '@/utils/logger';

// Lazy-loaded Haptics module
let Haptics: any = null;
let hapticsLoadAttempted = false;

function loadHapticsModule(): boolean {
  if (hapticsLoadAttempted) {
    return Haptics !== null;
  }
  
  hapticsLoadAttempted = true;
  
  try {
    Haptics = require('expo-haptics');
    return true;
  } catch (error) {
    // Module not available - will skip haptics
    return false;
  }
}

// Optional import for expo-av - fallback to haptics if not available
let Audio: typeof import('expo-av').Audio | null = null;
try {
  Audio = require('expo-av').Audio;
} catch (error) {
  logger.warn('expo-av not available, using haptic feedback only');
}

class SoundManager {
  private isEnabled: boolean = true;
  private isInitialized: boolean = false;
  private sounds: Map<string, any> = new Map(); // Audio.Sound type when expo-av is available
  private backgroundMusic: any = null; // Audio.Sound type when expo-av is available
  
  // Volume controls
  private masterVolume: number = 1.0;
  private sfxVolume: number = 1.0;
  private musicVolume: number = 0.5;
  
  // Computed effective volumes
  private get effectiveSfxVolume(): number {
    return this.masterVolume * this.sfxVolume;
  }
  
  private get effectiveMusicVolume(): number {
    return this.masterVolume * this.musicVolume;
  }

  async initialize(): Promise<void> {
    try {
      if (this.isInitialized) return;

      // Set audio mode for better performance
      if (Platform.OS !== 'web' && Audio) {
        try {
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            shouldDuckAndroid: true,
          });
        } catch (error) {
          logger.warn('Failed to set audio mode:', { error });
        }
      }

      // Test haptics to ensure it's working
      if (Platform.OS !== 'web' && loadHapticsModule()) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      this.isInitialized = true;
      logger.info('Sound manager initialized successfully');
    } catch (error) {
      logger.warn('Failed to initialize sound manager:', { error });
      this.isEnabled = false;
    }
  }

  async loadSound(soundId: string, source: any): Promise<void> {
    try {
      if (!this.isInitialized) await this.initialize();
      if (!this.isEnabled) return;

      // Unload existing sound if present
      if (this.sounds.has(soundId)) {
        await this.unloadSound(soundId);
      }

      if (Platform.OS !== 'web' && source && Audio) {
        try {
          const { sound } = await Audio.Sound.createAsync(source, {
            shouldPlay: false,
            volume: this.effectiveSfxVolume,
          });
          this.sounds.set(soundId, sound);
          logger.debug(`Sound loaded: ${soundId}`);
        } catch (error) {
          logger.warn(`Failed to load sound ${soundId}:`, { error });
        }
      }
    } catch (error) {
      logger.warn(`Failed to load sound ${soundId}:`, { error });
    }
  }

  async playSound(soundId: string): Promise<void> {
    try {
      if (!this.isEnabled || !this.isInitialized) return;

      if (Platform.OS !== 'web') {
        // Try to play audio sound first (if expo-av is available)
        if (Audio) {
          const sound = this.sounds.get(soundId);
          if (sound) {
            try {
              await sound.replayAsync();
              return;
            } catch (error) {
              logger.warn(`Failed to play sound ${soundId}:`, { error });
            }
          }
        }

        // Fallback to haptic feedback if sound not loaded or expo-av not available
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
      }
    } catch (error) {
      logger.warn(`Failed to play sound ${soundId}:`, { error });
    }
  }

  async unloadSound(soundId: string): Promise<void> {
    try {
      const sound = this.sounds.get(soundId);
      if (sound && Audio) {
        try {
          await sound.unloadAsync();
        } catch (error) {
          logger.warn(`Failed to unload sound ${soundId}:`, { error });
        }
      }
      this.sounds.delete(soundId);
      logger.debug(`Sound unloaded: ${soundId}`);
    } catch (error) {
      logger.warn(`Failed to unload sound ${soundId}:`, { error });
    }
  }

  async unloadAllSounds(): Promise<void> {
    try {
      if (Audio) {
        for (const [soundId, sound] of this.sounds.entries()) {
          try {
            await sound.unloadAsync();
          } catch (error) {
            logger.warn(`Failed to unload sound ${soundId}:`, { error });
          }
        }
      }
      this.sounds.clear();
      logger.info('All sounds unloaded');
    } catch (error) {
      logger.warn('Failed to unload all sounds:', { error });
    }
  }

  async playBackgroundMusic(source: any, loop: boolean = true): Promise<void> {
    try {
      if (!this.isInitialized) await this.initialize();
      if (!this.isEnabled) return;

      // Stop existing background music
      await this.stopBackgroundMusic();

      if (Platform.OS !== 'web' && source && Audio) {
        try {
          const { sound } = await Audio.Sound.createAsync(source, {
            shouldPlay: true,
            isLooping: loop,
            volume: this.musicVolume,
          });
          this.backgroundMusic = sound;
          logger.info('Background music started');
        } catch (error) {
          logger.warn('Failed to play background music:', { error });
        }
      }
    } catch (error) {
      logger.warn('Failed to play background music:', { error });
    }
  }

  async stopBackgroundMusic(): Promise<void> {
    try {
      if (this.backgroundMusic && Audio) {
        try {
          await this.backgroundMusic.stopAsync();
          await this.backgroundMusic.unloadAsync();
        } catch (error) {
          logger.warn('Failed to stop background music:', { error });
        }
        this.backgroundMusic = null;
        logger.info('Background music stopped');
      }
    } catch (error) {
      logger.warn('Failed to stop background music:', { error });
    }
  }

  async setBackgroundMusicVolume(volume: number): Promise<void> {
    try {
      this.musicVolume = Math.max(0, Math.min(1, volume));
      if (this.backgroundMusic && Audio) {
        try {
          await this.backgroundMusic.setVolumeAsync(this.musicVolume);
        } catch (error) {
          logger.warn('Failed to set background music volume:', { error });
        }
      }
    } catch (error) {
      logger.warn('Failed to set background music volume:', { error });
    }
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    logger.info(`Sound ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Master volume controls all audio
  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.updateAllVolumes();
    logger.info(`Master volume set to ${this.masterVolume}`);
  }

  getMasterVolume(): number {
    return this.masterVolume;
  }

  // SFX volume for sound effects
  setSfxVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    this.updateAllVolumes();
    logger.info(`SFX volume set to ${this.sfxVolume}`);
  }

  getSfxVolume(): number {
    return this.sfxVolume;
  }

  // Music volume for background music
  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    this.updateBackgroundMusicVolume();
    logger.info(`Music volume set to ${this.musicVolume}`);
  }

  getMusicVolume(): number {
    return this.musicVolume;
  }

  // Update all loaded sound volumes
  private async updateAllVolumes(): Promise<void> {
    if (Audio) {
      this.sounds.forEach(async (sound) => {
        try {
          await sound.setVolumeAsync(this.effectiveSfxVolume);
        } catch (error) {
          logger.warn('Failed to update sound volume:', { error });
        }
      });
    }
    await this.updateBackgroundMusicVolume();
  }

  // Update background music volume
  private async updateBackgroundMusicVolume(): Promise<void> {
    if (this.backgroundMusic && Audio) {
      try {
        await this.backgroundMusic.setVolumeAsync(this.effectiveMusicVolume);
      } catch (error) {
        logger.warn('Failed to update music volume:', { error });
      }
    }
  }

  // Legacy method for backwards compatibility
  setVolume(volume: number): void {
    this.setMasterVolume(volume);
  }

  isSoundEnabled(): boolean {
    return this.isEnabled;
  }

  getVolume(): number {
    return this.masterVolume;
  }

  // Apply volume settings from game state
  applyVolumeSettings(settings: { masterVolume?: number; sfxVolume?: number; musicVolume?: number }): void {
    if (settings.masterVolume !== undefined) this.masterVolume = settings.masterVolume;
    if (settings.sfxVolume !== undefined) this.sfxVolume = settings.sfxVolume;
    if (settings.musicVolume !== undefined) this.musicVolume = settings.musicVolume;
    this.updateAllVolumes();
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

// Volume control helpers
export const setMasterVolume = (volume: number): void => soundManager.setMasterVolume(volume);
export const getMasterVolume = (): number => soundManager.getMasterVolume();
export const setSfxVolume = (volume: number): void => soundManager.setSfxVolume(volume);
export const getSfxVolume = (): number => soundManager.getSfxVolume();
export const setMusicVolume = (volume: number): void => soundManager.setMusicVolume(volume);
export const getMusicVolume = (): number => soundManager.getMusicVolume();
export const applyVolumeSettings = (settings: { masterVolume?: number; sfxVolume?: number; musicVolume?: number }): void => 
  soundManager.applyVolumeSettings(settings);

// Predefined haptic feedback helpers
export const playButtonClick = (): Promise<void> => soundManager.playButtonClick();
export const playSuccess = (): Promise<void> => soundManager.playSuccess();
export const playError = (): Promise<void> => soundManager.playError();
export const playNotification = (): Promise<void> => soundManager.playNotification();
export const playMoney = (): Promise<void> => soundManager.playMoney();
export const playLevelUp = (): Promise<void> => soundManager.playLevelUp();

// Background music helpers
export const playBackgroundMusic = (source: any, loop?: boolean): Promise<void> => soundManager.playBackgroundMusic(source, loop);
export const stopBackgroundMusic = (): Promise<void> => soundManager.stopBackgroundMusic();
export const setBackgroundMusicVolume = (volume: number): Promise<void> => soundManager.setBackgroundMusicVolume(volume);
