import React, { useCallback } from 'react';
import { Platform, View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { useGameState, useGameActions } from '@/contexts/GameContext';
import { safeSettings } from '@/utils/safeGameState';
import { applyKarmaChange, INITIAL_KARMA } from '@/lib/karma/karmaSystem';
import { ArrowUp, ArrowDown } from 'lucide-react-native';

const LinearGradient = LinearGradientFallback;

export default function LifeMomentModal() {
  const { gameState, setGameState } = useGameState();
  const { updateStats, updateMoney, saveGame } = useGameActions();
  
  const moment = gameState.lifeMoments?.pendingMoment;
  // R2-A: this fires whenever a life moment triggers and would otherwise crash
  // on a save that's mid-migration.
  const settings = safeSettings(gameState);

  const handleChoice = useCallback(
    (choiceId: string) => {
      const pending = gameState.lifeMoments?.pendingMoment;
      if (!pending) return;
      const choice = pending.choices.find(c => c.id === choiceId);
      if (!choice) return;

      choice.quickEffect.forEach(effect => {
        if (effect.stat === 'money') {
          updateMoney(effect.amount, `Life moment: ${pending.situation.substring(0, 30)}...`);
        } else {
          updateStats({ [effect.stat]: effect.amount }, false);
        }
      });

      // Moral choices move the karma fingerprint (honesty/generosity/loyalty…).
      if (choice.karma) {
        const k = choice.karma;
        setGameState(prev => ({
          ...prev,
          karma: applyKarmaChange(prev.karma ?? INITIAL_KARMA, k.dimension, k.amount, k.reason, prev.weeksLived ?? 0),
        }));
      }

      if (choice.hiddenConsequences && choice.hiddenConsequences.length > 0) {
        const { applyChoiceConsequences } = require('@/lib/lifeMoments/consequenceTracker');
        const consequenceResult = applyChoiceConsequences(
          gameState,
          pending.id,
          choiceId,
          choice.hiddenConsequences
        );

        setGameState(prev => {
          const { initializeConsequenceState } = require('@/lib/lifeMoments/consequenceTracker');
          const currentState = initializeConsequenceState(prev);
          return {
            ...prev,
            consequenceState: {
              ...currentState,
              ...consequenceResult.updatedState,
              consequences: consequenceResult.newConsequences,
            },
          };
        });
      }

      // The moment was already counted when it was GENERATED
      // (applyLifeMoment.ts). Resolving it must NOT re-increment the counters —
      // just clear the pending moment. (Previously double-counted every moment.)
      setGameState(prev => ({
        ...prev,
        lifeMoments: {
          ...(prev.lifeMoments || {}),
          lastMomentWeek: prev.lifeMoments?.lastMomentWeek ?? prev.weeksLived,
          momentsThisWeek: prev.lifeMoments?.momentsThisWeek ?? 0,
          totalMoments: prev.lifeMoments?.totalMoments ?? 0,
          pendingMoment: undefined,
        },
      }));

      saveGame();
    },
    [gameState, setGameState, updateStats, updateMoney, saveGame]
  );

  // Dismiss without applying a choice. Clears pendingMoment the same way the
  // choice handler does so an empty/malformed moment can't soft-lock the UI
  // and Android back works.
  const handleDismiss = useCallback(() => {
    if (!gameState.lifeMoments?.pendingMoment) return;
    setGameState(prev => ({
      ...prev,
      lifeMoments: {
        lastMomentWeek: prev.lifeMoments?.lastMomentWeek ?? prev.weeksLived,
        momentsThisWeek: prev.lifeMoments?.momentsThisWeek ?? 0,
        totalMoments: prev.lifeMoments?.totalMoments ?? 0,
        pendingMoment: undefined,
      },
    }));
    saveGame();
  }, [gameState, setGameState, saveGame]);

  if (!moment) return null;

  const hasChoices = Array.isArray(moment.choices) && moment.choices.length > 0;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleDismiss}>
      <View style={styles.overlay}>
        <LinearGradient
          colors={settings.darkMode ? ['#1F2937', '#111827'] : ['#F8FAFC', '#FFFFFF']}
          style={styles.container}
        >
          <Text style={[styles.title, settings.darkMode && styles.titleDark]}>
            Life Moment
          </Text>
          <Text style={[styles.situation, settings.darkMode && styles.situationDark]}>
            {moment.situation}
          </Text>
          
          <View style={styles.choicesContainer}>
            {!hasChoices && (
              <TouchableOpacity
                style={[
                  styles.choiceButton,
                  settings.darkMode && styles.choiceButtonDark
                ]}
                onPress={handleDismiss}
                activeOpacity={0.8}
              >
                <Text style={[styles.choiceText, settings.darkMode && styles.choiceTextDark]}>
                  Dismiss
                </Text>
              </TouchableOpacity>
            )}
            {hasChoices && moment.choices.map((choice, index) => (
              <TouchableOpacity
                key={choice.id}
                style={[
                  styles.choiceButton,
                  settings.darkMode && styles.choiceButtonDark
                ]}
                onPress={() => handleChoice(choice.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.choiceText, settings.darkMode && styles.choiceTextDark]}>
                  {choice.text}
                </Text>
                {choice.quickEffect.length > 0 && (
                  <View style={styles.effectsContainer}>
                    {choice.quickEffect.map((effect, i) => (
                      <View key={i} style={styles.effectItem}>
                        {effect.amount > 0 ? (
                          <ArrowUp size={12} color="#10B981" />
                        ) : effect.amount < 0 ? (
                          <ArrowDown size={12} color="#EF4444" />
                        ) : null}
                        <Text style={[
                          styles.effectText,
                          effect.amount > 0 ? styles.positiveEffect : styles.negativeEffect,
                          settings.darkMode && styles.effectTextDark
                        ]}>
                          {effect.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  titleDark: {
    color: '#F9FAFB',
  },
  situation: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  situationDark: {
    color: '#D1D5DB',
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
  choiceText: {
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 8,
    fontWeight: '500',
  },
  choiceTextDark: {
    color: '#F9FAFB',
  },
  effectsContainer: {
    gap: 4,
    marginTop: 4,
  },
  effectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  effectText: {
    fontSize: 12,
    fontWeight: '500',
  },
  positiveEffect: {
    color: '#10B981',
  },
  negativeEffect: {
    color: '#EF4444',
  },
  effectTextDark: {
    // Dark mode handled by positive/negative colors
  },
});

