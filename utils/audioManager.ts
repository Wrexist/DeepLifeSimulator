/**
 * Audio Manager
 * 
 * Enhanced audio system to replace soundManager.ts with:
 * - Better volume control
 * - Sound effect and music management
 * - Background music support
 * - Audio library integration
 */

// import { Audio } from 'expo-av'; // REMOVED - package removed to fix TurboModule crash
import { logger } from './logger';

const log = logger.scope('AudioManager');

export interface SoundEffect {
  id: string;
  name: string;
  volume: number; // 0-1
  loop?: boolean;
}

export interface MusicTrack {
  id: string;
  name: string;
  volume: number; // 0-1
  loop: boolean;
}

class AudioManager {
  private static instance: AudioManager;
  private soundEffects: Map<string, // Audio.Sound> = new Map();
  private musicTrack: // Audio.Sound | null = null;
  private currentMusicId: string | null = null;
  private masterVolume: number = 1.0;
  private sfxVolume: number = 1.0;
  private musicVolume: number = 1.0;
  private enabled: boolean = true;

  private constructor() {
    // Set audio mode for better performance
    // Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    }).catch(err => {
      log.error('Failed to set audio mode:', err);
    });
  }

  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  /**
   * Set master volume (affects all audio)
   */
  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.updateAllVolumes();
  }

  /**
   * Set sound effects volume
   */
  setSFXVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    this.updateAllVolumes();
  }

  /**
   * Set music volume
   */
  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.musicTrack) {
      this.musicTrack.setVolumeAsync(this.musicVolume * this.masterVolume).catch(err => {
        log.error('Failed to set music volume:', err);
      });
    }
  }

  /**
   * Enable/disable audio
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.stopAll();
    }
  }

  /**
   * Update all sound effect volumes
   */
  private updateAllVolumes(): void {
    this.soundEffects.forEach((sound) => {
      sound.setVolumeAsync(this.sfxVolume * this.masterVolume).catch(err => {
        log.error('Failed to update sound effect volume:', err);
      });
    });
  }

  /**
   * Play a sound effect
   */
  async playSound(soundId: string, volume: number = 1.0): Promise<void> {
    if (!this.enabled) return;

    try {
      // Stop existing sound if playing
      const existingSound = this.soundEffects.get(soundId);
      if (existingSound) {
        await existingSound.unloadAsync();
      }

      // Load and play new sound
      const { sound } = await // Audio.Sound.createAsync(
        { uri: `asset:/sounds/${soundId}.mp3` },
        {
          shouldPlay: true,
          volume: volume * this.sfxVolume * this.masterVolume,
          isLooping: false,
        }
      );

      this.soundEffects.set(soundId, sound);

      // Clean up when sound finishes
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
          this.soundEffects.delete(soundId);
        }
      });
    } catch (error) {
      // Silently fail if sound file doesn't exist
      log.debug(`Sound effect ${soundId} not found or failed to play`);
    }
  }

  /**
   * Play background music
   */
  async playMusic(musicId: string, volume: number = 0.5, loop: boolean = true): Promise<void> {
    if (!this.enabled) return;

    try {
      // Stop current music if playing
      if (this.musicTrack) {
        await this.musicTrack.unloadAsync();
        this.musicTrack = null;
        this.currentMusicId = null;
      }

      // Load and play new music
      const { sound } = await // Audio.Sound.createAsync(
        { uri: `asset:/music/${musicId}.mp3` },
        {
          shouldPlay: true,
          volume: volume * this.musicVolume * this.masterVolume,
          isLooping: loop,
        }
      );

      this.musicTrack = sound;
      this.currentMusicId = musicId;

      // Handle playback status
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish && !loop) {
          sound.unloadAsync().catch(() => {});
          this.musicTrack = null;
          this.currentMusicId = null;
        }
      });
    } catch (error) {
      log.debug(`Music track ${musicId} not found or failed to play`);
    }
  }

  /**
   * Stop background music
   */
  async stopMusic(): Promise<void> {
    if (this.musicTrack) {
      try {
        await this.musicTrack.unloadAsync();
        this.musicTrack = null;
        this.currentMusicId = null;
      } catch (error) {
        log.error('Failed to stop music:', error);
      }
    }
  }

  /**
   * Pause background music
   */
  async pauseMusic(): Promise<void> {
    if (this.musicTrack) {
      try {
        await this.musicTrack.pauseAsync();
      } catch (error) {
        log.error('Failed to pause music:', error);
      }
    }
  }

  /**
   * Resume background music
   */
  async resumeMusic(): Promise<void> {
    if (this.musicTrack && this.enabled) {
      try {
        await this.musicTrack.playAsync();
      } catch (error) {
        log.error('Failed to resume music:', error);
      }
    }
  }

  /**
   * Stop all audio
   */
  async stopAll(): Promise<void> {
    // Stop all sound effects
    const stopPromises = Array.from(this.soundEffects.values()).map(sound =>
      sound.unloadAsync().catch(() => {})
    );
    await Promise.all(stopPromises);
    this.soundEffects.clear();

    // Stop music
    await this.stopMusic();
  }

  /**
   * Get current music ID
   */
  getCurrentMusicId(): string | null {
    return this.currentMusicId;
  }

  /**
   * Check if audio is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get current volumes
   */
  getVolumes(): { master: number; sfx: number; music: number } {
    return {
      master: this.masterVolume,
      sfx: this.sfxVolume,
      music: this.musicVolume,
    };
  }

  /**
   * Cleanup on app close
   */
  async cleanup(): Promise<void> {
    await this.stopAll();
  }
}

export const audioManager = AudioManager.getInstance();

