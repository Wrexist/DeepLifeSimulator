/**
 * The one thing the UI talks to.
 *
 * Picks a provider, runs it, and turns whatever it found into a `FaceGenome`.
 * The turning-into-a-face part lives here rather than in each provider so that
 * adding a vendor is a network client and nothing more — no vendor gets to
 * invent its own idea of what a jaw-width slider means.
 *
 * Provider selection is ordered and falls through: the first available provider
 * wins, and a provider that throws a retryable error hands off to the next one
 * rather than failing the flow. In practice that means "cloud model if it is
 * configured and reachable, on-device match otherwise", and the player is told
 * which one ran instead of being quietly downgraded.
 */

import {
  normalizeGenome,
  HAIR_COLORS,
  SKIN_TONES,
  EYE_COLORS,
  type FaceGenome,
} from '@/lib/identity';
import { applyFitToGenome, landmarksToMorphs } from '@/lib/identity/faceMeasures';
import { track } from '@/lib/analytics';
import {
  AvatarError,
  type AvatarProvider,
  type AvatarResult,
  type AvatarStage,
  type GenerateOptions,
  type PhotoAnalysis,
  type PhotoInput,
} from './types';
import { avaturnProvider } from './providers/avaturnProvider';
import { onDeviceProvider } from './providers/onDeviceProvider';

/**
 * Ordered by likeness quality, not by cost.
 *
 * A player who paid for this expects the best match available; the on-device
 * provider is the floor, not the default. Adding a vendor means adding it to
 * this array in the right place — nothing else in the app changes.
 */
const PROVIDERS: AvatarProvider[] = [avaturnProvider, onDeviceProvider];

function clampIndex(value: number | undefined, length: number, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(length - 1, Math.round(value)));
}

/** Providers that could run right now, best first. */
export function availableProviders(): AvatarProvider[] {
  return PROVIDERS.filter((p) => p.isAvailable());
}

/** True when a selfie can be turned into anything at all on this device. */
export function isPhotoAvatarSupported(): boolean {
  return availableProviders().length > 0;
}

/**
 * The stages the processing screen should list for the provider that will run.
 *
 * Asked BEFORE the run so the checklist is right from the first frame. Showing
 * seven steps and ticking four is worse than showing four.
 */
export function plannedStages(): readonly AvatarStage[] {
  return availableProviders()[0]?.capabilities ?? [];
}

/** Turn a provider's findings into a face. */
function analysisToGenome(
  base: FaceGenome,
  analysis: PhotoAnalysis,
  faceOnly: boolean,
): { genome: FaceGenome; confidence: number; performed: AvatarStage[] } {
  const performed: AvatarStage[] = ['detecting'];
  let genome: FaceGenome = { ...base };
  let confidence = analysis.confidence ?? 0.5;

  if (analysis.landmarks && analysis.landmarks.length >= 68) {
    const fit = landmarksToMorphs(analysis.landmarks);
    if (fit.fitted.length > 0) {
      genome = applyFitToGenome(genome, fit);
      performed.push('geometry', 'proportions');
      // The provider's confidence in its detection and ours in the fit are
      // different questions; the run is only as good as the weaker one.
      confidence = Math.min(confidence, fit.confidence);
    }
  }

  if (!faceOnly) {
    if (analysis.skinTone !== undefined) {
      genome.skinTone = clampIndex(analysis.skinTone, SKIN_TONES.length, base.skinTone);
      performed.push('skinTone');
    }
    if (analysis.eyeColor !== undefined) {
      genome.eyeColor = clampIndex(analysis.eyeColor, EYE_COLORS.length, base.eyeColor);
      performed.push('eyes');
    }
    if (analysis.hairColor !== undefined || analysis.hairStyle !== undefined) {
      genome.hairColor = clampIndex(analysis.hairColor, HAIR_COLORS.length, base.hairColor);
      if (analysis.hairStyle) genome.hairStyle = analysis.hairStyle;
      performed.push('hair');
    }
    if (analysis.facialHair) genome.facialHair = analysis.facialHair;
  }

  performed.push('finishing');
  // normalizeGenome rather than a bare return: a provider is external code
  // and an out-of-range index or a hair style this build does not have would
  // otherwise reach the renderer and the save file.
  return { genome: normalizeGenome(genome), confidence, performed };
}

/**
 * Generate a face from a photograph.
 *
 * Throws `AvatarError` — the screens switch on `code` to choose their message,
 * because "no face found" and "you are offline" need different buttons.
 */
export async function generateFromPhoto(
  photo: PhotoInput,
  options: GenerateOptions,
): Promise<AvatarResult> {
  const usable = availableProviders();
  if (usable.length === 0) {
    throw new AvatarError('No avatar provider is configured', 'unsupported', false);
  }

  let lastError: AvatarError | null = null;
  for (const provider of usable) {
    if (options.signal?.aborted) throw new AvatarError('Cancelled', 'cancelled', false);
    try {
      const analysis = await provider.analyse(photo, options);
      const { genome, confidence, performed } = analysisToGenome(
        options.base,
        analysis,
        options.faceOnly === true,
      );
      track('avatar_photo_generated', {
        provider: provider.id,
        confidence: Math.round(confidence * 100),
        landmarks: analysis.landmarks?.length ?? 0,
        faceOnly: options.faceOnly === true,
      });
      return { genome, analysis, performed, confidence, providerId: provider.id };
    } catch (error) {
      const wrapped = error instanceof AvatarError
        ? error
        : new AvatarError(String((error as Error)?.message ?? error), 'unknown');
      // A photo with no face in it is not a provider problem, and trying the
      // next provider only makes the player wait longer for the same answer.
      if (!wrapped.retryable) throw wrapped;
      track('avatar_photo_provider_failed', { provider: provider.id, code: wrapped.code });
      lastError = wrapped;
    }
  }

  throw lastError ?? new AvatarError('Avatar generation failed', 'unknown');
}
