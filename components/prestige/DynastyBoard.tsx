/**
 * The Dynasty board — the reachable surface for prestige tiers 2-5.
 *
 * ## Why it lives here
 *
 * The Prestige Shop's Dynasty tab is already the screen that answers "what do I
 * spend my meta-currency on?", and it already holds the two systems these four
 * compose with: Legacy Contracts (which pay the points) and the Dynasty Tree
 * (which spends them). Putting the Vault, the Endowment, Trials and the Seat
 * anywhere else would have split one question across two screens.
 *
 * ## Locked sections are SHOWN, not hidden
 *
 * Same rule as `FEATURE_UNLOCKS` (see `lib/progress/featureUnlocks.ts`): a
 * locked capability renders with a padlock and its requirement rather than
 * disappearing. The shape of the late game should be legible from the first
 * prestige — "there is a Vault at two, a Seat at five" is the answer to "why
 * prestige again?", and it only works if you can see it before you earn it.
 *
 * This is also the bug this codebase keeps finding: a capability with no UI.
 * The legacy shop had no buy button; the journal had no writer. Every reducer
 * in `lib/dynasty/` has a control here.
 */
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Lock, Check, Sparkles, Landmark, Gem, Swords } from 'lucide-react-native';
import type { GameState } from '@/contexts/game/types';
import { useMoneyActions } from '@/contexts/game/MoneyActionsContext';
import { isPrestigeFeatureUnlocked, prestigeUnlockRequirement } from '@/lib/progress/featureUnlocks';
import {
  VAULT_FEATURE,
  vaultCapacity,
  vaultCandidates,
  vaultContents,
  vaultFee,
} from '@/lib/dynasty/vault';
import { ENDOWMENT_FEATURE, getEndowmentBoard } from '@/lib/dynasty/endowment';
import {
  DYNASTY_TRIALS,
  TRIALS_FEATURE,
  getTrial,
  trialCapacity,
  trialRewardMultiplier,
} from '@/lib/dynasty/trials';
import { SEAT_FEATURE, SEAT_WINGS, getSeatWing } from '@/lib/dynasty/seat';
import { activeTrialIds, pendingTrialIds, seatWingIds } from '@/lib/dynasty/state';
import { scale, fontScale } from '@/utils/scaling';

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

interface RowProps {
  title: string;
  subtitle: string;
  /** Right-hand call to action, or a state word. */
  action: string;
  onPress?: () => void;
  enabled: boolean;
  done?: boolean;
  locked?: boolean;
  isDark: boolean;
}

/**
 * One row. Full `borderWidth: 1` on all four sides — a one-sided coloured
 * stripe is banned app-wide (Hard Rule #7).
 */
