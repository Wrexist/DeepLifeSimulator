/**
 * The service's two jobs: choose a provider, and describe honestly what it did.
 *
 * The second is the one worth testing. `performed` and `confidence` are what
 * the reveal screen uses to decide between "This looks like you" and "We
 * matched your colouring" — so a bug that reports geometry when no landmarks
 * came back does not crash anything, it just tells a paying player we captured
 * their face when we captured their hair colour. That is the failure this file
 * exists to prevent.
 */

import { AvatarError, type AvatarProvider, type PhotoAnalysis } from '../types';
import { neutralMorphs, randomizeFace, type FaceGenome } from '@/lib/identity';
import fixture from '@/lib/identity/__tests__/fixtures/meanFaceLandmarks.json';

jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

const cloud = { available: true, analyse: jest.fn() };
const onDevice = { available: true, analyse: jest.fn() };

jest.mock('../providers/avaturnProvider', () => ({
  avaturnProvider: {
    id: 'cloud',
    label: 'Cloud model',
    capabilities: ['detecting', 'geometry', 'proportions', 'skinTone', 'eyes', 'hair', 'finishing'],
    isAvailable: () => cloud.available,
    analyse: (...args: unknown[]) => cloud.analyse(...args),
  } satisfies AvatarProvider,
}));

jest.mock('../providers/onDeviceProvider', () => ({
  onDeviceProvider: {
    id: 'on-device',
    label: 'On-device match',
    capabilities: ['detecting', 'skinTone', 'hair', 'finishing'],
    isAvailable: () => onDevice.available,
    analyse: (...args: unknown[]) => onDevice.analyse(...args),
  } satisfies AvatarProvider,
}));

// Imported after the mocks so the service picks them up.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const service = require('../AvatarService') as typeof import('../AvatarService');

const LANDMARKS = fixture.points;

const photo = { uri: 'file:///selfie.jpg', width: 1024, height: 1024 };

function baseGenome(): FaceGenome {
  return { ...randomizeFace('avatar-service'), morphs: neutralMorphs() };
}

beforeEach(() => {
  cloud.available = true;
  onDevice.available = true;
  cloud.analyse.mockReset();
  onDevice.analyse.mockReset();
});

describe('provider selection', () => {
  it('prefers the higher-quality provider and does not run the fallback', async () => {
    cloud.analyse.mockResolvedValue({ landmarks: LANDMARKS, confidence: 0.9 } satisfies PhotoAnalysis);
    const result = await service.generateFromPhoto(photo, { base: baseGenome() });
    expect(result.providerId).toBe('cloud');
    expect(onDevice.analyse).not.toHaveBeenCalled();
  });

  it('falls through to the next provider on a retryable failure', async () => {
    // Being offline is not a reason to give up: the on-device match needs no
    // network and is better than an error screen.
    cloud.analyse.mockRejectedValue(new AvatarError('offline', 'network', true));
    onDevice.analyse.mockResolvedValue({ skinTone: 3, confidence: 0.35 } satisfies PhotoAnalysis);
    const result = await service.generateFromPhoto(photo, { base: baseGenome() });
    expect(result.providerId).toBe('on-device');
  });

  it('does NOT fall through when the photo itself is the problem', async () => {
    // No face in the picture means no face for anyone. Trying the next provider
    // only makes the player wait longer for the same answer.
    cloud.analyse.mockRejectedValue(new AvatarError('no face', 'no_face', false));
    await expect(service.generateFromPhoto(photo, { base: baseGenome() })).rejects.toMatchObject({
      code: 'no_face',
    });
    expect(onDevice.analyse).not.toHaveBeenCalled();
  });

  it('reports the stages of the provider that will actually run', async () => {
    expect(service.plannedStages()).toContain('geometry');
    cloud.available = false;
    // The on-device provider cannot find landmarks, so the processing screen
    // must not offer to map facial geometry — a step that never ticks is worse
    // than a shorter list.
    expect(service.plannedStages()).not.toContain('geometry');
    expect(service.isPhotoAvatarSupported()).toBe(true);
    onDevice.available = false;
    expect(service.isPhotoAvatarSupported()).toBe(false);
  });

  it('fails cleanly when nothing can run', async () => {
    cloud.available = false;
    onDevice.available = false;
    await expect(service.generateFromPhoto(photo, { base: baseGenome() })).rejects.toMatchObject({
      code: 'unsupported',
      retryable: false,
    });
  });
});

