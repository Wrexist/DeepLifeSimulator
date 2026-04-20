/**
 * Life Story Generator
 *
 * Converts game state data (journal, eventLog, relationships, stats) into
 * a readable narrative "life story" that players can view and share.
 */

import { GameState, JournalEntry, Relationship } from '@/contexts/game/types';
import { WEEKS_PER_YEAR, ADULTHOOD_AGE } from '@/lib/config/gameConstants';

export interface StoryChapter {
  title: string;
  ageRange: string;
  paragraphs: string[];
}

export interface LifeStory {
  title: string;
  subtitle: string;
  chapters: StoryChapter[];
  summary: string;
}

// ---------------------------------------------------------------------------
// Age helpers
// ---------------------------------------------------------------------------

function weeksToAge(weeksLived: number): number {
  return Math.floor(ADULTHOOD_AGE + weeksLived / WEEKS_PER_YEAR);
}

function ageLabel(age: number): string {
  if (age < 25) return 'Early Twenties';
  if (age < 30) return 'Late Twenties';
  if (age < 40) return 'Thirties';
  if (age < 50) return 'Forties';
  if (age < 60) return 'Fifties';
  if (age < 70) return 'Sixties';
  return 'Golden Years';
}

// ---------------------------------------------------------------------------
// Narrative templates
// ---------------------------------------------------------------------------

function openingParagraph(state: GameState): string {
  const name = [state.userProfile?.firstName, state.userProfile?.lastName].filter(Boolean).join(' ') || state.userProfile?.name || 'Alex';
  const birthYear = Math.floor((state.date?.year || 2025) - (state.date?.age || 18));
  return `${name} was born in ${birthYear}, ready to take on the world. This is the story of their life.`;
}

function careerNarrative(events: GameState['eventLog']): string[] {
  const lines: string[] = [];
  const careerEvents = events.filter(e => e.category === 'career' || e.category === 'work');
  if (careerEvents.length === 0) return [];

  for (const ev of careerEvents.slice(0, 5)) {
    const age = weeksToAge(ev.weeksLived || 0);
    lines.push(`At age ${age}, ${ev.description} They chose to ${ev.choice.toLowerCase()}.`);
  }
  return lines;
}

function relationshipNarrative(relationships: Relationship[]): string[] {
  const lines: string[] = [];
  const partner = relationships?.find(r => r.type === 'spouse' || r.type === 'partner');
  const children = relationships?.filter(r => r.type === 'child') || [];

  if (partner) {
    const verb = partner.type === 'spouse' ? 'married' : 'fell in love with';
    lines.push(`They ${verb} ${partner.name}, a ${partner.personality?.toLowerCase() || 'wonderful'} person who changed their life.`);
  }

  if (children.length === 1) {
    lines.push(`They welcomed a child named ${children[0].name} into the family.`);
  } else if (children.length > 1) {
    const names = children.map(c => c.name).join(', ');
    lines.push(`They raised ${children.length} children: ${names}.`);
  }

  return lines;
}

function financialNarrative(state: GameState): string {
  const money = state.stats?.money || 0;
  const bankSavings = state.bankSavings || 0;
  const total = money + bankSavings;

  if (total > 10_000_000) return 'They amassed an extraordinary fortune, becoming one of the wealthiest people in the city.';
  if (total > 1_000_000) return 'Through hard work and smart decisions, they became a millionaire.';
  if (total > 100_000) return 'They built a comfortable nest egg, securing their financial future.';
  if (total > 10_000) return 'They managed their finances well, living a stable life.';
  return 'Money was always tight, but they found richness in other ways.';
}

function eventHighlights(events: GameState['eventLog']): string[] {
  const lines: string[] = [];
  const notable = events.filter(e =>
    e.effects?.money && (Math.abs(e.effects.money) > 5000) ||
    e.category === 'special' ||
    e.category === 'crime'
  ).slice(0, 6);

  for (const ev of notable) {
    const age = weeksToAge(ev.weeksLived || 0);
    lines.push(`At ${age}, ${ev.description}`);
  }
  return lines;
}

function journalHighlights(journal: JournalEntry[]): string[] {
  return journal.slice(-8).map(entry => {
    const age = weeksToAge(entry.atWeek || 0);
    return `At ${age}: ${entry.title}${entry.details ? ' — ' + entry.details : ''}`;
  });
}

