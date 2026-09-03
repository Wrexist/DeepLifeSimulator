import React, { createContext, useContext, useCallback, ReactNode, useMemo } from 'react';
import { Alert } from 'react-native';
import {
  executeWedding,
  goOnDate as goOnDateAction,
  giveGift as giveGiftAction,
  fileDivorce as fileDivorceAction,
} from './actions/DatingActions';
import { updateMoney as rawUpdateMoney } from './actions/MoneyActions';
import { updateStats as rawUpdateStats } from './actions/StatsActions';
import { haptic } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import { formatMoney } from '@/utils/moneyFormatting';
import { useSetGameState, useGameStateGetter } from './useGameSelector';
import { useUIUX } from '@/contexts/UIUXContext';

/**
 * Social actions - dating, gifts, weddings, children, divorce.
 *
 * THREE VERBS WERE REMOVED HERE (Program 11), and it is worth saying which and
 * why, because they looked like features:
 *
 *   - `increaseRelationshipLevel(id)` - +5 bond, no cost, no cooldown, no cap.
 *   - `inviteToEvent(id, type)` - +3 bond, +5 happiness, −5 energy, no cooldown.
 *   - `startConversation(id)` - +2 bond, +2 happiness, no cost, no cooldown.
 *
 * A repo-wide search found ZERO callers for all three: no screen, no hook, no
 * test, and nothing in the aggregated `useGameActions` surface either. They
 * were dead. That matters more than tidiness, because the first one is a free
 * uncapped bond faucet and the third a free uncapped happiness faucet - the
 * exact gate-then-grant shape CLAUDE.md §4.4 exists to stop - sitting on a
 * public provider API where the next feature to reach for "raise this bond"
 * would have found them before it found the guarded versions.
 *
 * The guarded versions already exist and are what the UI calls:
 * `recordInteraction` (Call / Hang Out - once per action per week, priced) and
 * `raiseRelationship` (the paid gesture, diminishing, once a week), both in
 * `ContactsActions`. Deleting the unguarded twins leaves one way to do it.
 */
interface SocialActionsContextType {
  // Dating & Relationships
  executeWedding: (partnerId: string) => void;
  startDating: (characterId: string) => void;
  breakUp: (relationshipId: string) => void;

  // Social Actions
  goOnDate: (characterId: string) => void;
  giveGift: (characterId: string, giftId: string) => void;

  // Family
  haveChild: (partnerId: string) => void;
  nameChild: (childId: string, name: string) => void;
  divorce: () => void;
}

/**
 * Deps bundle for DatingActions, which take the MODULE form
 * `updateMoney(setGameState, amount, reason)` - see CLAUDE.md Hard Rule #5.
 *
 * Module scope, not component scope. Both members are imports, so the object
 * never varies between renders; building it inside the provider allocated a
 * fresh one on every render and made `react-hooks/exhaustive-deps` flag four
 * callbacks for omitting it. Adding it to those deps would have been the wrong
 * fix - a new identity each render would rebuild all four callbacks every time,
 * which is the opposite of what the rule is for. Hoisting removes the warning
 * and the allocation at once, and puts the invariance in the type system's
 * hands rather than a comment's.
 */
const DATING_DEPS = { updateMoney: rawUpdateMoney, updateStats: rawUpdateStats } as const;

/** The gift kinds `DatingActions.giveGift` accepts. */
const GIFT_TYPES = ['flowers', 'jewelry', 'trip', 'surprise', 'luxury'] as const;
type GiftType = typeof GIFT_TYPES[number];

const isGiftType = (id: string): id is GiftType =>
  (GIFT_TYPES as readonly string[]).includes(id);

const SocialActionsContext = createContext<SocialActionsContextType | undefined>(undefined);

export function useSocialActions() {
  const context = useContext(SocialActionsContext);
  if (!context) {
    throw new Error('useSocialActions must be used within SocialActionsProvider');
  }
  return context;
}

interface SocialActionsProviderProps {
  children: ReactNode;
}

