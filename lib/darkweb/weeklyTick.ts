/**
 * Weekly dark-web tick.
 *
 * Runs every game week. Responsibilities:
 *   1. Decay heat by base + OPSEC.
 *   2. Refresh marketplace listings (prune expired, top up to 3 per vendor).
 *   3. Settle laundering transactions whose readyWeek has arrived.
 *   4. Expire overdue active jobs.
 *   5. Police events at high heat: small chance of jail / dirty-BTC seizure.
 *
 * Pure function — caller threads results into setGameState.
 *
 * Returns notifications, jailWeeks delta (>=0), seized dirty-BTC, and the new
 * dark-web state. The caller (GameActionsContext.nextWeek) folds them into
 * the final returned GameState.
 */

import { DarkWebState, Relationship } from '@/contexts/game/types';
import {
  expireOverdueJobs,
  refreshMarketplace,
  settleLaunderingTransactions,
  tickHeatDecay,
} from './operations';
import { policeEventProbability, policeEventSeverity } from './heat';

const safe = (n: number, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

export interface DarkWebWeeklyTickInput {
  darkWeb: DarkWebState;
  currentWeek: number;
  /** Active relationships (partner/spouse) — used for the discovery roll. */
  relationships?: Relationship[];
  /** Deterministic roll source. Math.random for non-deterministic flows. */
  rollFor: (key: string) => number;
  /** True if the player is already serving a sentence — raids must not pile on jail. */
  inJail?: boolean;
}

export interface DarkWebWeeklyTickResult {
  darkWeb: DarkWebState;
  /** Extra weeks of jail the police event imposed this tick (0 if none). */
  jailWeeksAdded: number;
  /** Dirty BTC seized by police event (0 if none). */
  dirtyBtcSeized: number;
  /** Per-relationship score deltas to apply (caller mutates gameState.relationships). */
  relationshipDeltas: { id: string; delta: number; reason: 'darkweb-discovery' }[];
  notifications: { id: string; title: string; message: string }[];
}

/**
 * Sub-roll band that resolves a police event into a JAIL RAID.
 *
 * Exported because the Onion app printed `policeEventProbability(heat)` as
 * `raid_risk` — the chance of ANY police event, of which a raid is only this
 * slice. At heat 80+ that read 40%/wk against a real jail-raid chance of ~10%,
 * a 4x overstatement of the number the player manages heat around. R3-C8.
 */
export const RAID_SUBROLL_MIN = 0.30;
export const RAID_SUBROLL_MAX = 0.55;
/** Share of police events that are a jail raid. */
export const RAID_SHARE_OF_POLICE_EVENTS = RAID_SUBROLL_MAX - RAID_SUBROLL_MIN;

export function runDarkWebWeeklyTick(input: DarkWebWeeklyTickInput): DarkWebWeeklyTickResult {
  // Normalize optional slices up front: a partially-migrated / CloudSync-merged /
  // hand-edited save can carry `darkWeb` with a present-but-null slice, and an
  // unguarded read downstream (`for (const v of dw.vendors)` in refreshMarketplace,
  // `dw.skills[id]` in getSkill, `for (const tx of dw.laundering)` in
  // settleLaunderingTransactions, `.length`/spread) throws inside the weekly-tick
  // updater, silently bricking "Next Week". Normalize EVERY iterated slice, not
  // just activeJobs/recentEvents. Spread into a fresh object so we never mutate input.
  // Validate by runtime SHAPE, not truthiness: a malformed but truthy value
  // (e.g. `vendors: {}` from a corrupt/hand-edited save) would pass `|| []` and
  // still throw on the downstream `for…of`/spread — and the outer fallback would
  // then write that malformed slice back, re-throwing every subsequent week.
  const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const isRecord = (v: unknown): boolean => !!v && typeof v === 'object' && !Array.isArray(v);
  let dw: DarkWebState = {
    ...input.darkWeb,
    vendors: asArray(input.darkWeb.vendors),
    listings: asArray(input.darkWeb.listings),
    activeJobs: asArray(input.darkWeb.activeJobs),
    laundering: asArray(input.darkWeb.laundering),
    skills: isRecord(input.darkWeb.skills) ? input.darkWeb.skills : ({} as DarkWebState['skills']),
    recentEvents: asArray(input.darkWeb.recentEvents),
  };
  const notifications: DarkWebWeeklyTickResult['notifications'] = [];
  const relationshipDeltas: DarkWebWeeklyTickResult['relationshipDeltas'] = [];

  // 1) Heat decay.
  dw = tickHeatDecay(dw, input.currentWeek);

  // 2) Marketplace refresh.
  dw = refreshMarketplace(dw, input.currentWeek, input.rollFor);

  // 3) Settle laundering txs.
  const settled = settleLaunderingTransactions(dw, input.currentWeek, (txId) =>
    input.rollFor(`darkweb.launder.${txId}`)
  );
  dw = settled.dw;
  if (settled.resolved.length > 0) {
    const completed = settled.resolved.filter((r) => r.status === 'completed').length;
    const failed = settled.resolved.filter((r) => r.status === 'failed').length;
    if (completed > 0) {
      notifications.push({
        id: 'darkweb-mixer-completed',
        title: '🧼 Laundering Settled',
        message: `${completed} mixer transaction${completed === 1 ? '' : 's'} cleared.`,
      });
    }
    if (failed > 0) {
      notifications.push({
        id: 'darkweb-mixer-failed',
        title: '⚠️ Mixer Failure',
        message: `${failed} mixer transaction${failed === 1 ? '' : 's'} failed - funds lost.`,
      });
    }
  }

  // 4) Expire overdue jobs.
  const before = dw.activeJobs.length;
  dw = expireOverdueJobs(dw, input.currentWeek);
  const expired = before - dw.activeJobs.length;
  if (expired > 0) {
    notifications.push({
      id: 'darkweb-jobs-expired',
      title: '⏱️ Jobs Expired',
      message: `${expired} dark-web job${expired === 1 ? '' : 's'} timed out.`,
    });
  }

  // 5) Police events at high heat - four flavors.
  let jailWeeksAdded = 0;
  let dirtyBtcSeized = 0;
  const eventProb = policeEventProbability(dw.heat);
  if (eventProb > 0 && input.rollFor('darkweb.policeEvent') < eventProb) {
    const severity = policeEventSeverity(dw.heat);
    const subRoll = input.rollFor('darkweb.policeEvent.kind');

    if (subRoll < RAID_SUBROLL_MIN && dw.dirtyBtc > 0) {
      // Sting operation: dirty BTC seized in a controlled buy.
      dirtyBtcSeized = Math.min(dw.dirtyBtc, dw.dirtyBtc * 0.5 * severity);
      dw = { ...dw, dirtyBtc: Math.max(0, dw.dirtyBtc - dirtyBtcSeized), heat: Math.min(100, dw.heat + 5) };
      notifications.push({
        id: 'darkweb-sting',
        title: '🚓 Sting Operation',
        message: `Lost ${dirtyBtcSeized.toFixed(4)} BTC in a controlled buy. Heat +5.`,
      });
    } else if (subRoll < RAID_SUBROLL_MAX) {
      // Raid: heat partially decays either way. Jail time is only added when the
      // player isn't already serving a sentence - raids must never pile onto an
      // existing jail term (which would let police events extend jail forever).
      dw = { ...dw, heat: Math.max(0, dw.heat - 25) };
      if (input.inJail) {
        notifications.push({
          id: 'darkweb-raid',
          title: '🚨 Raid',
          message: `Your operation was raided while you were already locked up. Heat -25.`,
        });
      } else {
        jailWeeksAdded = Math.max(1, Math.round(severity));
        notifications.push({
          id: 'darkweb-raid',
          title: '🚨 Raid',
          message: `Caught with too much heat. ${jailWeeksAdded} week${jailWeeksAdded === 1 ? '' : 's'} jail; heat -25.`,
        });
      }
    } else if (subRoll < 0.80 && dw.cleanBtc > 0) {
      // Informant: an NPC is talking. Buy them off with clean BTC, or it festers.
      const payoff = Math.min(dw.cleanBtc, dw.cleanBtc * 0.30 * severity);
      dw = { ...dw, cleanBtc: Math.max(0, dw.cleanBtc - payoff), heat: Math.min(100, dw.heat + 3) };
      notifications.push({
        id: 'darkweb-informant',
        title: '🕵️ Informant',
        message: `An informant surfaced. Paid ${payoff.toFixed(4)} BTC to keep them quiet. Heat +3.`,
      });
    } else {
      // Surveillance: a one-off heat spike.
      const heatBump = Math.round(15 * severity);
      dw = { ...dw, heat: Math.min(100, dw.heat + heatBump) };
      notifications.push({
        id: 'darkweb-surveillance',
        title: '📡 Under Surveillance',
        // R3-C9: the old copy promised "expect decay to stall while the tap is
        // active". There is no surveillance flag on `DarkWebState` and
        // `tickHeatDecay` applies the same unconditional decay every week, so
        // the second clause described nothing. This is a heat spike; say that.
        message: `You've been flagged. Heat +${heatBump}.`,
      });
    }
    dw = {
      ...dw,
      recentEvents: [
        { id: `police-${input.currentWeek}`, week: input.currentWeek, text: notifications[notifications.length - 1]!.message },
        ...dw.recentEvents,
      ].slice(0, 20),
    };
  }

  // 6) Relationship discovery - at heat ≥ 50, partner/spouse may discover the activity.
  //    Discovery probability scales with heat band. On discovery the relationship score
  //    drops sharply; a stronger relationship (rep ≥ 70) drops less because trust absorbs it.
  if (dw.heat >= 50 && input.relationships && input.relationships.length > 0) {
    const close = input.relationships.filter(
      (r) => r && (r.type === 'partner' || r.type === 'spouse') && safe(r.relationshipScore) >= 30
    );
    if (close.length > 0) {
      const discoveryProb = dw.heat >= 80 ? 0.05 : 0.02;
      if (input.rollFor('darkweb.relationshipDiscovery') < discoveryProb) {
        // Pick the partner with the highest score (the one who would care most).
        const target = close.reduce((best, r) =>
          safe(r.relationshipScore) > safe(best.relationshipScore) ? r : best
        );
        const trustBuffer = safe(target.relationshipScore) >= 70 ? 0.5 : 1.0;
        const dropAmount = Math.round(15 * trustBuffer);
        relationshipDeltas.push({
          id: target.id,
          delta: -dropAmount,
          reason: 'darkweb-discovery',
        });
        notifications.push({
          id: 'darkweb-relationship-discovery',
          title: '💔 They Found Out',
          message: `${target.name} discovered the dark-web activity. Relationship −${dropAmount}.`,
        });
        dw = {
          ...dw,
          recentEvents: [
            {
              id: `discovery-${input.currentWeek}`,
              week: input.currentWeek,
              text: `${target.name} found out. Trust hit hard.`,
            },
            ...dw.recentEvents,
          ].slice(0, 20),
        };
      }
    }
  }

  return { darkWeb: dw, jailWeeksAdded, dirtyBtcSeized, relationshipDeltas, notifications };
}
