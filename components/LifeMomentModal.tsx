import { uiPalette } from '@/lib/config/theme';
import React, { useCallback } from 'react';
import { Platform, View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import Gradient from '@/components/ui/Gradient';
import { useGameState, useGameActions } from '@/contexts/GameContext';
import { safeSettings } from '@/utils/safeGameState';
import {
  resolveLifeMomentChoice,
  dismissLifeMoment,
  canAffordLifeMomentChoice,
  lifeMomentChoiceCost,
} from '@/lib/events/lifeMomentResolution';
import { formatMoney } from '@/utils/moneyFormatting';
import { ArrowUp, ArrowDown } from 'lucide-react-native';
import { statIdentity, DIRECTION_COLOR, withAlpha } from '@/lib/config/statIdentity';
import { scale, fontScale } from '@/utils/scaling';
import { tier1Title } from '@/lib/config/hierarchy';

const LinearGradient = Gradient;

export default function LifeMomentModal() {
  const { gameState, setGameState } = useGameState();
  const { saveGame } = useGameActions();
  
  const moment = gameState.lifeMoments?.pendingMoment;
  // R2-A: this fires whenever a life moment triggers and would otherwise crash
  // on a save that's mid-migration.
  const settings = safeSettings(gameState);

  // ONE updater per tap, via the pure `resolveLifeMomentChoice`. This used to
  // apply money, each stat, karma and consequences as separate dispatches with
  // only the money leg able to refuse, so a refused "Go all in" (-$5,000) still
  // granted its happiness and unlocked its payout event. The resolver re-checks
  // the cost against `prev` and clears the moment in the same transition, which
  // also makes a same-frame double tap pay once (the second updater finds no
  // pending moment) - the job the old `resolvedMomentRef` latch did by hand.
  const handleChoice = useCallback(
    (choiceId: string) => {
      const pending = gameState.lifeMoments?.pendingMoment;
      if (!pending) return;
      setGameState(prev => resolveLifeMomentChoice(prev, pending.id, choiceId));
      saveGame();
    },
    [gameState, setGameState, saveGame]
  );

  // Dismiss without applying a choice. Clears pendingMoment the same way the
  // choice handler does so an empty/malformed moment can't soft-lock the UI
  // and Android back works. Keyed on the moment id, so a dismiss racing a
  // choice in the same batch cannot clear the NEXT moment.
  const handleDismiss = useCallback(() => {
    const pending = gameState.lifeMoments?.pendingMoment;
    if (!pending) return;
    setGameState(prev => dismissLifeMoment(prev, pending.id));
    saveGame();
  }, [gameState, setGameState, saveGame]);

  if (!moment) return null;

  const hasChoices = Array.isArray(moment.choices) && moment.choices.length > 0;
  const cash = gameState.stats?.money ?? 0;
  // The choices are the only way out of this modal on iOS (no X, no backdrop
  // tap), so if the wallet covers none of them a plain "Not now" is offered
  // rather than a screen of disabled buttons.
  const noneAffordable = hasChoices && moment.choices.every(c => !canAffordLifeMomentChoice(c, cash));
  // Android back mirrors the visible way out, so the same moment plays the
  // same on both platforms (CMP-2). It dismisses only when "Not now" /
  // "Dismiss" is on screen; while a choice is affordable it does nothing,
  // exactly as on iOS, instead of skipping a costly moment for free.
  const canDismiss = !hasChoices || noneAffordable;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={canDismiss ? handleDismiss : () => undefined}>
      <View style={styles.overlay}>
        <LinearGradient
          colors={settings.darkMode ? [uiPalette.surface, uiPalette.navy] : [uiPalette.paper, uiPalette.white]}
          style={styles.container}
        >
          {/* ── One scroll surface for the whole card ────────────────────
              Unlike the celebration popups there is no footer to pin here:
              the CHOICES are the only way out of this modal (it has no close
              X and no backdrop tap), so every one of them has to stay
              reachable. Both halves of the column are variable - `situation`
              is free-form prose and `choices` is an unbounded list where each
              option can carry its own row of effect chips - so a wordy moment
              with four options runs past the card and takes the last choices
              off the bottom of the screen with it. Everything scrolls.

              `flexShrink: 1` against the card's `maxHeight` bound, not
              `flex: 1` - see the note in `WeddingPopup`/`ApplyCardModal`. */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            bounces={false}
          >
            <Text style={[styles.title, settings.darkMode && styles.titleDark]}>
              Life Moment
            </Text>
            <Text style={[styles.situation, settings.darkMode && styles.situationDark]}>
              {moment.situation}
            </Text>
          
            <View style={styles.choicesContainer}>
              {canDismiss && (
                <TouchableOpacity
                  style={[
                    styles.choiceButton,
                    settings.darkMode && styles.choiceButtonDark
                  ]}
                  onPress={handleDismiss}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.choiceText, settings.darkMode && styles.choiceTextDark]}>
                    {hasChoices ? 'Not now' : 'Dismiss'}
                  </Text>
                </TouchableOpacity>
              )}
              {hasChoices && moment.choices.map((choice) => {
                // Disabled with what it takes, exactly when the resolver would refuse it.
                const affordable = canAffordLifeMomentChoice(choice, cash);
                return (
                <TouchableOpacity
                  key={choice.id}
                  style={[
                    styles.choiceButton,
                    settings.darkMode && styles.choiceButtonDark,
                    !affordable && styles.choiceButtonDisabled,
                  ]}
                  onPress={() => handleChoice(choice.id)}
                  disabled={!affordable}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !affordable }}
                >
                  <Text style={[styles.choiceText, settings.darkMode && styles.choiceTextDark]}>
                    {choice.text}
                  </Text>
                  {!affordable && (
                    <Text style={[styles.needText, settings.darkMode && styles.choiceTextDark]}>
                      Need {formatMoney(lifeMomentChoiceCost(choice))}
                    </Text>
                  )}
                  {choice.quickEffect.length > 0 && (
                    <View style={styles.effectsContainer}>
                      {/* One chip per effect. TWO readings, kept apart on
                          purpose: the tint + icon say WHICH stat (the same
                          pairings the HUD taught - red heart, yellow face,
                          blue bolt), the arrow says WHICH WAY. Chips wrap, so
                          a three-effect choice is two short lines instead of
                          three stacked rows, and more choices stay on screen. */}
                      {choice.quickEffect.map((effect, i) => {
                        const { color, Icon } = statIdentity(effect.stat);
                        const up = effect.amount > 0;
                        const down = effect.amount < 0;
                        return (
                          <View
                            key={i}
                            style={[
                              styles.effectChip,
                              {
                                backgroundColor: withAlpha(color, settings.darkMode ? 0.18 : 0.12),
                                borderColor: withAlpha(color, settings.darkMode ? 0.45 : 0.35),
                              },
                            ]}
                          >
                            <Icon size={scale(14)} color={color} />
                            <Text
                              style={[
                                styles.effectText,
                                settings.darkMode && styles.effectTextDark,
                              ]}
                              numberOfLines={1}
                            >
                              {effect.label}
                            </Text>
                            {up ? (
                              <ArrowUp size={scale(13)} color={DIRECTION_COLOR.positive} />
                            ) : down ? (
                              <ArrowDown size={scale(13)} color={DIRECTION_COLOR.negative} />
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    // The bound the scroll area shrinks within - '100%' is the overlay's
    // height less its padding. Without it `flexShrink` has nothing to shrink
    // against and the card grows off-screen exactly as before.
    maxHeight: '100%',
    ...Platform.select({
      web: { boxShadow: '0px 8px 16px rgba(0, 0, 0, 0.3)' } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
    }),
    elevation: 12,
  },
  title: {
    ...tier1Title,
    color: uiPalette.surface,
    marginBottom: 16,
    textAlign: 'center',
  },
  titleDark: {
    color: uiPalette.paper,
  },
  situation: {
    fontSize: fontScale(16),
    color: uiPalette.slate,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: fontScale(24),
  },
  situationDark: {
    color: uiPalette.secondary,
  },
  scrollArea: {
    flexShrink: 1,
  },
  scrollContent: {
    // The card's own padding still frames the content; the scroller only
    // needs to stop the last choice sitting flush against the card edge.
    paddingBottom: 4,
  },
  choicesContainer: {
    gap: 12,
  },
  choiceButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  choiceButtonDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  choiceButtonDisabled: {
    opacity: 0.5,
  },
  needText: {
    fontSize: fontScale(13),
    fontWeight: '600',
    color: uiPalette.slate,
  },
  choiceText: {
    fontSize: fontScale(16),
    color: uiPalette.surface,
    marginBottom: 8,
    fontWeight: '500',
  },
  choiceTextDark: {
    color: uiPalette.paper,
  },
  effectsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(6),
    marginTop: scale(10),
  },
  effectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
    paddingVertical: scale(5),
    paddingHorizontal: scale(9),
    borderRadius: scale(999),
    // Full border on all four sides - a one-sided accent stripe is banned
    // app-wide (CLAUDE.md Hard Rule #7) and curls against a radius this tight.
    borderWidth: 1,
  },
  effectText: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: uiPalette.navy,
  },
  effectTextDark: {
    color: uiPalette.lightSurface,
  },
});

