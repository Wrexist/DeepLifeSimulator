// STUB: expo-av removed to fix TurboModule crash
// AudioManager is now a no-op stub
import { logger } from './logger';

const log = logger.scope('AudioManager');

export interface SoundEffect {
  id: string;
  name: string;
  volume: number;
  loop?: boolean;
}

export interface MusicTrack {
  id: string;
  name: string;
  volume: number;
  loop?: boolean;
}

class AudioManager {
  private static instance: AudioManager;
  private masterVolume: number = 1.0;
  private sfxVolume: number = 1.0;
  private musicVolume: number = 1.0;
  private enabled: boolean = true;

  private constructor() {
    log.info('AudioManager initialized (stubbed - no audio)');
  }

  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
  }

  setSFXVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  async playSFX(soundId: string, volume?: number): Promise<void> {
    // No-op - audio disabled
    return Promise.resolve();
  }

  async playMusic(musicId: string, volume?: number): Promise<void> {
    // No-op - audio disabled
    return Promise.resolve();
  }

  stopSFX(soundId: string): void {
    // No-op
  }

  stopMusic(): void {
    // No-op
  }

  stopAll(): void {
    // No-op
  }

  pauseMusic(): void {
    // No-op
  }

  resumeMusic(): void {
    // No-op
  }

  async preloadSFX(soundEffects: SoundEffect[]): Promise<void> {
    // No-op
    return Promise.resolve();
  }

  async preloadMusic(musicTracks: MusicTrack[]): Promise<void> {
    // No-op
    return Promise.resolve();
  }

  unloadAll(): void {
    // No-op
  }
}

export default AudioManager;
