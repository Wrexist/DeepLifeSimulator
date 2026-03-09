import React, { createContext, useContext, useCallback, ReactNode, useMemo, useRef, useEffect } from 'react';
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
import { useGameState } from './GameStateContext';
import { useUIUX } from '@/contexts/UIUXContext';

interface SocialActionsContextType {
  // Dating & Relationships
  executeWedding: (partnerId: string) => void;
  startDating: (characterId: string) => void;
  breakUp: (relationshipId: string) => void;
  increaseRelationshipLevel: (relationshipId: string) => void;

  // Social Actions
  goOnDate: (characterId: string) => void;
  inviteToEvent: (characterId: string, eventType: string) => void;
  giveGift: (characterId: string, giftId: string) => void;
  startConversation: (characterId: string) => void;

  // Family
  haveChild: (partnerId: string) => void;
  nameChild: (childId: string, name: string) => void;
  divorce: () => void;
}

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
  const { gameState, setGameState } = useGameState();
  const { showError, showInfo } = useUIUX();

  // Ref keeps latest state for callbacks without adding gameState to deps
  const stateRef = useRef(gameState);
  useEffect(() => { stateRef.current = gameState; }, [gameState]);

  // Deps bundle for DatingActions (uses raw functions that take setGameState as first arg)
  const datingDeps = { updateMoney: rawUpdateMoney, updateStats: rawUpdateStats };

  // --- Dating & Relationships Actions ---

  const executeWeddingAction = useCallback((partnerId: string) => {
    const state = stateRef.current;
    if (!state) return;

    const result = executeWedding(state, setGameState, partnerId, datingDeps);
    if (result?.success) {
      haptic.heavy(); // Wedding — major life event!
      showInfo('Wedding Success', result.message);
    } else {
      showError('Wedding Failed', result?.message || 'Could not get married');
    }
  }, [setGameState, showError, showInfo]);

  const startDating = useCallback((characterId: string) => {
    const state = stateRef.current;
    if (!state) return;

    // Check if already in a relationship
    const existingPartner = state.relationships?.find(r => r.type === 'partner' || r.type === 'spouse');
    if (existingPartner) {
      showError('Already in a Relationship', `You are already with ${existingPartner.name}.`);
      return;
    }

    logger.info('Started dating:', { characterId });
    showInfo('Dating', 'You started a new relationship!');
  }, [showError, showInfo]);

  const breakUp = useCallback((relationshipId: string) => {
    const state = stateRef.current;
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

    showInfo('Break Up', `You ended your relationship with ${relationship.name}.`);
    logger.info('Broke up with:', { relationshipId, name: relationship.name });
  }, [setGameState, showError, showInfo]);

  const increaseRelationshipLevel = useCallback((relationshipId: string) => {
    const state = stateRef.current;
    if (!state) return;

    const relationship = state.relationships?.find(r => r.id === relationshipId);
    if (!relationship) return;

    const boost = 5;
    setGameState(prev => ({
      ...prev,
      relationships: (prev.relationships || []).map(r =>
        r.id === relationshipId
          ? { ...r, relationshipScore: Math.min(100, r.relationshipScore + boost) }
          : r
      ),
    }));
    logger.info('Relationship level increased:', { relationshipId, boost });
  }, [setGameState]);

  // --- Social Actions ---

  const goOnDate = useCallback((characterId: string) => {
    const state = stateRef.current;
    if (!state) return;

    const result = goOnDateAction(state, setGameState, characterId, 'casual', datingDeps);
    if (result?.success) {
      showInfo('Date', result.message);
    } else {
      showError('Date Failed', result?.message || 'Could not go on date.');
    }
  }, [setGameState, showError, showInfo]);

  const inviteToEvent = useCallback((characterId: string, eventType: string) => {
    const state = stateRef.current;
    if (!state) return;

    const relationship = state.relationships?.find(r => r.id === characterId);
    if (!relationship) {
      showError('Error', 'Person not found.');
      return;
    }

    // Boost relationship from spending time together
    setGameState(prev => ({
      ...prev,
      relationships: (prev.relationships || []).map(r =>
        r.id === characterId
          ? { ...r, relationshipScore: Math.min(100, r.relationshipScore + 3) }
          : r
      ),
    }));
    rawUpdateStats(setGameState, { happiness: 5, energy: -5 });

    showInfo('Event', `You invited ${relationship.name} to ${eventType}. They had a great time!`);
    logger.info('Invited to event:', { characterId, eventType });
  }, [setGameState, showError, showInfo]);

  const giveGift = useCallback((characterId: string, giftId: string) => {
    const state = stateRef.current;
    if (!state) return;

    // Map giftId to DatingActions gift types; default to 'flowers'
    const validGiftTypes = ['flowers', 'jewelry', 'trip', 'surprise', 'luxury'] as const;
    const giftType = validGiftTypes.includes(giftId as any) ? (giftId as typeof validGiftTypes[number]) : 'flowers';

    const result = giveGiftAction(state, setGameState, characterId, giftType, datingDeps);
    if (result?.success) {
      showInfo('Gift', result.message);
    } else {
      showError('Gift Failed', result?.message || 'Could not give gift.');
    }
  }, [setGameState, showError, showInfo]);

  const startConversation = useCallback((characterId: string) => {
    const state = stateRef.current;
    if (!state) return;

    const relationship = state.relationships?.find(r => r.id === characterId);
    if (!relationship) return;

    // Small relationship boost from chatting
    setGameState(prev => ({
      ...prev,
      relationships: (prev.relationships || []).map(r =>
        r.id === characterId
          ? { ...r, relationshipScore: Math.min(100, r.relationshipScore + 2) }
          : r
      ),
    }));
    rawUpdateStats(setGameState, { happiness: 2 });

    logger.info('Had conversation with:', { characterId, name: relationship.name });
  }, [setGameState]);

  // --- Family Actions ---

  const haveChild = useCallback((partnerId: string) => {
    const state = stateRef.current;
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
        ...children.map((c: any) => c.birthWeek || c.birthWeeksLived || 0)
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
      logger.warn(`Not enough money for child: have $${state.stats.money.toLocaleString()}, need $5,000`);
      Alert.alert(
        'Not Enough Money',
        `You need at least $5,000 to start a family. You currently have $${state.stats.money.toLocaleString()}.`
      );
      return;
    }

    if (partner.relationshipScore < 70) {
      logger.error('Relationship score too low for child:', partner.relationshipScore);
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
    setGameState(prev => ({
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
      ],
    }));

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
    const state = stateRef.current;
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
    const state = stateRef.current;
    if (!state) return;

    const spouse = state.relationships?.find(r => r.type === 'spouse');
    if (!spouse) {
      showError('Error', 'You are not married.');
      return;
    }

    const result = fileDivorceAction(state, setGameState, spouse.id, datingDeps);
    if (result?.success) {
      showInfo('Divorce', result.message);
    } else {
      showError('Divorce Failed', result?.message || 'Could not file for divorce.');
    }
  }, [setGameState, showError, showInfo]);

  const value = useMemo<SocialActionsContextType>(() => ({
    executeWedding: executeWeddingAction,
    startDating,
    breakUp,
    increaseRelationshipLevel,
    goOnDate,
    inviteToEvent,
    giveGift,
    startConversation,
    haveChild,
    nameChild,
    divorce,
  }), [executeWeddingAction, startDating, breakUp, increaseRelationshipLevel, goOnDate, inviteToEvent, giveGift, startConversation, haveChild, nameChild, divorce]);

  return (
    <SocialActionsContext.Provider value={value}>
      {children}
    </SocialActionsContext.Provider>
  );
}