describe('what the run claims to have done', () => {
  it('claims geometry only when landmarks came back', async () => {
    cloud.analyse.mockResolvedValue({ landmarks: LANDMARKS, confidence: 0.9 } satisfies PhotoAnalysis);
    const withFace = await service.generateFromPhoto(photo, { base: baseGenome() });
    expect(withFace.performed).toContain('geometry');

    cloud.analyse.mockResolvedValue({ skinTone: 2, hairColor: 1, confidence: 0.4 } satisfies PhotoAnalysis);
    const coloursOnly = await service.generateFromPhoto(photo, { base: baseGenome() });
    expect(coloursOnly.performed).not.toContain('geometry');
    expect(coloursOnly.performed).toContain('skinTone');
  });

  it('never reports more confidence than the weaker of the two judgements', async () => {
    // The provider is confident it found A face; the fitter judges whether the
    // measurements are plausible. A run is only as good as the weaker one.
    cloud.analyse.mockResolvedValue({
      landmarks: LANDMARKS.map((p, i) => ({ x: p.x + (i % 4) * 55, y: p.y + (i % 3) * 60 })),
      confidence: 1,
    } satisfies PhotoAnalysis);
    const result = await service.generateFromPhoto(photo, { base: baseGenome() });
    expect(result.confidence).toBeLessThan(1);
  });

  it('leaves the face untouched when the analysis found none', async () => {
    const base = baseGenome();
    base.morphs.jawWidth = 0.8;
    cloud.analyse.mockResolvedValue({ skinTone: 5 } satisfies PhotoAnalysis);
    const result = await service.generateFromPhoto(photo, { base });
    expect(result.genome.morphs.jawWidth).toBeCloseTo(0.8);
    expect(result.genome.skinTone).toBe(5);
  });
});

describe('faceOnly — the "Improve match" path', () => {
  it('refits the face and keeps every choice the player made after the first run', async () => {
    const base = baseGenome();
    base.skinTone = 7;
    base.hairColor = 9;
    base.hairStyle = 'pompadour';
    base.facialHair = 'goatee';

    cloud.analyse.mockResolvedValue({
      landmarks: LANDMARKS,
      skinTone: 0,
      hairColor: 0,
      hairStyle: 'buzz',
      facialHair: 'none',
      confidence: 0.9,
    } satisfies PhotoAnalysis);

    const result = await service.generateFromPhoto(photo, { base, faceOnly: true });
    expect(result.genome.skinTone).toBe(7);
    expect(result.genome.hairColor).toBe(9);
    expect(result.genome.hairStyle).toBe('pompadour');
    expect(result.genome.facialHair).toBe('goatee');
    expect(result.performed).toContain('geometry');
    expect(result.performed).not.toContain('skinTone');
  });
});

describe('provider output is untrusted', () => {
  it('clamps indexes a provider invents rather than passing them to the renderer', async () => {
    // An out-of-range palette index is a crash three screens later, where the
    // cause is invisible. Providers are somebody else's code.
    cloud.analyse.mockResolvedValue({
      skinTone: 9999,
      hairColor: -4,
      eyeColor: 42,
      confidence: 0.5,
    } as PhotoAnalysis);
    const result = await service.generateFromPhoto(photo, { base: baseGenome() });
    expect(result.genome.skinTone).toBeLessThan(20);
    expect(result.genome.skinTone).toBeGreaterThanOrEqual(0);
    expect(result.genome.hairColor).toBeGreaterThanOrEqual(0);
    expect(result.genome.eyeColor).toBeGreaterThanOrEqual(0);
  });

  it('ignores a hairstyle this build does not have', async () => {
    const base = baseGenome();
    base.hairStyle = 'short';
    cloud.analyse.mockResolvedValue({
      hairStyle: 'mullet-from-the-future' as never,
      confidence: 0.5,
    } satisfies PhotoAnalysis);
    const result = await service.generateFromPhoto(photo, { base });
    expect(result.genome.hairStyle).not.toBe('mullet-from-the-future');
  });
});

describe('cancellation', () => {
  it('does not start a provider once the caller has aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      service.generateFromPhoto(photo, { base: baseGenome(), signal: controller.signal }),
    ).rejects.toMatchObject({ code: 'cancelled' });
    expect(cloud.analyse).not.toHaveBeenCalled();
  });
});
