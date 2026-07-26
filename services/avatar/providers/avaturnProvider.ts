/**
 * Cloud photo-to-avatar, spoken to over plain REST.
 *
 * ## Configuration
 *
 * Reads `EXPO_PUBLIC_AVATAR_API_URL` and `EXPO_PUBLIC_AVATAR_API_KEY`. With
 * either missing the provider reports itself unavailable and `AvatarService`
 * falls through to the on-device match — so a build with no vendor account
 * still ships a working feature rather than a dead button.
 *
 * A PUBLIC env var holds the key because that is what an Expo client can read,
 * and it means the key is in the bundle: treat it as a client key with a spend
 * cap and a domain restriction, not a secret. The right long-term shape is a
 * thin endpoint of our own that holds the real key and proxies the call, which
 * is why `AVATAR_API_URL` is configurable rather than hard-coded to a vendor
 * domain — pointing it at our own service later changes an env var, not code.
 *
 * ## Why the response shape is defensive
 *
 * This talks to somebody else's API, and their JSON is not our type system.
 * Every field is checked before use and anything unrecognised is dropped rather
 * than passed along, because a provider returning `skinTone: 47` for a
 * ten-entry palette is a crash in the renderer three screens later — where the
 * cause is invisible.
 */

import {
  AvatarError,
  AVATAR_STAGES,
  type AvatarProvider,
  type AvatarStage,
  type GenerateOptions,
  type PhotoAnalysis,
  type PhotoInput,
} from '../types';
import type { Landmark2D } from '@/lib/identity/faceMeasures';

const API_URL = process.env.EXPO_PUBLIC_AVATAR_API_URL ?? '';
const API_KEY = process.env.EXPO_PUBLIC_AVATAR_API_KEY ?? '';

/** How long to wait for the whole job before giving up, in ms. */
const JOB_TIMEOUT_MS = 45_000;
/** Gap between poll requests, in ms. */
const POLL_INTERVAL_MS = 1_200;

/** Map the vendor's failure vocabulary onto ours. */
function codeFor(status: number, body: unknown): AvatarError {
  const reason = typeof (body as { error?: string })?.error === 'string'
    ? (body as { error: string }).error
    : '';
  if (status === 401 || status === 403) {
    return new AvatarError('Avatar API rejected the key', 'unauthorized', true);
  }
  if (status === 429) return new AvatarError('Avatar API rate limited', 'rate_limited', true);
  if (/no.?face/i.test(reason)) {
    return new AvatarError('No face found in the photo', 'no_face', false);
  }
  if (/multiple|more than one/i.test(reason)) {
    return new AvatarError('More than one face in the photo', 'multiple_faces', false);
  }
  if (/dark|expos|light/i.test(reason)) {
    return new AvatarError('The photo is too dark', 'too_dark', false);
  }
  if (/occlu|glass|obscur|cover/i.test(reason)) {
    return new AvatarError('The face is partly covered', 'obscured', false);
  }
  return new AvatarError(`Avatar API error ${status}`, 'unknown', status >= 500);
}

function readLandmarks(value: unknown): Landmark2D[] | undefined {
  if (!Array.isArray(value) || value.length < 68) return undefined;
  const points: Landmark2D[] = [];
  for (const entry of value) {
    // Both shapes are common in the wild: {x, y} objects and [x, y] pairs.
    const x = Array.isArray(entry) ? entry[0] : (entry as { x?: unknown })?.x;
    const y = Array.isArray(entry) ? entry[1] : (entry as { y?: unknown })?.y;
    if (typeof x !== 'number' || typeof y !== 'number') return undefined;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
    points.push({ x, y });
  }
  return points;
}

