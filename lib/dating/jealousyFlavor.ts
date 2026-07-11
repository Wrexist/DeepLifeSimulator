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
    accusation: '"Be honest with me — am I the only one you\'re seeing right now?"',
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
      hint: 'Devastating — may end things',
      tone: 'destructive',
    });
  }
  return choices;
}
