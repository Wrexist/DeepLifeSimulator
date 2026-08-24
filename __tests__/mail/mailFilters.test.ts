/**
 * Finding a message.
 *
 * The tests that matter here are the ones about being WRONG rather than being
 * slow. A folder-scoped search does not fail to answer "did my bank really
 * write from that address?" — it answers it incorrectly, which in an app whose
 * fraud mechanic depends on the player trusting what it says about senders is
 * worse than having no search. Same shape for the bin: a delete that takes more
 * than the player was looking at is not an inconvenience.
 */

import { createTestGameState } from '../helpers/createTestGameState';
import {
  FILTER_LABELS,
  MAIL_FILTERS,
  decisionDeadline,
  filterCounts,
  folderCounts,
  matchesFilter,
  needsReply,
  pendingDecisions,
  searchMessages,
} from '@/lib/mail/filters';
import { emptyMailBin } from '@/contexts/game/actions/MailActions';
import { getMailState } from '@/lib/mail/state';
import type { GameState, MailFolder, MailMessage } from '@/contexts/game/types';

function harness(initial: GameState) {
  let state = initial;
  return {
    setGameState: (u: (prev: GameState) => GameState) => {
      state = u(state);
    },
    get: () => state,
  };
}

const message = (over: Partial<MailMessage> = {}): MailMessage => ({
  id: 'm-1',
  senderName: 'DeepLife Bank',
  senderEmail: 'no-reply@deeplifebank.com',
  subject: 'Statement',
  preview: 'Your statement is ready.',
  body: 'Attached.',
  atWeek: 100,
  read: true,
  starred: false,
  folder: 'inbox',
  category: 'finance',
  verified: true,
  ...over,
});

const withMessages = (messages: MailMessage[]): GameState => {
  const state = createTestGameState({});
  state.mail = { messages };
  return state;
};

const decision = (expiresAtWeek: number, chosenId?: string) => ({
  prompt: 'Answer this',
  choices: [
    { id: 'yes', label: 'Yes' },
    { id: 'no', label: 'No' },
  ],
  expiresAtWeek,
  lapseChoiceId: 'no',
  resolver: { kind: 'event' as const, eventId: 'jury_duty' },
  ...(chosenId ? { chosenId } : {}),
});

// ---------------------------------------------------------------------------

