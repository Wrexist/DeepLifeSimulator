/**
 * Jealousy confrontation content — copy + choice set for the confrontation
 * modal that resolves a `SparkJealousyEvent`.
 *
 * "Content is data": the partner's accusation per trigger type and the response
 * choices (mapped to `SparkJealousyOutcome`) live here so the modal stays a thin
 * renderer. `resolveJealousy` (SparkActions) owns the numeric effects; this
 * module only supplies the words and which outcomes are offered.
 */
import type {
  SparkJealousyEvent,
  SparkJealousyOutcome,
} from '@/contexts/game/types';

export interface JealousyFlavor {
  /** Short modal title. */
  title: string;
  /** The partner's accusation — first-person, drives the scene. */
  accusation: string;
}

type TriggerType = SparkJealousyEvent['triggerType'];

const FLAVOR: Record<TriggerType, JealousyFlavor> = {
  spotted_swiping: {
    title: 'They saw you swiping',
    accusation: '"A friend swears they saw you on Spark last night. Are you seeing other people?"',
  },
  rumored_affair: {
    title: 'A rumor is going around',
    accusation: '"People are talking. They say you\'ve been getting close with someone else. Is it true?"',
  },
  multiple_dating: {
    title: 'Are you dating around?',
    accusation: '"Be honest with me - am I the only one you\'re seeing right now?"',
  },
  flirty_dm: {
    title: 'They read your DMs',
    accusation: '"I saw the messages. That did not read like just friends. Explain."',
  },
};

/** Resolve the accusation copy for a jealousy event's trigger type. */
export function getJealousyFlavor(triggerType: TriggerType): JealousyFlavor {
  return FLAVOR[triggerType] ?? FLAVOR.spotted_swiping;
}

/** Severity at/above which the partner's accusation takes a colder, harsher tone. */
export const JEALOUSY_SEVERE_TONE_SEVERITY = 60;

interface AccusationVariants {
  /** Hurt-but-measured lines (low/mid severity). */
  mild: string[];
  /** Colder / angrier lines that surface at high severity. */
  severe: string[];
}

/**
 * Per-trigger accusation variants, split by tone. Lines may contain `{partner}`,
 * interpolated with the jealous partner's name (a wounded, third-person
 * self-reference) so the confrontation reads personal instead of canned. This
 * replaces the single fixed accusation per trigger; `getJealousyFlavor` still
 * returns the stable default line for the title + fallback.
 */
const ACCUSATIONS: Record<TriggerType, AccusationVariants> = {
  spotted_swiping: {
    mild: [
      '"A friend swears they saw you on Spark last night. Are you seeing other people?"',
      '"Someone showed me your profile - still active. Want to explain that to {partner}?"',
      '"I didn\'t want to believe it, but they saw you swiping. Is it true?"',
    ],
    severe: [
      '"You\'re STILL on the apps? Don\'t insult {partner} by denying it."',
      '"Half the city has seen you swiping. How long did you think you\'d get away with it?"',
      '"I saw the screenshots myself. Do not lie to my face."',
    ],
  },
  rumored_affair: {
    mild: [
      '"People are talking. They say you\'ve been getting close with someone else. Is it true?"',
      '"Your name keeps coming up next to someone else\'s. What am I supposed to think?"',
      '"There\'s a rumor going around about you. Tell me it\'s nothing."',
    ],
    severe: [
      '"Everyone but {partner} seems to know what you\'ve been doing. Am I a fool for trusting you?"',
      '"The whole friend group is whispering. Were you ever going to tell me?"',
      '"I\'m done hearing it secondhand. Is there someone else - yes or no?"',
    ],
  },
  multiple_dating: {
    mild: [
      '"Be honest with me - am I the only one you\'re seeing right now?"',
      '"I need to hear it from you. Is there someone else in the picture?"',
      '"Is {partner} the only person on your mind, or not?"',
    ],
    severe: [
      '"Don\'t you dare lie. Am I one of several to you?"',
      '"{partner} deserves the truth. Are you juggling me with other people?"',
      '"I feel like an option, not a priority. Tell me the truth right now."',
    ],
  },
  flirty_dm: {
    mild: [
      '"I saw the messages. That did not read like just friends. Explain."',
      '"Those DMs were a little too warm. Want to tell {partner} what that was about?"',
      '"I read the thread. Friends don\'t talk like that. What\'s going on?"',
    ],
    severe: [
      '"I read every word. Is this who you are now - someone who lies to {partner}\'s face?"',
      '"Don\'t play dumb. Those messages were an affair in slow motion."',
      '"I know what I saw. Do not gaslight me about those DMs."',
    ],
  },
};

/**
 * Pick an accusation line for a jealousy event. Severity selects the tone band
 * (harsher at/above JEALOUSY_SEVERE_TONE_SEVERITY), `roll` (0..1) selects the
 * variant — live callers pass `Math.random()`, tests pass a fixed roll — and
 * `{partner}` is interpolated with the partner's name. Live-action only; never
 * called from the seeded tick.
 */
export function pickJealousyAccusation(
  triggerType: TriggerType,
  opts: { partnerName?: string; severity?: number; roll?: number } = {},
): string {
  const variants = ACCUSATIONS[triggerType] ?? ACCUSATIONS.spotted_swiping;
  const severe = (opts.severity ?? 0) >= JEALOUSY_SEVERE_TONE_SEVERITY;
  const band = severe && variants.severe.length > 0 ? variants.severe : variants.mild;
  const list = band.length > 0 ? band : [getJealousyFlavor(triggerType).accusation];
  const roll =
    typeof opts.roll === 'number' && isFinite(opts.roll) ? opts.roll : Math.random();
  const r = Math.max(0, Math.min(0.999999, roll));
  const line = list[Math.floor(r * list.length)] ?? list[0];
  const name = (opts.partnerName ?? '').trim() || 'your partner';
  return line.replace(/\{partner\}/g, name);
}

export interface JealousyChoice {
  outcome: SparkJealousyOutcome;
  /** Button label. */
  label: string;
  /** One-line consequence hint shown under the label. */
  hint: string;
  /** 'destructive' tints the choice as a heavy hit. */
  tone: 'neutral' | 'soft' | 'destructive';
}

const BASE_CHOICES: JealousyChoice[] = [
  { outcome: 'denied', label: 'Deny everything', hint: 'They stay skeptical', tone: 'neutral' },
  { outcome: 'admitted', label: 'Come clean', hint: 'Honest, but it stings', tone: 'soft' },
  { outcome: 'dismissed', label: 'Brush it off', hint: 'Dismisses their concern', tone: 'neutral' },
  { outcome: 'confronted', label: 'Turn it around', hint: 'Call them controlling', tone: 'neutral' },
];

/** Severity at/above which the "confess the affair" nuclear option appears. */
export const JEALOUSY_CONFESS_SEVERITY = 75;

/**
 * Choices offered for an event. Severity drives whether the heaviest outcome
 * (`caught_cheating`) is on the table — a low-severity swipe rumor shouldn't let
 * the player confess a full affair, but a high-severity one can.
 */
export function getJealousyChoices(severity: number): JealousyChoice[] {
  const choices = [...BASE_CHOICES];
  if (severity >= JEALOUSY_CONFESS_SEVERITY) {
    choices.push({
      outcome: 'caught_cheating',
      label: 'Confess the affair',
      hint: 'Devastating - may end things',
      tone: 'destructive',
    });
  }
  return choices;
}
