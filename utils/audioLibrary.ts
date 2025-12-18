/**
 * Audio Library
 * 
 * Defines all sound effects and music tracks used in the game
 */

import { SoundEffect, MusicTrack } from './audioManager';

export const SOUND_EFFECTS: Record<string, SoundEffect> = {
  // UI Sounds
  buttonClick: {
    id: 'button_click',
    name: 'Button Click',
    volume: 0.3,
  },
  buttonHover: {
    id: 'button_hover',
    name: 'Button Hover',
    volume: 0.2,
  },
  modalOpen: {
    id: 'modal_open',
    name: 'Modal Open',
    volume: 0.4,
  },
  modalClose: {
    id: 'modal_close',
    name: 'Modal Close',
    volume: 0.4,
  },
  
  // Money & Economy
  moneyEarned: {
    id: 'money_earned',
    name: 'Money Earned',
    volume: 0.5,
  },
  moneySpent: {
    id: 'money_spent',
    name: 'Money Spent',
    volume: 0.4,
  },
  purchase: {
    id: 'purchase',
    name: 'Purchase',
    volume: 0.5,
  },
  sale: {
    id: 'sale',
    name: 'Sale',
    volume: 0.5,
  },
  
  // Achievements & Milestones
  achievement: {
    id: 'achievement',
    name: 'Achievement Unlocked',
    volume: 0.7,
  },
  levelUp: {
    id: 'level_up',
    name: 'Level Up',
    volume: 0.6,
  },
  milestone: {
    id: 'milestone',
    name: 'Milestone Reached',
    volume: 0.6,
  },
  
  // Career & Work
  jobComplete: {
    id: 'job_complete',
    name: 'Job Complete',
    volume: 0.5,
  },
  promotion: {
    id: 'promotion',
    name: 'Promotion',
    volume: 0.6,
  },
  
  // Relationships
  relationshipUp: {
    id: 'relationship_up',
    name: 'Relationship Improved',
    volume: 0.4,
  },
  relationshipDown: {
    id: 'relationship_down',
    name: 'Relationship Decreased',
    volume: 0.3,
  },
  
  // Health & Status
  healthUp: {
    id: 'health_up',
    name: 'Health Increased',
    volume: 0.4,
  },
  healthDown: {
    id: 'health_down',
    name: 'Health Decreased',
    volume: 0.3,
  },
  
  // Events
  eventPositive: {
    id: 'event_positive',
    name: 'Positive Event',
    volume: 0.5,
  },
  eventNegative: {
    id: 'event_negative',
    name: 'Negative Event',
    volume: 0.4,
  },
  
  // Travel
  travelStart: {
    id: 'travel_start',
    name: 'Travel Start',
    volume: 0.5,
  },
  travelComplete: {
    id: 'travel_complete',
    name: 'Travel Complete',
    volume: 0.4,
  },
  
  // Error & Warning
  error: {
    id: 'error',
    name: 'Error',
    volume: 0.5,
  },
  warning: {
    id: 'warning',
    name: 'Warning',
    volume: 0.4,
  },
  success: {
    id: 'success',
    name: 'Success',
    volume: 0.6,
  },
};

export const MUSIC_TRACKS: Record<string, MusicTrack> = {
  // Background Music
  mainTheme: {
    id: 'main_theme',
    name: 'Main Theme',
    volume: 0.4,
    loop: true,
  },
  menu: {
    id: 'menu',
    name: 'Menu Music',
    volume: 0.3,
    loop: true,
  },
  gameplay: {
    id: 'gameplay',
    name: 'Gameplay Music',
    volume: 0.35,
    loop: true,
  },
  peaceful: {
    id: 'peaceful',
    name: 'Peaceful Ambience',
    volume: 0.3,
    loop: true,
  },
  energetic: {
    id: 'energetic',
    name: 'Energetic Theme',
    volume: 0.4,
    loop: true,
  },
  success: {
    id: 'success_music',
    name: 'Success Theme',
    volume: 0.5,
    loop: false,
  },
};

/**
 * Get sound effect by ID
 */
export function getSoundEffect(id: string): SoundEffect | undefined {
  return SOUND_EFFECTS[id];
}

/**
 * Get music track by ID
 */
export function getMusicTrack(id: string): MusicTrack | undefined {
  return MUSIC_TRACKS[id];
}

/**
 * Get all sound effect IDs
 */
export function getAllSoundEffectIds(): string[] {
  return Object.keys(SOUND_EFFECTS);
}

/**
 * Get all music track IDs
 */
export function getAllMusicTrackIds(): string[] {
  return Object.keys(MUSIC_TRACKS);
}

