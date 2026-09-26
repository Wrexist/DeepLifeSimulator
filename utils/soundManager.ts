import type { AudioPlayer, AudioSource } from 'expo-audio';
import { logger } from '@/utils/logger';

// Optional on older signed binaries. Never import a new native module at startup.
type AudioBackend = typeof import('expo-audio');
const sources: Record<string, AudioSource> = {
  button_click: require('@/assets/audio/button_click.wav'),
  success: require('@/assets/audio/success.wav'),
  error: require('@/assets/audio/error.wav'),
  notification: require('@/assets/audio/notification.wav'),
  money: require('@/assets/audio/money.wav'),
  level_up: require('@/assets/audio/level_up.wav'),
  week: require('@/assets/audio/week.wav'),
};
const volume = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

export class SoundManager {
  private enabled = false; // The mounted settings bridge opts in after loading the save.
  private backend: AudioBackend | null = null;
  private initialization: Promise<void> | null = null;
  private sounds = new Map<string, AudioPlayer>();
  private busy = new Set<string>();
  private lastPlayed = new Map<string, number>();
  private backgroundMusic: AudioPlayer | null = null;
  private masterVolume = 0.65;
  private sfxVolume = 0.65;
  private musicVolume = 0.3;
  private epoch = 0;

  initialize(): Promise<void> {
    if (this.initialization) return this.initialization;
    this.initialization = (async () => {
      try {
        const backend: AudioBackend = require('expo-audio');
        await backend.setAudioModeAsync({ playsInSilentMode: false, shouldPlayInBackground: false, allowsRecording: false, interruptionMode: 'mixWithOthers' });
        this.backend = backend;
        for (const [id, source] of Object.entries(sources)) await this.loadSound(id, source);
      } catch (error) {
        this.backend = null;
        logger.warn('Audio unavailable on this build; gameplay continues silently', { error });
      }
    })();
    return this.initialization;
  }

  async loadSound(id: string, source: AudioSource): Promise<void> {
    if (!this.backend) return;
    await this.unloadSound(id);
    const player = this.backend.createAudioPlayer(source);
    player.volume = this.masterVolume * this.sfxVolume;
    this.sounds.set(id, player);
  }

  async playSound(id: string): Promise<void> {
    if (!this.enabled || this.busy.has(id)) return;
    // Tiny rate limit avoids stacked clicks / overlapping reward fanfare.
    const now = Date.now();
    if (now - (this.lastPlayed.get(id) ?? -Infinity) < 120) return;
    const epoch = this.epoch;
    this.busy.add(id);
    try {
      await this.initialize();
      const player = this.sounds.get(id);
      if (!player || !this.enabled || epoch !== this.epoch) return;
      await player.seekTo(0);
      if (!this.enabled || epoch !== this.epoch) return;
      player.volume = this.masterVolume * this.sfxVolume;
      player.play();
      this.lastPlayed.set(id, now);
    } catch (error) { logger.debug('Sound playback unavailable', { error }); }
    finally { this.busy.delete(id); }
  }

  async unloadSound(id: string): Promise<void> {
    const player = this.sounds.get(id);
    this.sounds.delete(id);
    try { player?.remove(); } catch { /* A released native player is harmless. */ }
  }
  async unloadAllSounds(): Promise<void> {
    this.epoch++;
    for (const id of this.sounds.keys()) await this.unloadSound(id);
    await this.stopBackgroundMusic();
    this.initialization = null;
  }
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.epoch++;
      for (const player of this.sounds.values()) { try { player.pause(); } catch { /* Already released. */ } }
      try { this.backgroundMusic?.pause(); } catch { /* Already released. */ }
    }
  }
  isSoundEnabled(): boolean { return this.enabled; }
  private updateVolumes(): void {
    for (const player of this.sounds.values()) player.volume = this.masterVolume * this.sfxVolume;
    if (this.backgroundMusic) this.backgroundMusic.volume = this.masterVolume * this.musicVolume;
  }
  setMasterVolume(value: number): void { this.masterVolume = volume(value); this.updateVolumes(); }
  getMasterVolume(): number { return this.masterVolume; }
  setSfxVolume(value: number): void { this.sfxVolume = volume(value); this.updateVolumes(); }
  getSfxVolume(): number { return this.sfxVolume; }
  setMusicVolume(value: number): void { this.musicVolume = volume(value); this.updateVolumes(); }
  getMusicVolume(): number { return this.musicVolume; }
  setVolume(value: number): void { this.setMasterVolume(value); }
  getVolume(): number { return this.masterVolume; }
  applyVolumeSettings(settings: { masterVolume?: number; sfxVolume?: number; musicVolume?: number }): void {
    if (settings.masterVolume !== undefined) this.masterVolume = volume(settings.masterVolume);
    if (settings.sfxVolume !== undefined) this.sfxVolume = volume(settings.sfxVolume);
    if (settings.musicVolume !== undefined) this.musicVolume = volume(settings.musicVolume);
    this.updateVolumes();
  }
  async playBackgroundMusic(source: AudioSource, loop = true): Promise<void> {
    const epoch = this.epoch;
    await this.initialize();
    await this.stopBackgroundMusic();
    if (!this.enabled || !this.backend || epoch !== this.epoch) return;
    this.backgroundMusic = this.backend.createAudioPlayer(source);
    this.backgroundMusic.loop = loop;
    this.backgroundMusic.volume = this.masterVolume * this.musicVolume;
    this.backgroundMusic.play();
  }
  async stopBackgroundMusic(): Promise<void> {
    try { this.backgroundMusic?.remove(); } finally { this.backgroundMusic = null; }
  }
  async setBackgroundMusicVolume(value: number): Promise<void> { this.setMusicVolume(value); }
  async playButtonClick(): Promise<void> { await this.playSound('button_click'); }
  async playSuccess(): Promise<void> { await this.playSound('success'); }
  async playError(): Promise<void> { await this.playSound('error'); }
  async playNotification(): Promise<void> { await this.playSound('notification'); }
  async playMoney(): Promise<void> { await this.playSound('money'); }
  async playLevelUp(): Promise<void> { await this.playSound('level_up'); }
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
export const playBackgroundMusic = (source: AudioSource, loop?: boolean): Promise<void> => soundManager.playBackgroundMusic(source, loop);
export const stopBackgroundMusic = (): Promise<void> => soundManager.stopBackgroundMusic();
export const setBackgroundMusicVolume = (volume: number): Promise<void> => soundManager.setBackgroundMusicVolume(volume);
