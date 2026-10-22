import React, { Fragment, Suspense } from 'react';

/**
 * Stop rendering a subtree while it is hidden, without unmounting it.
 *
 * The technique `react-native-screens` uses for `freezeOnBlur` (its
 * `react-freeze` dependency; this is the same ~20 lines, kept local because
 * that package is only a transitive dependency here). A frozen child suspends
 * on a promise that never settles, so React shows the (empty) fallback, hides
 * the existing host views and keeps every bit of their state - scroll
 * position, sub-tab, filters - but does not re-render them. Unfreezing renders
 * the subtree once with the current state.
 *
 * Why it is needed: a component hidden with `display: 'none'` is still
 * mounted, so anything in it that subscribes to game state re-renders on every
 * mutation. PERF-3: the Life tab kept Health, Market and Progression alive
 * that way, and Progression re-scored all 159 achievements on every tap made
 * on the other two segments.
 */
const NEVER_SETTLES = { then() {} };

function Suspender({ freeze, children }: { freeze: boolean; children: React.ReactNode }) {
  if (freeze) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- Suspense protocol: throwing a thenable suspends.
    throw NEVER_SETTLES;
  }
  return <Fragment>{children}</Fragment>;
}

export default function Freeze({ freeze, children }: { freeze: boolean; children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <Suspender freeze={freeze}>{children}</Suspender>
    </Suspense>
  );
}