export function SocialActionsProvider({ children }: SocialActionsProviderProps) {
  const setGameState = useSetGameState();
  const { showError, showInfoBanner } = useUIUX();

  // M4: read the LIVE state on demand instead of mirroring it into a ref.
  // The old idiom (`useRef(gameState)` + a post-commit `useEffect`) forced this
  // provider to subscribe to the ENTIRE GameState purely to keep the ref fresh,
  // and still handed callbacks a snapshot that was one commit stale - the
  // staleness the gate->grant class (CLAUDE.md 4.4) exploits. `useGameStateGetter`
  // returns a stable getter over the same store, so callbacks stay stable, the
  // memoized context value keeps its identity, and the provider no longer
  // re-renders on every mutation. Reads are still OUTSIDE the updater, so the
  // authoritative re-check inside `setGameState(prev => ...)` stays mandatory.
  const getGameState = useGameStateGetter();

  // --- Dating & Relationships Actions ---

  const executeWeddingAction = useCallback((partnerId: string) => {
    const state = getGameState();
    if (!state) return;

    const result = executeWedding(state, setGameState, partnerId, DATING_DEPS);
    if (result?.success) {
      haptic.heavy(); // Wedding - major life event!
      showInfoBanner('Wedding Success', result.message || 'You got married!');
    } else {
      showError('Wedding Failed', result?.message || 'Could not get married');
    }
  }, [setGameState, showError, showInfoBanner]);

  const startDating = useCallback((characterId: string) => {
    const state = getGameState();
    if (!state) return;

    // Check if already in a relationship
    const existingPartner = state.relationships?.find(r => r.type === 'partner' || r.type === 'spouse');
    if (existingPartner) {
      showError('Already in a Relationship', `You are already with ${existingPartner.name}.`);
      return;
    }

    logger.info('Started dating:', { characterId });
    showInfoBanner('Dating', 'You started a new relationship!');
  }, [showError, showInfoBanner]);

  const breakUp = useCallback((relationshipId: string) => {
    const state = getGameState();
    if (!state) return;

    const relationship = state.relationships?.find(r => r.id === relationshipId);
    if (!relationship) {
      showError('Error', 'Relationship not found.');
      return;
    }

    if (relationship.type === 'spouse') {
      showError('Cannot Break Up', 'You are married. File for divorce instead.');
      return;
    }

    if (relationship.type !== 'partner' && relationship.type !== 'friend') {
      showError('Error', 'You cannot break up with this person.');
      return;
    }

    // Remove the relationship and decrease happiness
    setGameState(prev => ({
      ...prev,
      relationships: (prev.relationships || []).filter(r => r.id !== relationshipId),
    }));
    rawUpdateStats(setGameState, { happiness: -15 });

    showInfoBanner('Break Up', `You ended your relationship with ${relationship.name}.`);
    logger.info('Broke up with:', { relationshipId, name: relationship.name });
  }, [setGameState, showError, showInfoBanner]);

  // --- Social Actions ---

  const goOnDate = useCallback((characterId: string) => {
    const state = getGameState();
    if (!state) return;

    const result = goOnDateAction(state, setGameState, characterId, 'casual', DATING_DEPS);
    if (result?.success) {
      showInfoBanner('Date', result.message || 'You had a great date!');
    } else {
      showError('Date Failed', result?.message || 'Could not go on date.');
    }
  }, [setGameState, showError, showInfoBanner]);

  const giveGift = useCallback((characterId: string, giftId: string) => {
    const state = getGameState();
    if (!state) return;

    // Map giftId to DatingActions gift types; default to 'flowers'.
    // `isGiftType` narrows instead of casting: `includes` wants its argument to
    // already BE the union, which is what the old `giftId as any` was working
    // around - and that cast also silenced the second one on the result. A
    // predicate does the same job with the narrowing the compiler can check.
    const giftType = isGiftType(giftId) ? giftId : 'flowers';

    const result = giveGiftAction(state, setGameState, characterId, giftType, DATING_DEPS);
    if (result?.success) {
      showInfoBanner('Gift', result.message || 'Your gift was appreciated!');
    } else {
      showError('Gift Failed', result?.message || 'Could not give gift.');
    }
  }, [setGameState, showError, showInfoBanner]);

  // --- Family Actions ---

  const haveChild = useCallback((partnerId: string) => {
    const state = getGameState();
    if (!state) return;

    const partner = state.relationships?.find(r => r.id === partnerId && (r.type === 'partner' || r.type === 'spouse'));
    if (!partner) {
      logger.error('Partner not found for having child:', partnerId);
      return;
    }

    // Block if partner is already pregnant
    if (partner.isPregnant) {
      Alert.alert('Already Expecting', `${partner.name} is already pregnant! Wait for the baby to arrive.`);
      return;
    }

    // Pregnancy cooldown: 40 weeks (~10 months) between children to prevent spam
    const PREGNANCY_COOLDOWN_WEEKS = 40;
    const currentWeeksLived = state.weeksLived || 0;
    const children = state.family?.children || [];
    if (children.length > 0) {
      const lastChildBirthWeek = Math.max(
        ...children.map((c: any) => c.birthWeeksLived || 0)
      );
      if (lastChildBirthWeek > 0 && currentWeeksLived - lastChildBirthWeek < PREGNANCY_COOLDOWN_WEEKS) {
        const weeksRemaining = PREGNANCY_COOLDOWN_WEEKS - (currentWeeksLived - lastChildBirthWeek);
        Alert.alert(
          'Too Soon',
          `You need to wait ${weeksRemaining} more week(s) before trying for another child.`
        );
        return;
      }
    }

    if (state.stats.money < 5000) {
      logger.warn(`Not enough money for child: have ${formatMoney(state.stats.money)}, need $5,000`);
      Alert.alert(
        'Not Enough Money',
        `You need at least $5,000 to start a family. You currently have ${formatMoney(state.stats.money)}.`
      );
      return;
    }

    if (partner.relationshipScore < 70) {
      logger.error('Relationship score too low for child:', partner.relationshipScore);
      Alert.alert(
        'Not Ready',
        `Your relationship with ${partner.name} needs to be stronger before starting a family. Current: ${partner.relationshipScore}/100`
      );
      return;
    }

    // Determine child gender and name at conception
    const childNames = {
      male: ['Alexander', 'Benjamin', 'Charles', 'Daniel', 'Edward', 'Felix', 'Gabriel', 'Henry', 'Isaac', 'Jacob', 'Kevin', 'Liam', 'Matthew', 'Nathan', 'Oliver', 'Patrick', 'Quentin', 'Ryan', 'Samuel', 'Thomas', 'Ulysses', 'Victor', 'William', 'Xavier', 'Yosef', 'Zachary'],
      female: ['Abigail', 'Beatrice', 'Catherine', 'Delilah', 'Elizabeth', 'Felicity', 'Gabriella', 'Hannah', 'Isabella', 'Jessica', 'Katherine', 'Lily', 'Madison', 'Natalie', 'Olivia', 'Penelope', 'Quinn', 'Rebecca', 'Sophia', 'Taylor', 'Ursula', 'Victoria', 'Willow', 'Xanthe', 'Yasmine', 'Zoe']
    };

    const childGender: 'male' | 'female' = Math.random() < 0.5 ? 'male' : 'female';
    const namePool = childNames[childGender];
    const childName = namePool[Math.floor(Math.random() * namePool.length)];

    // Start pregnancy instead of instant child creation
    setGameState(prev => {
      /**
       * R3-F9: re-check inside the updater.
       *
       * `isPregnant`, the 40-week cooldown, the $5,000 cost and the
       * relationship-score floor were all checked against the stale
       * `getGameState()`, and this updater re-checked none of them while
       * unconditionally applying +20 happiness. The only caller sits behind an
       * `Alert.alert` confirm that dismisses on first press, so landing two
       * calls in one React batch is impractical - this is the pattern being
       * closed, not a live exploit. CLAUDE.md §4.4.
       */
      const partner = (prev.relationships || []).find(r => r.id === partnerId);
      if (!partner || partner.isPregnant) return prev;

      return {
      ...prev,
      stats: {
        ...prev.stats,
        happiness: Math.min(100, (prev.stats.happiness || 0) + 20),
      },
      relationships: (prev.relationships || []).map(r =>
        r.id === partnerId ? {
          ...r,
          isPregnant: true,
          pregnancyStartWeek: prev.weeksLived || 0,
          pregnancyChildGender: childGender,
          pregnancyChildName: childName,
        } : r
      ),
      // R2-B: cap to 200 milestones.
      lifeMilestones: [
        ...(prev.lifeMilestones || []),
        {
          id: `pregnancy_${prev.weeksLived || 0}_${partnerId}`,
          type: 'pregnancy_start' as const,
          week: prev.weeksLived || 0,
          year: prev.date?.year || 0,
          partnerId,
          details: { childName, childGender },
        },
      ].slice(-200),
      };
    });

    haptic.medium();
    logger.info(`Pregnancy started: ${childName} (${childGender}) with ${partner.name}`);

    Alert.alert(
      '🎉 Wonderful News!',
      `You and ${partner.name} are expecting a baby! ${childGender === 'male' ? 'A boy' : 'A girl'} is on the way. The baby should arrive in about 10 weeks.`,
    );

    return {
      success: true,
      message: `You and ${partner.name} are expecting a baby!`
    };
  }, [setGameState]);

  const nameChild = useCallback((childId: string, name: string) => {
    const state = getGameState();
    if (!state) return;

    setGameState(prev => ({
      ...prev,
      relationships: (prev.relationships || []).map(r =>
        r.id === childId ? { ...r, name } : r
      ),
      family: {
        ...prev.family,
        children: (prev.family?.children || []).map((c: any) =>
          c.id === childId ? { ...c, name } : c
        ),
      },
    }));
    logger.info('Named child:', { childId, name });
  }, [setGameState]);

  const divorce = useCallback(() => {
    const state = getGameState();
    if (!state) return;

    const spouse = state.relationships?.find(r => r.type === 'spouse');
    if (!spouse) {
      showError('Error', 'You are not married.');
      return;
    }

    const result = fileDivorceAction(state, setGameState, spouse.id, DATING_DEPS);
    if (result?.success) {
      showInfoBanner('Divorce', result.message || 'The divorce was finalized.');
    } else {
      showError('Divorce Failed', result?.message || 'Could not file for divorce.');
    }
  }, [setGameState, showError, showInfoBanner]);

  const value = useMemo<SocialActionsContextType>(() => ({
    executeWedding: executeWeddingAction,
    startDating,
    breakUp,
    goOnDate,
    giveGift,
    haveChild,
    nameChild,
    divorce,
  }), [executeWeddingAction, startDating, breakUp, goOnDate, giveGift, haveChild, nameChild, divorce]);

  return (
    <SocialActionsContext.Provider value={value}>
      {children}
    </SocialActionsContext.Provider>
  );
}
