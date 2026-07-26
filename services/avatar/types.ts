/**
 * The selfie-to-avatar contract.
 *
 * ## Why an interface and not just an Avaturn client
 *
 * The photo-to-avatar market moves fast and prices move with it. Every screen
 * in this flow talks to `AvatarService`, and `AvatarService` talks to whichever
 * `AvatarProvider` is configured — so swapping vendor, adding a second one as a
 * fallback, or moving the whole thing on-device later is a change to one file
 * in `providers/` and nothing else. No component imports a provider, and no
 * provider imports a component.
 *
 * The seam is drawn at LANDMARKS AND COLOURS rather than at "a finished
 * avatar", because that is the level our own rig speaks. A provider's job is to
 * look at a photograph and report what it found; turning that into a face is
 * `lib/identity/faceMeasures.ts`, which every provider shares. A provider that
 * returned a finished GLB would be the awkward one to add, not the easy one.
 *
 * ## Progress is real
 *
 * `onProgress` is driven by the provider's own state — upload bytes, poll
 * responses, decode steps — never by a timer counting to a hundred. A fake
 * progress bar that finishes early and then sits at 99% is the single most
 * common tell that a "processing" screen is theatre, and players read it
 * instantly.
 */

import type { FaceGenome } from '@/lib/identity';
import type { Landmark2D } from '@/lib/identity/faceMeasures';

/**
 * The stages a player sees, in order.
 *
 * Named rather than numeric so a provider that cannot do one of them (no
 * landmarks, say) simply never reports it, and the UI shows a shorter list
 * instead of a step that silently never ticks.
 */
export const AVATAR_STAGES = [
  'detecting',
  'geometry',
  'proportions',
  'skinTone',
  'eyes',
  'hair',
  'finishing',
] as const;

export type AvatarStage = (typeof AVATAR_STAGES)[number];

export interface AvatarProgress {
  stage: AvatarStage;
  /** Overall completion, [0, 1]. Monotonic — the UI animates towards it. */
  progress: number;
}

/** What the player handed us. */
export interface PhotoInput {
  /** Local file URI from the picker or camera. */
  uri: string;
  width: number;
  height: number;
  /** MIME type when the picker knew it. */
  mimeType?: string;
}

/**
 * What a provider found in the photograph.
 *
 * Everything is optional because providers differ, and a provider that reports
 * only what it actually measured is worth more than one that fills the gaps
 * with plausible defaults — the difference shows up on the player's face, not
 * in the logs.
 */
export interface PhotoAnalysis {
  /** 68 iBUG landmarks in image pixel coordinates, origin top-left. */
  landmarks?: Landmark2D[];
  /** Index into `SKIN_TONES`. */
  skinTone?: number;
  /** Index into `HAIR_COLORS`. */
  hairColor?: number;
  /** Index into `EYE_COLORS`. */
  eyeColor?: number;
  hairStyle?: FaceGenome['hairStyle'];
  facialHair?: FaceGenome['facialHair'];
  /** The provider's own confidence, [0, 1], if it reports one. */
  confidence?: number;
}

export interface AvatarResult {
  genome: FaceGenome;
  analysis: PhotoAnalysis;
  /**
   * Which stages this run actually performed. The reveal screen reports these
   * honestly — "we matched your colouring" is a different promise from "we
   * matched your face", and claiming the second while doing the first is how a
   * feature earns one-star reviews.
   */
  performed: AvatarStage[];
  /** Combined confidence, [0, 1]. */
  confidence: number;
  /** Provider id, for analytics and for the "how was this made" line. */
  providerId: string;
}

export class AvatarError extends Error {
  constructor(
    message: string,
    /** Stable code for analytics and for choosing the player-facing message. */
    readonly code:
      | 'no_face'
      | 'multiple_faces'
      | 'too_dark'
      | 'obscured'
      | 'network'
      | 'unauthorized'
      | 'rate_limited'
      | 'cancelled'
      | 'unsupported'
      | 'unknown',
    readonly retryable = true,
  ) {
    super(message);
    this.name = 'AvatarError';
  }
}

export interface GenerateOptions {
  /** The genome to refine. Anything the analysis does not speak to is kept. */
  base: FaceGenome;
  onProgress?: (p: AvatarProgress) => void;
  signal?: AbortSignal;
  /**
   * "Improve match": keep the player's chosen hair, colours and facial hair and
   * refit only the face shape. Without this, a second attempt throws away every
   * choice they made after the first, which nobody presses twice.
   */
  faceOnly?: boolean;
}

export interface AvatarProvider {
  readonly id: string;
  /** Shown in the UI, e.g. "Cloud model" or "On-device". */
  readonly label: string;
  /**
   * Stages this provider can perform. Drives which steps the processing screen
   * lists, so it never shows a tick that will not arrive.
   */
  readonly capabilities: readonly AvatarStage[];
  /** False when the provider is missing credentials or a native module. */
  isAvailable(): boolean;
  analyse(photo: PhotoInput, options: GenerateOptions): Promise<PhotoAnalysis>;
}
