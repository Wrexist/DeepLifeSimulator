/**
 * The two providers' own logic, as far as it can be reached without a network
 * or a GPU.
 *
 * These are the paths that will meet reality first — somebody else's JSON, and
 * a photograph of an actual person — and they are the paths a harness cannot
 * exercise. What can be tested is how they behave when the input is not what
 * was hoped for, which is the interesting half.
 */

import { nearestPaletteIndex, looksLikeSkin } from '../providers/onDeviceProvider';
import { SKIN_TONES, HAIR_COLORS } from '@/lib/identity';

describe('colour matching', () => {
  it('puts each palette swatch nearest to itself', () => {
    // The identity check. If a palette entry does not match its own colour, the
    // metric is wrong in a way that no eyeballing of one photo would reveal.
    for (const palette of [SKIN_TONES, HAIR_COLORS]) {
      for (let i = 0; i < palette.length; i++) {
        const v = parseInt(palette[i].slice(1), 16);
        const rgb = { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
        expect(nearestPaletteIndex(palette, rgb)).toBe(i);
      }
    }
  });

  it('keeps deep tones deep and pale tones pale', () => {
    // The failure that matters: a metric dominated by hue can answer a very
    // dark face with a mid swatch, which is a face that is not the player's.
    const deep = nearestPaletteIndex(SKIN_TONES, { r: 62, g: 38, b: 26 });
    const pale = nearestPaletteIndex(SKIN_TONES, { r: 244, g: 214, b: 196 });
    expect(deep).toBeGreaterThan(SKIN_TONES.length - 4);
    expect(pale).toBeLessThan(3);
    expect(deep).toBeGreaterThan(pale);
  });

  it('orders the whole tone ramp monotonically', () => {
    // Walking from light to dark should walk down the palette, not jump about.
    const ramp = [230, 200, 170, 140, 110, 80, 55].map((v) => ({ r: v, g: v * 0.78, b: v * 0.64 }));
    const picked = ramp.map((c) => nearestPaletteIndex(SKIN_TONES, c));
    for (let i = 1; i < picked.length; i++) expect(picked[i]).toBeGreaterThanOrEqual(picked[i - 1]);
  });

  it('rejects the things a face region is not', () => {
    expect(looksLikeSkin({ r: 200, g: 160, b: 130 })).toBe(true);
    // Blown-out highlight, deep shadow, and a blue wall.
    expect(looksLikeSkin({ r: 252, g: 251, b: 250 })).toBe(false);
    expect(looksLikeSkin({ r: 8, g: 7, b: 9 })).toBe(false);
    expect(looksLikeSkin({ r: 60, g: 110, b: 200 })).toBe(false);
  });
});

describe('cloud provider responses', () => {
  const ORIGINAL_FETCH = global.fetch;
  const LANDMARKS = Array.from({ length: 68 }, (_, i) => ({ x: i * 3, y: i * 2 }));

  /** Load the provider with the env it reads at module scope. */
  function load(): typeof import('../providers/avaturnProvider') {
    jest.resetModules();
    process.env.EXPO_PUBLIC_AVATAR_API_URL = 'https://vendor.test';
    process.env.EXPO_PUBLIC_AVATAR_API_KEY = 'k';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../providers/avaturnProvider');
  }

  const reply = (status: number, body: unknown): Response =>
    ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
    delete process.env.EXPO_PUBLIC_AVATAR_API_URL;
    delete process.env.EXPO_PUBLIC_AVATAR_API_KEY;
  });

  it('is unavailable without both a URL and a key', () => {
    jest.resetModules();
    delete process.env.EXPO_PUBLIC_AVATAR_API_URL;
    delete process.env.EXPO_PUBLIC_AVATAR_API_KEY;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bare = require('../providers/avaturnProvider') as typeof import('../providers/avaturnProvider');
    expect(bare.avaturnProvider.isAvailable()).toBe(false);
  });

  it('accepts a synchronous response', async () => {
    const { avaturnProvider } = load();
    global.fetch = jest.fn(async () =>
      reply(200, { status: 'succeeded', landmarks: LANDMARKS, skinTone: 4, confidence: 0.91 })) as never;
    const analysis = await avaturnProvider.analyse(
      { uri: 'file:///a.jpg', width: 1, height: 1 },
      { base: {} as never },
    );
    expect(analysis.landmarks).toHaveLength(68);
    expect(analysis.skinTone).toBe(4);
  });

  it('accepts landmarks as [x, y] pairs, which half the world sends', async () => {
    const { avaturnProvider } = load();
    global.fetch = jest.fn(async () =>
      reply(200, { status: 'succeeded', landmarks: LANDMARKS.map((p) => [p.x, p.y]) })) as never;
    const analysis = await avaturnProvider.analyse(
      { uri: 'file:///a.jpg', width: 1, height: 1 },
      { base: {} as never },
    );
    expect(analysis.landmarks?.[7]).toEqual({ x: 21, y: 14 });
  });

  it('treats a result with no landmarks as a failure worth retrying elsewhere', async () => {
    // A "cloud" answer that matched only hair colour is indistinguishable from
    // the free on-device one while costing money — so it is not an answer.
    const { avaturnProvider } = load();
    global.fetch = jest.fn(async () => reply(200, { status: 'succeeded', skinTone: 2 })) as never;
    await expect(
      avaturnProvider.analyse({ uri: 'file:///a.jpg', width: 1, height: 1 }, { base: {} as never }),
    ).rejects.toMatchObject({ code: 'unsupported', retryable: true });
  });

  it('maps the vendor vocabulary onto messages the player can act on', async () => {
    const cases: [number, unknown, string, boolean][] = [
      [401, {}, 'unauthorized', true],
      [429, {}, 'rate_limited', true],
      [422, { error: 'no_face_detected' }, 'no_face', false],
      [422, { error: 'multiple faces in image' }, 'multiple_faces', false],
      [422, { error: 'image too dark' }, 'too_dark', false],
      [422, { error: 'face occluded by sunglasses' }, 'obscured', false],
      [500, {}, 'unknown', true],
    ];
    for (const [status, body, code, retryable] of cases) {
      const { avaturnProvider } = load();
      global.fetch = jest.fn(async () => reply(status, body)) as never;
      await expect(
        avaturnProvider.analyse({ uri: 'file:///a.jpg', width: 1, height: 1 }, { base: {} as never }),
      ).rejects.toMatchObject({ code, retryable });
    }
  });

  it('reports a network failure as retryable rather than as the photo\'s fault', async () => {
    const { avaturnProvider } = load();
    global.fetch = jest.fn(async () => { throw new TypeError('Network request failed'); }) as never;
    await expect(
      avaturnProvider.analyse({ uri: 'file:///a.jpg', width: 1, height: 1 }, { base: {} as never }),
    ).rejects.toMatchObject({ code: 'network', retryable: true });
  });

  it('stops immediately when the caller aborts', async () => {
    const { avaturnProvider } = load();
    const controller = new AbortController();
    global.fetch = jest.fn(async () => {
      controller.abort();
      const e = new Error('aborted');
      e.name = 'AbortError';
      throw e;
    }) as never;
    await expect(
      avaturnProvider.analyse(
        { uri: 'file:///a.jpg', width: 1, height: 1 },
        { base: {} as never, signal: controller.signal },
      ),
      // Matched on `code`, not `instanceof`: `jest.resetModules()` gives the
      // reloaded provider its own copy of the error class, so the two are
      // structurally identical and referentially different. Production has one
      // module registry and no such split.
    ).rejects.toMatchObject({ code: 'cancelled', retryable: false });
  });

  it('reports real progress from the vendor rather than a timer', async () => {
    const { avaturnProvider } = load();
    let call = 0;
    global.fetch = jest.fn(async () => {
      call += 1;
      if (call === 1) return reply(200, { jobId: 'j1', status: 'running' });
      if (call === 2) return reply(200, { status: 'running', progress: 40 });
      return reply(200, { status: 'succeeded', result: { landmarks: LANDMARKS } });
    }) as never;

    const seen: number[] = [];
    await avaturnProvider.analyse(
      { uri: 'file:///a.jpg', width: 1, height: 1 },
      { base: {} as never, onProgress: (p) => seen.push(p.progress) },
    );
    // Monotonic, ends at 1, and includes the value the vendor reported rather
    // than a value this code invented.
    expect(seen[seen.length - 1]).toBe(1);
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
    expect(seen.some((v) => v > 0.4 && v < 0.7)).toBe(true);
  }, 15000);
});
