export interface CloudSave {
  state: any;
  updatedAt: number;
}

export interface LeaderboardEntry {
  name: string;
  score: number;
  category: string;
}

const API_URL = process.env.EXPO_PUBLIC_CLOUD_SAVE_URL;

export async function uploadGameState(save: CloudSave) {
  if (!API_URL) return;
  try {
    await fetch(`${API_URL}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(save),
    });
  } catch (err) {
    console.warn('cloud upload failed', err);
  }
}

export async function uploadLeaderboardScore(entry: LeaderboardEntry) {
  if (!API_URL) return;
  try {
    await fetch(`${API_URL}/leaderboard/${entry.category}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: entry.name, score: entry.score }),
    });
  } catch (err) {
    console.warn('leaderboard upload failed', err);
  }
}

export async function fetchLeaderboard(category: string): Promise<LeaderboardEntry[]> {
  if (!API_URL) return [];
  try {
    const res = await fetch(`${API_URL}/leaderboard/${category}`);
    if (!res.ok) return [];
    return (await res.json()) as LeaderboardEntry[];
  } catch (err) {
    console.warn('leaderboard fetch failed', err);
    return [];
  }
}

export async function downloadGameState(): Promise<CloudSave | null> {
  if (!API_URL) return null;
  try {
    const res = await fetch(`${API_URL}/save`);
    if (!res.ok) return null;
    return (await res.json()) as CloudSave;
  } catch (err) {
    console.warn('cloud download failed', err);
    return null;
  }
}