function closingParagraph(state: GameState): string {
  const name = [state.userProfile?.firstName, state.userProfile?.lastName].filter(Boolean).join(' ') || state.userProfile?.name || 'Alex';
  const age = Math.floor(state.date?.age || ADULTHOOD_AGE);
  const karma = state.karma;

  let legacy = '';
  if (karma) {
    if (karma.score > 50) legacy = `, remembered for their kindness and generosity`;
    else if (karma.score > 20) legacy = `, known as an honest and loyal person`;
    else if (karma.score < -50) legacy = `, leaving behind a complicated legacy`;
    else if (karma.score < -20) legacy = `, with a reputation that preceded them`;
  }

  if (state.showDeathPopup) {
    return `${name} lived to the age of ${age}${legacy}. Their story may have ended, but the memories live on forever.`;
  }
  return `At ${age}, ${name}'s story continues to unfold${legacy}. The best chapters may still be ahead.`;
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

export function generateLifeStory(state: GameState): LifeStory {
  const name = [state.userProfile?.firstName, state.userProfile?.lastName].filter(Boolean).join(' ') || state.userProfile?.name || 'Alex';
  const age = Math.floor(state.date?.age || ADULTHOOD_AGE);
  const events = state.eventLog || [];
  const journal = state.journal || [];
  const relationships = state.relationships || [];

  // Group events into life phases
  const earlyEvents = events.filter(e => weeksToAge(e.weeksLived || 0) < 25);
  const midEvents = events.filter(e => {
    const a = weeksToAge(e.weeksLived || 0);
    return a >= 25 && a < 40;
  });
  const laterEvents = events.filter(e => weeksToAge(e.weeksLived || 0) >= 40);

  const chapters: StoryChapter[] = [];

  // Chapter 1: The Beginning
  chapters.push({
    title: 'The Beginning',
    ageRange: '18–24',
    paragraphs: [
      openingParagraph(state),
      ...careerNarrative(earlyEvents).slice(0, 2),
      ...(earlyEvents.length === 0 ? ['The early years were quiet, full of potential and possibility.'] : []),
    ],
  });

  // Chapter 2: Building a Life (if old enough)
  if (age >= 25) {
    const relLines = relationshipNarrative(relationships);
    const careerLines = careerNarrative(midEvents);
    chapters.push({
      title: 'Building a Life',
      ageRange: '25–39',
      paragraphs: [
        ...relLines,
        ...careerLines.slice(0, 3),
        financialNarrative(state),
        ...(relLines.length === 0 && careerLines.length === 0
          ? ['These years were spent finding direction and purpose.']
          : []),
      ],
    });
  }

  // Chapter 3: Milestones & Memories
  if (journal.length > 0 || events.length > 5) {
    const highlights = [
      ...eventHighlights(events),
      ...journalHighlights(journal),
    ];
    if (highlights.length > 0) {
      chapters.push({
        title: 'Milestones & Memories',
        ageRange: age >= 40 ? '40+' : `${Math.min(age, 25)}–${age}`,
        paragraphs: highlights.slice(0, 8),
      });
    }
  }

  // Chapter 4: Later Years (if applicable)
  if (age >= 40 && laterEvents.length > 0) {
    chapters.push({
      title: ageLabel(age),
      ageRange: '40+',
      paragraphs: [
        ...careerNarrative(laterEvents).slice(0, 2),
        ...eventHighlights(laterEvents).slice(0, 3),
      ].filter(Boolean),
    });
  }

  // Closing
  const closing = closingParagraph(state);

  return {
    title: `The Life of ${name}`,
    subtitle: `Age ${age} • ${state.date?.year || 2025}`,
    chapters: chapters.filter(ch => ch.paragraphs.length > 0),
    summary: closing,
  };
}

/**
 * Generate a compact shareable text version of the life story
 */
export function generateShareableStory(state: GameState): string {
  const story = generateLifeStory(state);
  const lines: string[] = [
    `📖 ${story.title}`,
    story.subtitle,
    '',
  ];

  for (const ch of story.chapters) {
    lines.push(`— ${ch.title} (${ch.ageRange}) —`);
    for (const p of ch.paragraphs.slice(0, 4)) {
      lines.push(p);
    }
    lines.push('');
  }

  lines.push(story.summary);
  lines.push('');
  lines.push('🎮 Deep Life Simulator');

  return lines.join('\n');
}
