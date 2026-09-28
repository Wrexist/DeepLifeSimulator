/** Cosmetic mapping only. Never rename saved videos, games or stream categories. */
export type MediaArtKey = 'chat' | 'rpg' | 'competitive' | 'creative' | 'speedrun';

export const MEDIA_ART_NAMES: Record<MediaArtKey, string> = {
  chat: 'After Hours', rpg: 'Lantern Isles', competitive: 'Relay Arena',
  creative: 'Pocket Borough', speedrun: 'Rooftop Rush',
};

// Existing category IDs remain intact, including the historical fps/chat ID.
export const STREAM_ART_KEYS: Record<string, MediaArtKey> = {
  fps: 'chat', rpg: 'rpg', esports: 'competitive', creative: 'creative', speedrun: 'speedrun',
};

const fallbackOrder: MediaArtKey[] = ['speedrun', 'creative', 'competitive', 'rpg', 'chat'];

export function mediaArtForTopic(topic: string): MediaArtKey | undefined {
  const name = (topic || '').toLowerCase();
  // Legacy names resolve to original artwork without rewriting the saved text.
  if (/\b(valorant|competitive|compet|fps|esports?|relay)\b/.test(name)) return 'competitive';
  if (/\b(among|chat|chatting|reaction|after hours)\b/.test(name)) return 'chat';
  if (/\b(minecraft|craft|creative|art|tutorial|pocket borough)\b/.test(name)) return 'creative';
  if (/\b(league|legends|lol|rpg|moba|boss|lore|lantern)\b/.test(name)) return 'rpg';
  if (/\b(fortnite|speedrun|speed|run|race|rooftop)\b/.test(name)) return 'speedrun';
  return undefined;
}

export function videoArtKey(video: { id?: string; title?: string; game?: string; gameId?: string }): MediaArtKey {
  const match = mediaArtForTopic(`${video.title ?? ''} ${video.game ?? ''} ${video.gameId ?? ''}`);
  if (match) return match;
  let hash = 0;
  const seed = video.id || video.title || 'x';
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return fallbackOrder[Math.abs(hash) % fallbackOrder.length];
}
