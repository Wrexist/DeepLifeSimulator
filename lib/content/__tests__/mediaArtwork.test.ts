import { mediaArtForTopic, videoArtKey, STREAM_ART_KEYS } from '../mediaArtwork';

test.each([
  ['Fortnite speedrun', 'speedrun'], ['Minecraft tutorial', 'creative'],
  ['Valorant match', 'competitive'], ['League of Legends', 'rpg'], ['Among Us', 'chat'],
  ['Just Chatting', 'chat'], ['RPG Marathon', 'rpg'], ['Competitive', 'competitive'],
  ['Creative / Art', 'creative'], ['Speedrun', 'speedrun'], ['Boss Fight', 'rpg'],
  ['Lore Deep Dive', 'rpg'], ['Reaction', 'chat'], ['Pocket Borough', 'creative'],
])('maps %s to the matching original artwork', (name, expected) => {
  expect(mediaArtForTopic(name)).toBe(expected);
});

test('preserves the legacy fps category as chat without confusing FPS content', () => {
  expect(STREAM_ART_KEYS.fps).toBe('chat');
  expect(mediaArtForTopic('FPS tournament')).toBe('competitive');
});

test('unknown old videos keep a deterministic cover without changing saved data', () => {
  const video = Object.freeze({ id: 'old-video-42', title: 'My old upload', game: 'Unknown' });
  const serialized = JSON.stringify(video);
  const key = videoArtKey(video);
  expect(['chat', 'rpg', 'competitive', 'creative', 'speedrun']).toContain(key);
  expect(videoArtKey(JSON.parse(serialized))).toBe(key);
  expect(videoArtKey({ ...video, title: 'Renamed upload' })).toBe(key);
  expect(JSON.stringify(video)).toBe(serialized);
  expect(videoArtKey({})).toBeDefined();
});

test('matches words rather than assigning art to unrelated title fragments', () => {
  expect(mediaArtForTopic('Party at the apartment')).toBeUndefined();
  expect(mediaArtForTopic('Minefield of decisions')).toBeUndefined();
});
