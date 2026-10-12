import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import StreamSummaryModal, { type StreamSummary } from '@/components/computer/StreamSummaryModal';

/** The end-of-stream recap replaces a two-line alert (tester, 2026-10-11). */
const base: StreamSummary = {
  game: 'Just Chatting',
  art: 1 as never,
  seconds: 95,
  viewers: 1234,
  newFollowers: 40,
  newSubs: 6,
  donations: 120,
  earnings: 860,
  hypeTrain: false,
  autoStopped: false,
  newBest: false,
  levelBefore: 2,
  levelAfter: 2,
};

function render(summary: StreamSummary | null, onGoAgain?: () => void) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<StreamSummaryModal summary={summary} onClose={() => {}} onGoAgain={onGoAgain} />); });
  return tree;
}

describe('StreamSummaryModal', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('renders nothing without a summary', () => {
    expect(render(null).toJSON()).toBeNull();
  });

  it('shows the numbers the broadcast moved', () => {
    const json = JSON.stringify(render(base).toJSON());
    for (const s of ['Stream complete', '1,234', '1m 35s', '+40', '+6', 'Just Chatting']) {
      expect(json).toContain(s);
    }
  });

  it('leads with the most notable outcome', () => {
    expect(JSON.stringify(render({ ...base, hypeTrain: true }).toJSON())).toContain('HYPE TRAIN!');
    expect(JSON.stringify(render({ ...base, levelAfter: 3 }).toJSON())).toContain('Level up!');
    expect(JSON.stringify(render({ ...base, newBest: true }).toJSON())).toContain('New personal best');
    expect(JSON.stringify(render({ ...base, autoStopped: true }).toJSON())).toContain('Out of energy');
  });

  it('offers Go live again only when the caller says it is possible', () => {
    expect(JSON.stringify(render(base).toJSON())).not.toContain('Go live again');
    expect(JSON.stringify(render(base, () => {}).toJSON())).toContain('Go live again');
  });
});