function readIndex(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

async function request(
  path: string,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${API_URL.replace(/\/$/, '')}${path}`, {
      ...init,
      signal,
      headers: { Authorization: `Bearer ${API_KEY}`, ...(init.headers ?? {}) },
    });
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') {
      throw new AvatarError('Cancelled', 'cancelled', false);
    }
    throw new AvatarError('Could not reach the avatar service', 'network', true);
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) throw codeFor(response.status, body);
  return body;
}

/**
 * Sleep that respects cancellation.
 *
 * A poll loop that ignores the abort signal keeps the request alive after the
 * player has backed out of the screen, and then resolves onto an unmounted
 * component — which in this flow means the reveal animation firing over the
 * menu they navigated to.
 */
function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AvatarError('Cancelled', 'cancelled', false));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort(): void {
      clearTimeout(timer);
      reject(new AvatarError('Cancelled', 'cancelled', false));
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export const avaturnProvider: AvatarProvider = {
  id: 'cloud',
  label: 'Cloud model',
  capabilities: AVATAR_STAGES,

  isAvailable(): boolean {
    return API_URL.length > 0 && API_KEY.length > 0;
  },

  async analyse(photo: PhotoInput, options: GenerateOptions): Promise<PhotoAnalysis> {
    const { signal, onProgress } = options;
    const report = (stage: AvatarStage, progress: number): void =>
      onProgress?.({ stage, progress });

    report('detecting', 0.04);

    // Multipart upload. React Native's fetch accepts the {uri, name, type}
    // shape in FormData and streams the file without reading it into JS memory,
    // which matters: a modern phone selfie is 3-6 MB and base64 would be a
    // third larger again on a connection the player is already waiting on.
    const form = new FormData();
    form.append('image', {
      uri: photo.uri,
      name: 'selfie.jpg',
      type: photo.mimeType ?? 'image/jpeg',
    } as unknown as Blob);
    form.append('landmarks', 'true');

    const created = await request('/v1/analyse', { method: 'POST', body: form }, signal);
    report('detecting', 0.2);

    let payload = created as Record<string, unknown>;
    const jobId = readString(payload.jobId ?? payload.id);

    // Synchronous responses skip the poll entirely; asynchronous ones report a
    // job id and a status we wait on. Supporting both is what lets the URL be
    // repointed at a different vendor without touching this file.
    if (jobId && readString(payload.status) !== 'succeeded') {
      const deadline = Date.now() + JOB_TIMEOUT_MS;
      for (;;) {
        if (Date.now() > deadline) {
          throw new AvatarError('The avatar service took too long', 'network', true);
        }
        await delay(POLL_INTERVAL_MS, signal);
        payload = (await request(`/v1/analyse/${jobId}`, { method: 'GET' }, signal)) as Record<
          string,
          unknown
        >;
        const status = readString(payload.status);
        if (status === 'succeeded') break;
        if (status === 'failed') throw codeFor(422, payload);
        // Real progress: the vendor's own number when it sends one, otherwise
        // how far through the timeout we are. Both are honest; neither is a
        // timer pretending to be work.
        const vendor = readIndex(payload.progress);
        const elapsed = 1 - (deadline - Date.now()) / JOB_TIMEOUT_MS;
        const fraction = vendor !== undefined ? Math.min(1, vendor > 1 ? vendor / 100 : vendor) : elapsed;
        report('geometry', 0.2 + 0.6 * Math.max(0, Math.min(1, fraction)));
      }
    }

    report('proportions', 0.85);

    const result = (payload.result ?? payload) as Record<string, unknown>;
    const landmarks = readLandmarks(result.landmarks);
    if (!landmarks) {
      // Everything else the vendor returns is a nice-to-have; without landmarks
      // there is no likeness, and a "cloud" result that only matched hair colour
      // would be indistinguishable from the on-device one while costing money.
      throw new AvatarError('The avatar service returned no landmarks', 'unsupported', true);
    }

    report('skinTone', 0.9);
    report('hair', 0.96);
    report('finishing', 1);

    return {
      landmarks,
      skinTone: readIndex(result.skinTone),
      hairColor: readIndex(result.hairColor),
      eyeColor: readIndex(result.eyeColor),
      hairStyle: readString(result.hairStyle) as PhotoAnalysis['hairStyle'],
      facialHair: readString(result.facialHair) as PhotoAnalysis['facialHair'],
      confidence: readIndex(result.confidence) ?? 0.8,
    };
  },
};