function Row({ title, subtitle, action, onPress, enabled, done, locked, isDark }: RowProps) {
  const Icon = done ? Check : locked ? Lock : Sparkles;
  const tint = done ? '#10B981' : enabled ? '#D97706' : isDark ? '#94A3B8' : '#6B7280';
  return (
    <TouchableOpacity
      activeOpacity={enabled ? 0.8 : 1}
      onPress={() => {
        if (!enabled || !onPress) return;
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ disabled: !enabled }}
      accessibilityLabel={`${title}. ${subtitle}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(10),
        padding: scale(10),
        marginBottom: scale(6),
        borderRadius: scale(12),
        borderWidth: 1,
        borderColor: done
          ? 'rgba(16, 185, 129, 0.5)'
          : isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
        backgroundColor: isDark ? 'rgba(30, 41, 59, 0.6)' : 'rgba(243, 244, 246, 0.7)',
        opacity: locked ? 0.55 : 1,
      }}
    >
      <Icon size={16} color={tint} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: fontScale(14), fontWeight: '700', color: isDark ? '#E2E8F0' : '#1E293B' }}>
          {title}
        </Text>
        <Text style={{ fontSize: fontScale(11), color: isDark ? '#94A3B8' : '#6B7280' }}>
          {subtitle}
        </Text>
      </View>
      <Text style={{ fontSize: fontScale(12), fontWeight: '800', color: tint }}>{action}</Text>
    </TouchableOpacity>
  );
}

interface SectionProps {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  title: string;
  blurb: string;
  unlocked: boolean;
  requirement: string;
  isDark: boolean;
  children: React.ReactNode;
}

function Section({ icon: Icon, title, blurb, unlocked, requirement, isDark, children }: SectionProps) {
  return (
    <View style={{ marginBottom: scale(16) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(6), marginBottom: scale(4) }}>
        <Icon size={14} color={unlocked ? '#D97706' : isDark ? '#94A3B8' : '#6B7280'} />
        <Text style={{ fontSize: fontScale(13), fontWeight: '700', color: isDark ? '#CBD5E1' : '#6B7280' }}>
          {title}
        </Text>
        {!unlocked && <Lock size={12} color={isDark ? '#94A3B8' : '#6B7280'} />}
      </View>
      <Text style={{ fontSize: fontScale(11), color: isDark ? '#94A3B8' : '#6B7280', marginBottom: scale(8) }}>
        {unlocked ? blurb : requirement}
      </Text>
      {children}
    </View>
  );
}

export default function DynastyBoard({ gameState }: { gameState: GameState | undefined | null }) {
  const {
    storeInDynastyVault,
    removeFromDynastyVault,
    claimDynastyEndowment,
    swearDynastyTrial,
    withdrawDynastyTrial,
    buyDynastySeatWing,
  } = useMoneyActions();

  const isDark = gameState?.settings?.darkMode ?? false;
  const cash = gameState?.stats?.money ?? 0;

  const vaultOpen = isPrestigeFeatureUnlocked(gameState, VAULT_FEATURE);
  const endowmentOpen = isPrestigeFeatureUnlocked(gameState, ENDOWMENT_FEATURE);
  const trialsOpen = isPrestigeFeatureUnlocked(gameState, TRIALS_FEATURE);
  const seatOpen = isPrestigeFeatureUnlocked(gameState, SEAT_FEATURE);

  const inside = vaultContents(gameState);
  const candidates = vaultCandidates(gameState);
  const capacity = vaultCapacity(gameState);

  const endowments = getEndowmentBoard(gameState);

  const active = activeTrialIds(gameState);
  const sworn = pendingTrialIds(gameState);
  const trialSlots = trialCapacity(gameState);
  const trialMultiplier = trialRewardMultiplier(gameState);

  const wingsBuilt = seatWingIds(gameState);

  return (
    <View>
      {/* ── Tier 2 · The Vault ───────────────────────────────────────────── */}
      <Section
        icon={Gem}
        title="THE VAULT · Prestige 2"
        blurb={`Preserve a luxury piece so it is still yours in the next life. ${inside.length}/${capacity} slots used. Upkeep still applies when it arrives.`}
        unlocked={vaultOpen}
        requirement={prestigeUnlockRequirement(gameState, VAULT_FEATURE)}
        isDark={isDark}
      >
        {inside.map((item) => (
          <Row
            key={`vault-in-${item.id}`}
            title={`${item.emoji} ${item.name}`}
            subtitle="Preserved. It crosses with you."
            action="Remove"
            enabled={vaultOpen}
            done
            isDark={isDark}
            onPress={() => removeFromDynastyVault(item.id)}
          />
        ))}
        {vaultOpen && candidates.length === 0 && inside.length === 0 && (
          <Row
            key="vault-empty"
            title="Nothing to preserve"
            subtitle="Buy a luxury piece first. Land cannot be vaulted — it stays where it is."
            action="—"
            enabled={false}
            isDark={isDark}
          />
        )}
        {vaultOpen &&
          candidates.map((item) => {
            const fee = vaultFee(item);
            const affordable = cash >= fee;
            const room = inside.length < capacity;
            return (
              <Row
                key={`vault-out-${item.id}`}
                title={`${item.emoji} ${item.name}`}
                subtitle={
                  room
                    ? `Preservation fee ${money(fee)}${affordable ? '' : ' — not enough cash'}`
                    : 'The Vault is full.'
                }
                action={money(fee)}
                enabled={room && affordable}
                isDark={isDark}
                onPress={() => storeInDynastyVault(item.id)}
              />
            );
          })}
      </Section>

      {/* ── Tier 3 · The Endowment ───────────────────────────────────────── */}
      <Section
        icon={Landmark}
        title="THE ENDOWMENT · Prestige 3"
        blurb="Money does not survive you. Endow it and it comes back as Legacy Points. Each tranche can be taken once, ever."
        unlocked={endowmentOpen}
        requirement={prestigeUnlockRequirement(gameState, ENDOWMENT_FEATURE)}
        isDark={isDark}
      >
        {endowments.map(({ tranche, taken, wingLocked, affordable, payout }) => (
          <Row
            key={tranche.id}
            title={tranche.name}
            subtitle={
              taken
                ? tranche.description
                : wingLocked
                  ? `${tranche.description} Needs ${getSeatWing(tranche.requiresWing ?? '')?.name ?? 'a Seat wing'}.`
                  : `${money(tranche.cost)} → ${payout.toLocaleString()} legacy points`
            }
            action={taken ? 'Endowed' : `+${payout.toLocaleString()}`}
            enabled={endowmentOpen && !taken && !wingLocked && affordable}
            done={taken}
            locked={wingLocked}
            isDark={isDark}
            onPress={() => claimDynastyEndowment(tranche.id)}
          />
        ))}
      </Section>

      {/* ── Tier 4 · Dynasty Trials ──────────────────────────────────────── */}
      <Section
        icon={Swords}
        title="DYNASTY TRIALS · Prestige 4"
        blurb={`Make the next life harder on purpose. Paid in Legacy Points when that life ends. ${sworn.length}/${trialSlots} sworn${trialMultiplier > 1 ? ' · rewards doubled by the Chapter House' : ''}.`}
        unlocked={trialsOpen}
        requirement={prestigeUnlockRequirement(gameState, TRIALS_FEATURE)}
        isDark={isDark}
      >
        {active.map((id) => {
          const trial = getTrial(id);
          if (!trial) return null;
          return (
            <Row
              key={`trial-active-${id}`}
              title={trial.name}
              subtitle={`Being borne now. Pays ${(trial.reward * trialMultiplier).toLocaleString()} when this life ends.`}
              action="Bearing"
              enabled={false}
              done
              isDark={isDark}
            />
          );
        })}
        {DYNASTY_TRIALS.map((trial) => {
          const isSworn = sworn.includes(trial.id);
          const isActive = active.includes(trial.id);
          if (isActive) return null;
          return (
            <Row
              key={`trial-${trial.id}`}
              title={trial.name}
              subtitle={trial.cost}
              action={isSworn ? 'Withdraw' : `+${(trial.reward * trialMultiplier).toLocaleString()}`}
              enabled={trialsOpen && (isSworn || sworn.length < trialSlots)}
              isDark={isDark}
              onPress={() => (isSworn ? withdrawDynastyTrial(trial.id) : swearDynastyTrial(trial.id))}
            />
          );
        })}
      </Section>

      {/* ── Tier 5 · The Dynasty Seat ────────────────────────────────────── */}
      <Section
        icon={Landmark}
        title="THE DYNASTY SEAT · Prestige 5"
        blurb="The only thing money outlives you as. Each wing makes one of the systems above bigger, permanently."
        unlocked={seatOpen}
        requirement={prestigeUnlockRequirement(gameState, SEAT_FEATURE)}
        isDark={isDark}
      >
        {SEAT_WINGS.map((wing) => {
          const built = wingsBuilt.includes(wing.id);
          const gated = Boolean(wing.requires) && !wingsBuilt.includes(wing.requires as string);
          const affordable = cash >= wing.cost;
          return (
            <Row
              key={wing.id}
              title={wing.name}
              subtitle={
                built
                  ? wing.effect
                  : gated
                    ? `Needs ${getSeatWing(wing.requires ?? '')?.name ?? 'an earlier wing'} first.`
                    : `${wing.effect} · ${money(wing.cost)}`
              }
              action={built ? 'Built' : money(wing.cost)}
              enabled={seatOpen && !built && !gated && affordable}
              done={built}
              locked={gated}
              isDark={isDark}
              onPress={() => buyDynastySeatWing(wing.id)}
            />
          );
        })}
      </Section>
    </View>
  );
}
