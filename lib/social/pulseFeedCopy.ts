import type { Relationship } from '@/contexts/game/types';

const EVERYDAY = [
  'The quiet seat on the bus is worth leaving five minutes early for.',
  'Made a list before going shopping. Left the list at home. A complete system.',
  'A walk with no destination is still a plan.',
  'Does anyone actually finish a notebook before buying the next one?',
  'Keeping one evening free this week. No errands, no catching up.',
  'Trying to repair things before replacing them. Starting with the easy drawer.',
  'The best part of cooking is having lunch sorted for tomorrow.',
  'There should be a loyalty card for remembering your reusable bag.',
];
const VOICES: Record<string, string[]> = {
  friendly: ['You do not need a special occasion to invite someone over.', 'If you are already making tea, make two cups.'],
  professional: ['A meeting with a clear ending time is a small act of kindness.', 'Leaving a useful handover for the next person. Future me appreciates those.'],
  extroverted: ['There is always room for one more chair at the table.', 'A five-minute conversation is still a conversation.'],
  caring: ['If you are having a difficult week, you can call without having a reason.', 'A proper meal and an early night. That is the advice.'],
  strict: ['A promise to yourself still counts as a promise.', 'Do the awkward little task before it becomes a whole afternoon.'],
  ambitious: ['One useful thing finished beats six impressive things started.', 'Trying to leave work at work. Apparently that takes practice too.'],
  creative: ['Keeping the rough draft. There is something in it that the tidy version lost.', 'A blank page looks less intimidating with a bad first sentence on it.'],
  introverted: ['Small plans this weekend. Very small. Quite excited about them.', 'You can enjoy the company and still need a quiet journey home.'],
  adventurous: ['Taking the longer route just to see where it goes.', 'My idea of a good plan leaves a little room to get lost.'],
  romantic: ['Remembering the small things is the whole point.', 'Time together does not have to be an occasion.'],
};

const recent = (stamp: number | undefined, week: number) =>
  typeof stamp === 'number' && Number.isFinite(stamp) && stamp <= week && week - stamp <= 1;

/** Authored copy grounded in recorded context; never creates an event or reward. */
export function contactPostCopy(r: Relationship, week: number, used: ReadonlySet<string> = new Set()): string | undefined {
  const context: string[] = [];
  if (recent(r.lastLifeEvent?.weeksLived, week)) {
    const event = r.lastLifeEvent?.event ?? '';
    if (event.includes('got a promotion at work')) context.push('Got the promotion. Still getting used to saying that out loud.');
    if (event.includes('received a bonus at work')) context.push('A bonus at work this week. Giving myself a moment before deciding what to do with it.');
    if (event.includes('picked up a new hobby')) context.push('New hobby, beginner mistakes. I think I needed something I could be bad at for a while.');
    if (event.includes('reconnected with an old friend')) context.push('Caught up with an old friend. We picked up in the middle of a conversation from years ago.');
  }
  if (recent(r.actions?.hangout, week)) context.push('Glad we made time to hang out. It did not need to be a big occasion.');
  if (recent(r.actions?.call, week)) context.push('That catch-up call was good. Some conversations are worth putting the rest of the day down for.');
  if (r.npcMood === 'stressed') context.push('Keeping the list short today. One thing, then the next.');
  if (r.npcMood === 'sad') context.push('A quieter week for me. Not much to say, but I am still here.');
  if (r.npcMood === 'angry') context.push('Writing the reply in my notes first. Sending it is a separate decision.');
  if (r.npcMood === 'happy') context.push('Nothing big to announce. Just enjoying how today feels.');
  const contextual = context.find(text => !used.has(text));
  if (contextual) return contextual;
  const choices = [...(VOICES[r.personality?.toLowerCase()] ?? []), ...EVERYDAY];
  const seed = Array.from(r.id).reduce((n, char) => (n * 31 + char.charCodeAt(0)) >>> 0, 0);
  const start = (seed + Math.max(0, Math.floor(week))) % choices.length;
  for (let i = 0; i < choices.length; i++) {
    const text = choices[(start + i) % choices.length];
    if (!used.has(text)) return text;
  }
  return undefined;
}
