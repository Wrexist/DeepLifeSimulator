import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderWithProviders } from './helpers/renderWithProviders';
import MailApp from '@/components/mobile/Mail/MailApp';
import MailDocument from '@/components/mobile/Mail/MailDocument';
import MailRow from '@/components/mobile/Mail/MailRow';
import TestRenderer, { act } from 'react-test-renderer';
import type { MailAttachment, MailMessage } from '@/contexts/game/types';

/**
 * Mail mounts inside the real provider tree, and the document renders its
 * figures verbatim.
 *
 * The document assertion is the one with teeth: the whole point of an
 * attachment is that the numbers are checkable against the player's balance, so
 * a formatter that abbreviated (`$1.2K`) or dropped cents would quietly turn the
 * feature back into decoration. Asserting the exact strings is what stops that.
 */

const row = (over: Partial<MailMessage> = {}): MailMessage => ({
  id: 'm-1',
  senderName: 'Revenue Service',
  senderEmail: 'notices@revenue.gov',
  subject: 'Jury service',
  preview: 'You are required to attend.',
  body: '',
  atWeek: 100,
  read: false,
  starred: false,
  folder: 'inbox',
  category: 'primary',
  verified: true,
  ...over,
});

function renderRow(message: MailMessage, currentWeek: number, folderLabel?: string) {
  let tree: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    tree = TestRenderer.create(
      <MailRow
        message={message}
        darkMode
        currentWeek={currentWeek}
        folderLabel={folderLabel}
        onPress={() => {}}
        onToggleStar={() => {}}
      />
    );
  });
  const text = JSON.stringify(tree!.toJSON());
  act(() => tree!.unmount());
  return text;
}

const pending = (expiresAtWeek: number) => ({
  prompt: 'Answer this',
  choices: [
    { id: 'serve', label: 'Serve' },
    { id: 'excuse', label: 'Seek an excusal' },
  ],
  expiresAtWeek,
  lapseChoiceId: 'excuse',
  resolver: { kind: 'event' as const, eventId: 'jury_duty' },
});

describe('render — DeepMail', () => {
  it('mounts on an empty inbox without throwing', () => {
    const { json, unmount } = renderWithProviders(<MailApp onBack={() => {}} />);
    expect(json.length).toBeGreaterThan(0);
    unmount();
  });

  it('renders a document with exact, checkable figures', () => {
    const attachment: MailAttachment = {
      kind: 'payslip',
      title: 'Payslip — period ending Mar 8, 2027',
      issuer: 'Engineer · Payroll Services',
      reference: 'PAY-4417-22',
      rows: [
        { label: 'Basic pay · 4 weeks @ $1,800.00', value: '$7,200.00' },
        { label: 'Income tax withheld', value: '-$1,000.00', negative: true },
      ],
      total: { label: 'Net pay', value: '$6,200.00' },
      note: 'Tax is withheld at source.',
    };

    let tree: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      tree = TestRenderer.create(<MailDocument attachment={attachment} darkMode />);
    });
    const text = JSON.stringify(tree!.toJSON());

    expect(text).toContain('PAYSLIP');
    expect(text).toContain('PAY-4417-22');
    // Exact figures, cents included — not abbreviated.
    expect(text).toContain('$7,200.00');
    expect(text).toContain('-$1,000.00');
    expect(text).toContain('$6,200.00');
    expect(text).not.toMatch(/\$7\.2K/);

    act(() => tree!.unmount());
  });
});

/**
 * A row you can triage.
 *
 * The deadline is the assertion that matters. A letter which settles itself in
 * two weeks rendered identically to a promotional email — the one row in the
 * app with a consequence attached had nothing on it to say so, and a list you
 * cannot triage is just a pile.
 */
describe('render — the list row carries the deadline', () => {
  it('shows the weeks left on an unanswered decision', () => {
    expect(renderRow(row({ decision: pending(103) }), 100)).toContain('3 weeks left');
  });

  it('says "1 week left", never "1 weeks left"', () => {
    expect(renderRow(row({ decision: pending(101) }), 100)).toContain('1 week left');
  });

  it('shows nothing once the decision is answered', () => {
    const text = renderRow(row({ decision: { ...pending(103), chosenId: 'serve' } }), 100);
    expect(text).not.toMatch(/weeks? left/);
  });

  it('shows nothing on an ordinary message — the control', () => {
    const text = renderRow(row(), 100);
    expect(text).not.toMatch(/weeks? left|Due this week/);
  });

  it('names the folder on a cross-folder search result, and only then', () => {
    // A result the player cannot locate afterwards is a result they have to
    // find twice.
    expect(renderRow(row({ folder: 'archive' }), 100, 'Archive')).toContain('Archive');
    expect(renderRow(row(), 100)).not.toContain('Archive');
  });

  it('puts the deadline in the accessibility label too', () => {
    expect(renderRow(row({ decision: pending(101) }), 100)).toContain(
      'Needs a reply, 1 week left.'
    );
  });
});

/**
 * `MailRow` is wrapped in `React.memo`, and the list renders up to 50 of them.
 *
 * The list passed `onPress={() => openMessage(m.id)}` and
 * `onToggleStar={() => toggleMailStar(setGameState, m.id)}` — a fresh pair of
 * closures per row on every render, so the memo compared unequal every single
 * time and re-rendered all 50 rows for a keystroke in the search field. The row
 * now takes the id back as an argument (Pulse's FeedScreen pattern), which lets
 * the list hand every row the SAME two functions.
 */
describe('the mail list does not defeat MailRow\'s memo', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', '..', 'components/mobile/Mail/MailApp.tsx'),
    'utf8',
  );

  it('hands the row stable handlers rather than minting closures per row', () => {
    expect(src).toMatch(/onPress=\{openMessage\}/);
    expect(src).toMatch(/onToggleStar=\{toggleStar\}/);
    expect(src).not.toMatch(/onPress=\{\(\) => openMessage\(m\.id\)\}/);
    expect(src).not.toMatch(/onToggleStar=\{\(\) => toggleMailStar\(setGameState, m\.id\)\}/);
  });

  it('and both are memoized, so their identity survives a re-render', () => {
    // Stable call sites are worth nothing if the functions themselves are new
    // each render — that is the same bug one level up.
    expect(src).toMatch(/const toggleStar = useCallback\(/);
    expect(src).toMatch(/const openMessage = useCallback\(/);
  });

  it('the row passes its own id back, so one handler can serve every row', () => {
    const pressed: string[] = [];
    const starred: string[] = [];

    let tree: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      tree = TestRenderer.create(
        <MailRow
          message={row({ id: 'm-42' })}
          darkMode
          currentWeek={100}
          onPress={(id) => pressed.push(id)}
          onToggleStar={(id) => starred.push(id)}
        />,
      );
    });

    const pressables = tree!.root.findAll((n) => typeof n.props?.onPress === 'function', {
      deep: true,
    });
    act(() => {
      for (const p of pressables) p.props.onPress();
    });

    expect(pressed).toContain('m-42');
    expect(starred).toContain('m-42');

    act(() => tree!.unmount());
  });

  it('MailRow is still memoized (the premise)', () => {
    // If the memo were dropped the fix above would be measuring nothing.
    const rowSrc = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components/mobile/Mail/MailRow.tsx'),
      'utf8',
    );
    expect(rowSrc).toMatch(/export default React\.memo\(MailRow\)/);
  });
});