describe('search spans folders', () => {
  const mailbox = () =>
    withMessages([
      message({ id: 'in', subject: 'Payslip', folder: 'inbox' }),
      message({ id: 'arch', subject: 'Payslip', folder: 'archive' }),
      message({ id: 'spam-1', subject: 'Payslip', folder: 'spam' }),
      message({ id: 'gone', subject: 'Payslip', folder: 'trash' }),
    ]);

  it('finds an ARCHIVED message, which folder-scoped search reported as absent', () => {
    // The bug this replaces did not merely hide the message. The player asked
    // "did my bank write from that address?", the app said "No matches", and
    // that is an answer — a wrong one, about the exact thing the scam mechanic
    // needs this screen to be trusted on.
    const found = searchMessages(mailbox(), 'payslip').map((m) => m.id);
    expect(found).toContain('arch');
    expect(found).toContain('spam-1');
  });

  it('excludes Trash, as Gmail does - a deleted message must stay deleted', () => {
    expect(searchMessages(mailbox(), 'payslip').map((m) => m.id)).not.toContain('gone');
  });

  it('matches the ADDRESS, not just the display name', () => {
    // The whole tell is that a familiar name arrives from an unfamiliar
    // address, so searching the address is the load-bearing half.
    const state = withMessages([
      message({ id: 'real', senderEmail: 'no-reply@deeplifebank.com' }),
      message({ id: 'fake', senderEmail: 'security@deeplifebank-verify.com' }),
    ]);
    expect(searchMessages(state, 'deeplifebank-verify').map((m) => m.id)).toEqual(['fake']);
  });

  it('returns nothing for a blank query rather than everything', () => {
    expect(searchMessages(mailbox(), '   ')).toEqual([]);
  });

  it('is case- and whitespace-insensitive', () => {
    expect(searchMessages(mailbox(), '  PAYSLIP ')).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------

describe('emptying the bin takes only the folder you are in', () => {
  const both = () =>
    withMessages([
      message({ id: 'keep', folder: 'inbox' }),
      message({ id: 'binned', folder: 'trash' }),
      message({ id: 'junk', folder: 'spam' }),
    ]);

  it('emptying Trash leaves Spam alone', () => {
    // It used to take both, behind a button labelled just "Empty". Clearing
    // the bin silently destroyed every message in Spam.
    const h = harness(both());
    emptyMailBin(h.setGameState, 'trash');
    expect(getMailState(h.get()).messages.map((m) => m.id).sort()).toEqual(['junk', 'keep']);
  });

  it('emptying Spam leaves Trash alone', () => {
    const h = harness(both());
    emptyMailBin(h.setGameState, 'spam');
    expect(getMailState(h.get()).messages.map((m) => m.id).sort()).toEqual([
      'binned',
      'keep',
    ]);
  });

  it('is a no-op on an empty folder, so it causes no state churn', () => {
    const state = withMessages([message({ id: 'keep', folder: 'inbox' })]);
    const h = harness(state);
    emptyMailBin(h.setGameState, 'trash');
    expect(h.get()).toBe(state);
  });
});

// ---------------------------------------------------------------------------

describe('the filters', () => {
  it('each one selects what its label says', () => {
    const unread = message({ id: 'u', read: false });
    const waiting = message({ id: 'd', decision: decision(104) });
    const doc = message({
      id: 'a',
      attachment: {
        kind: 'payslip',
        title: 'Payslip',
        issuer: 'Payroll',
        reference: 'PAY-1',
        rows: [],
      },
    });
    const stranger = message({ id: 'v', verified: undefined });

    expect(matchesFilter(unread, 'unread')).toBe(true);
    expect(matchesFilter(waiting, 'decisions')).toBe(true);
    expect(matchesFilter(doc, 'documents')).toBe(true);
    expect(matchesFilter(stranger, 'unverified')).toBe(true);

    // And the control: a plain read, verified, undecided, attachment-less
    // message matches none of them.
    const plain = message();
    expect(MAIL_FILTERS.filter((f) => matchesFilter(plain, f))).toEqual([]);
  });

  it('does not count an ANSWERED decision as needing a reply', () => {
    expect(needsReply(message({ decision: decision(104, 'yes') }))).toBe(false);
    expect(needsReply(message({ decision: decision(104) }))).toBe(true);
    expect(needsReply(message())).toBe(false);
  });

  it('counts per filter over the list it is given, not the whole mailbox', () => {
    // The chip badge promises what the player will see when they tap it. A
    // count taken over every folder would promise four and then show one.
    const counts = filterCounts([
      message({ id: '1', read: false }),
      message({ id: '2', read: false, decision: decision(104) }),
      message({ id: '3' }),
    ]);
    expect(counts.unread).toBe(2);
    expect(counts.decisions).toBe(1);
    expect(counts.documents).toBe(0);
  });

  it('offers no filter that names the scams', () => {
    // Deliberate. A "scams" chip would answer the question the whole mechanic
    // exists to ask, and any player who found it would stop reading addresses.
    const labels = Object.values(FILTER_LABELS).join(' ').toLowerCase();
    expect(labels).not.toMatch(/scam|fraud|phish/);
  });
});

// ---------------------------------------------------------------------------

describe('what is waiting on an answer', () => {
  it('looks in every folder - archiving a summons does not stop it lapsing', () => {
    const state = withMessages([
      message({ id: 'in', decision: decision(110) }),
      message({ id: 'arch', folder: 'archive', decision: decision(106) }),
      message({ id: 'done', decision: decision(104, 'yes') }),
    ]);
    expect(pendingDecisions(state).map((m) => m.id)).toEqual(['arch', 'in']);
  });

  it('ignores Trash, which the lapse pass also does not resurrect a row for', () => {
    const state = withMessages([
      message({ id: 'gone', folder: 'trash', decision: decision(104) }),
    ]);
    expect(pendingDecisions(state)).toEqual([]);
  });

  it('sorts soonest first, because that is the one worth surfacing', () => {
    const state = withMessages([
      message({ id: 'late', decision: decision(120) }),
      message({ id: 'soon', decision: decision(101) }),
      message({ id: 'mid', decision: decision(110) }),
    ]);
    expect(pendingDecisions(state).map((m) => m.id)).toEqual(['soon', 'mid', 'late']);
  });
});

// ---------------------------------------------------------------------------

describe('the deadline label', () => {
  it('never says "1 weeks"', () => {
    // The reason this helper exists at all: the detail view had this
    // subtraction inline, and adding a second copy for the row is exactly how
    // the two round differently.
    expect(decisionDeadline(message({ decision: decision(101) }), 100)!.label).toBe(
      '1 week left'
    );
    expect(decisionDeadline(message({ decision: decision(103) }), 100)!.label).toBe(
      '3 weeks left'
    );
  });

  it('marks the last week urgent, and only the last week', () => {
    expect(decisionDeadline(message({ decision: decision(101) }), 100)!.urgent).toBe(true);
    expect(decisionDeadline(message({ decision: decision(100) }), 100)!.urgent).toBe(true);
    expect(decisionDeadline(message({ decision: decision(102) }), 100)!.urgent).toBe(false);
  });

  it('does not go negative once the deadline has passed', () => {
    const past = decisionDeadline(message({ decision: decision(90) }), 100)!;
    expect(past.weeksLeft).toBe(0);
    expect(past.label).toBe('Due this week');
  });

  it('is null for anything with no live decision', () => {
    expect(decisionDeadline(message(), 100)).toBeNull();
    expect(decisionDeadline(message({ decision: decision(104, 'yes') }), 100)).toBeNull();
    expect(decisionDeadline(null, 100)).toBeNull();
  });

  it('survives a malformed deadline rather than rendering NaN', () => {
    const broken = message({ decision: { ...decision(104), expiresAtWeek: undefined } as never });
    expect(decisionDeadline(broken, 100)).toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe('the drawer counts every folder', () => {
  it('reports unread for the Inbox and totals for the rest', () => {
    // It showed a count for the Inbox alone, so Spam and Archive read as
    // permanently empty however much was sitting in them.
    const counts = folderCounts(
      withMessages([
        message({ id: '1', folder: 'inbox', read: false }),
        message({ id: '2', folder: 'inbox', read: true }),
        message({ id: '3', folder: 'archive' }),
        message({ id: '4', folder: 'spam' }),
        message({ id: '5', folder: 'spam' }),
        message({ id: '6', folder: 'trash' }),
        message({ id: '7', folder: 'inbox', starred: true }),
      ])
    );

    expect(counts.inbox).toBe(1);
    expect(counts.archive).toBe(1);
    expect(counts.spam).toBe(2);
    expect(counts.trash).toBe(1);
    expect(counts.starred).toBe(1);
  });

  it('does not count a starred message that has been thrown away', () => {
    // Starred is a VIEW across folders and the view excludes Trash, so the
    // count has to exclude it too or the drawer promises a row the list
    // will not show.
    const counts = folderCounts(
      withMessages([message({ id: '1', folder: 'trash', starred: true })])
    );
    expect(counts.starred).toBe(0);
  });

  it('degrades to zeroes on a save with no mail slice', () => {
    const counts = folderCounts(createTestGameState({}));
    expect(counts).toEqual({ inbox: 0, starred: 0, archive: 0, spam: 0, trash: 0 });
  });

  it('treats a message with no folder as Inbox, matching messagesInFolder', () => {
    const counts = folderCounts(
      withMessages([message({ id: '1', folder: undefined as unknown as MailFolder, read: false })])
    );
    expect(counts.inbox).toBe(1);
  });
});
