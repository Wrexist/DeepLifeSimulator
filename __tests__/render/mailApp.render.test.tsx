import React from 'react';
import { renderWithProviders } from './helpers/renderWithProviders';
import MailApp from '@/components/mobile/Mail/MailApp';
import MailDocument from '@/components/mobile/Mail/MailDocument';
import TestRenderer, { act } from 'react-test-renderer';
import type { MailAttachment } from '@/contexts/game/types';

/**
 * Mail mounts inside the real provider tree, and the document renders its
 * figures verbatim.
 *
 * The document assertion is the one with teeth: the whole point of an
 * attachment is that the numbers are checkable against the player's balance, so
 * a formatter that abbreviated (`$1.2K`) or dropped cents would quietly turn the
 * feature back into decoration. Asserting the exact strings is what stops that.
 */

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
