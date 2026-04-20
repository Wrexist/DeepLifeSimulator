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

  private constructor() {
    log.info('AudioManager initialized (stubbed - no audio)');
  }

  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  setMasterVolume(_volume: number): void {
    // No-op - audio disabled
  }

  setSFXVolume(_volume: number): void {
    // No-op - audio disabled
  }

  setMusicVolume(_volume: number): void {
    // No-op - audio disabled
  }

  setEnabled(_enabled: boolean): void {
    // No-op - audio disabled
  }

  async playSFX(_soundId: string, _volume?: number): Promise<void> {
    // No-op - audio disabled
    return Promise.resolve();
  }

  async playMusic(_musicId: string, _volume?: number): Promise<void> {
    // No-op - audio disabled
    return Promise.resolve();
  }

  stopSFX(_soundId: string): void {
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

  async preloadSFX(_soundEffects: SoundEffect[]): Promise<void> {
    // No-op
    return Promise.resolve();
  }

  async preloadMusic(_musicTracks: MusicTrack[]): Promise<void> {
    // No-op
    return Promise.resolve();
  }

  unloadAll(): void {
    // No-op
  }
}

export default AudioManager;
