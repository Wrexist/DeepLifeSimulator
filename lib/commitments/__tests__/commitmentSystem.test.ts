/**
 * Activity Commitment System — rise (updateCommitmentLevel) + decay
 * (decayCommitmentLevels). Both were orphaned (zero callers) so commitment
 * levels never moved and the ActivityCommitmentModal bars were frozen at 0.
 * Fix 5 wires them in: practicing a hobby raises the level (PursuitActions) and
 * the weekly tick decays neglected areas (applyAutoCheckpoint). These tests pin
 * the pure functions those call sites rely on.
 */
import {
  updateCommitmentLevel,
  decayCommitmentLevels,
} from '../commitmentSystem';
import type { GameState } from '@/contexts/game/types';

type Commitments = GameState['activityCommitments'];

describe('updateCommitmentLevel (rise)', () => {
  it('a committed area grows +2 per activity', () => {
    expect(updateCommitmentLevel(10, 'hobbies', true)).toBe(12);
  });

  it('an uncommitted area grows +1 per activity', () => {
    expect(updateCommitmentLevel(10, 'hobbies', false)).toBe(11);
  });

  it('is capped at 100', () => {
    expect(updateCommitmentLevel(99, 'hobbies', true)).toBe(100);
    expect(updateCommitmentLevel(100, 'hobbies', false)).toBe(100);
  });
});

describe('decayCommitmentLevels (decay)', () => {
  it('decays neglected areas by 1/wk but leaves the primary + secondary intact', () => {
    const commitments: Commitments = {
      primary: 'career',
      secondary: 'health',
      commitmentLevels: { career: 50, hobbies: 40, relationships: 30, health: 20 },
    };
    const next = decayCommitmentLevels(commitments)!;
    // Focus areas are protected.
    expect(next.career).toBe(50);
    expect(next.health).toBe(20);
    // Neglected areas decay.
    expect(next.hobbies).toBe(39);
    expect(next.relationships).toBe(29);
  });

  it('floors neglected areas at 0 (never negative)', () => {
    const commitments: Commitments = {
      primary: 'career',
      secondary: undefined,
      commitmentLevels: { career: 50, hobbies: 0, relationships: 1, health: 0 },
    };
    const next = decayCommitmentLevels(commitments)!;
    expect(next.hobbies).toBe(0);
    expect(next.relationships).toBe(0);
    expect(next.health).toBe(0);
  });

  it('returns a zeroed set when commitmentLevels is missing', () => {
    const next = decayCommitmentLevels({ primary: undefined, secondary: undefined });
    expect(next).toEqual({ career: 0, hobbies: 0, relationships: 0, health: 0 });
  });

  it('rise then repeated decay round-trips a neglected area back down (Fix 5 loop)', () => {
    // Simulate: practice hobbies twice (uncommitted, +1 each), then neglect it
    // for several weeks — it decays back toward 0.
    let hobbies = 0;
    hobbies = updateCommitmentLevel(hobbies, 'hobbies', false); // 1
    hobbies = updateCommitmentLevel(hobbies, 'hobbies', false); // 2
    expect(hobbies).toBe(2);

    let commitments: Commitments = {
      primary: 'career',
      secondary: undefined,
      commitmentLevels: { career: 0, hobbies, relationships: 0, health: 0 },
    };
    for (let w = 0; w < 3; w++) {
      commitments = {
        ...commitments,
        commitmentLevels: decayCommitmentLevels(commitments),
      };
    }
    expect(commitments!.commitmentLevels!.hobbies).toBe(0); // 2 → 1 → 0 → 0
  });
});
