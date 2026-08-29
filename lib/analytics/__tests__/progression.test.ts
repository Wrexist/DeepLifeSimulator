import {
  PROGRESSION_STAGES,
  STAGE_WEEK_THRESHOLDS,
  resolveEngagementSegment,
  resolveMonetisationSegment,
  resolveProgressionStage,
  stageRank,
} from '../progression';

describe('resolveProgressionStage', () => {
  it('classifies by weeks into THIS life', () => {
    expect(resolveProgressionStage({ weeksThisLife: 0, totalPrestiges: 0 })).toBe('new');
    expect(resolveProgressionStage({ weeksThisLife: 3, totalPrestiges: 0 })).toBe('new');
    expect(resolveProgressionStage({ weeksThisLife: STAGE_WEEK_THRESHOLDS.early, totalPrestiges: 0 })).toBe('early');
    expect(resolveProgressionStage({ weeksThisLife: 51, totalPrestiges: 0 })).toBe('early');
    expect(resolveProgressionStage({ weeksThisLife: STAGE_WEEK_THRESHOLDS.mid, totalPrestiges: 0 })).toBe('mid');
    expect(resolveProgressionStage({ weeksThisLife: 259, totalPrestiges: 0 })).toBe('mid');
    expect(resolveProgressionStage({ weeksThisLife: STAGE_WEEK_THRESHOLDS.late, totalPrestiges: 0 })).toBe('late');
  });

  it('a prestiged player is endgame even at week 1 of the new life', () => {
    // Classifying them as `new` would push experienced players into the
    // new-player funnel and make onboarding drop-off look better than it is.
    expect(resolveProgressionStage({ weeksThisLife: 1, totalPrestiges: 1 })).toBe('endgame');
    expect(resolveProgressionStage({ weeksThisLife: 500, totalPrestiges: 3 })).toBe('endgame');
  });

  it('is total - non-finite and negative input still yields a stage', () => {
    expect(resolveProgressionStage({ weeksThisLife: NaN, totalPrestiges: NaN })).toBe('new');
    expect(resolveProgressionStage({ weeksThisLife: -50, totalPrestiges: 0 })).toBe('new');
  });

  it('an age-25 start (weeksLived 364) is NEW when measured in-life', () => {
    // CLAUDE.md §4.2: `weeksLived` is seeded from the starting age, so the raw
    // counter is already 364 at week 0 of the life. Feeding it here would
    // classify a brand-new player as `late` and delete them from the
    // new-player funnel. This asserts the contract of the INPUT, which is why
    // the field is named `weeksThisLife`.
    expect(resolveProgressionStage({ weeksThisLife: 0, totalPrestiges: 0 })).toBe('new');
    expect(resolveProgressionStage({ weeksThisLife: 364, totalPrestiges: 0 })).toBe('late');
  });
});

describe('stageRank', () => {
  it('orders the ladder', () => {
    const ranks = PROGRESSION_STAGES.map(stageRank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(new Set(ranks).size).toBe(PROGRESSION_STAGES.length);
  });
});

describe('resolveEngagementSegment', () => {
  it('separates the player who came once and left', () => {
    expect(resolveEngagementSegment(1, 1)).toBe('one_session');
    expect(resolveEngagementSegment(0, 0)).toBe('one_session');
  });

  it('uses a per-day rate, not a raw total', () => {
    // 30 sessions over 30 days is a casual daily player, not an engaged one;
    // counting the total would reward having been installed longer.
    expect(resolveEngagementSegment(30, 30)).toBe('casual');
    expect(resolveEngagementSegment(30, 5)).toBe('engaged');
  });

  it('requires a few distinct days before calling anyone engaged', () => {
    expect(resolveEngagementSegment(10, 1)).toBe('casual');
  });

  it('handles non-finite input', () => {
    expect(resolveEngagementSegment(NaN, NaN)).toBe('one_session');
  });
});

describe('resolveMonetisationSegment', () => {
  it('keeps lapsed apart from free', () => {
    // They are different products: one has never been asked, the other
    // answered and left. Merging them targets win-back at non-converters.
    expect(resolveMonetisationSegment({ isSubscriber: false, isTrial: false, hasEverSubscribed: false })).toBe('free');
    expect(resolveMonetisationSegment({ isSubscriber: false, isTrial: false, hasEverSubscribed: true })).toBe('lapsed');
  });

  it('trial outranks subscriber, since a trialist has not paid yet', () => {
    expect(resolveMonetisationSegment({ isSubscriber: true, isTrial: true, hasEverSubscribed: true })).toBe('trial');
  });

  it('reports an active paying subscriber', () => {
    expect(resolveMonetisationSegment({ isSubscriber: true, isTrial: false, hasEverSubscribed: true })).toBe('subscriber');
  });
});
