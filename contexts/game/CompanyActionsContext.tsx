/**
 * Company Actions Context
 * Provides warehouse and mining-related actions
 */

import React, { createContext, useContext, useCallback, ReactNode, useRef, useEffect, useMemo } from 'react';
import { useGameState } from './GameStateContext';
import { useUIUX } from '@/contexts/UIUXContext';
import * as CompanyActions from './company';
import * as MiningActions from './actions/MiningActions';
import { createFamilyBusiness as createFamilyBusinessModule } from './actions/FamilyBusinessActions';
import { enterCompetition as enterCompetitionModule, processCompetitionResults, advanceResearch } from './actions/RDActions';
import { updateMoney as updateMoneyModule } from './actions/MoneyActions';
import type { GameState } from './types';

interface CompanyActionsContextType {
  // Warehouse
  buyWarehouse: () => { success: boolean; message?: string };
  upgradeWarehouse: () => { success: boolean; message?: string };
  
  // Mining
  buyMiner: (minerId: string, minerName: string, cost: number) => { success: boolean; message?: string };
  sellMiner: (minerId: string, minerName: string, purchasePrice: number, companyId?: string) => { success: boolean; message?: string };
  selectMiningCrypto: (cryptoId: string, companyId?: string) => void;
  
  // Enhanced Mining Features
  buyMinerUpgrade: (upgradeId: string, minerId: string) => { success: boolean; message?: string };
  joinMiningPool: (poolId: string) => { success: boolean; message?: string };
  leaveMiningPool: () => { success: boolean; message?: string };
  stakeCrypto: (cryptoId: string, amount: number, lockWeeks: number) => { success: boolean; message?: string };
  claimStakingRewards: () => { success: boolean; message?: string; rewards?: number };
  upgradeEnergySystem: (energyType: 'solar' | 'wind' | 'hybrid') => { success: boolean; message?: string };
  upgradeAutomation: () => { success: boolean; message?: string };

  // Family Business & R&D Competition
  createFamilyBusiness: (companyId: string) => void;
  enterCompetition: (companyId: string, competitionId: string) => { success: boolean; message: string };
}

const CompanyActionsContext = createContext<CompanyActionsContextType | undefined>(undefined);

export function useCompanyActions() {
  const context = useContext(CompanyActionsContext);
  if (!context) {
    throw new Error('useCompanyActions must be used within CompanyActionsProvider');
  }
  return context;
}

interface CompanyActionsProviderProps {
  children: ReactNode;
}

export function CompanyActionsProvider({ children }: CompanyActionsProviderProps) {
  const { gameState, setGameState } = useGameState();
  const { showError } = useUIUX();
  // Use ref to always have latest state
  const stateRef = useRef<GameState | null>(gameState);
  
  useEffect(() => {
    stateRef.current = gameState;
  }, [gameState]);

  // R10-1: resolve due R&D competitions once per week. `enterCompetition` charges
  // the entry fee up front; this is the matching payout pass (previously orphaned,
  // so every entry was a pure money sink). Keyed on `weeksLived` so it fires once
  // per advance; processCompetitionResults is atomic + idempotent (it only touches
  // entries whose endWeek has arrived and that aren't already completed).
  const weeksLived = gameState?.weeksLived ?? 0;
  useEffect(() => {
    processCompetitionResults(setGameState, weeksLived);
  }, [weeksLived, setGameState]);

  // R&D research tick — the previously-missing driver that makes labs actually
  // finish research (before this, `completeResearch` had ZERO callers, so
  // research never completed). `advanceResearch` bumps each in-progress project's
  // progress by the lab's speed and finalises any that hit 100% (recording the
  // tech, rolling the patent opportunity + breakthrough income event).
  //
  // The `lastResearchWeekRef` guard makes it idempotent per week: a remount
  // (save reload / React StrictMode) or an unrelated re-render never grants a
  // free increment — it only advances when `weeksLived` genuinely changes.
  const lastResearchWeekRef = useRef<number>(weeksLived);
  useEffect(() => {
    if (lastResearchWeekRef.current === weeksLived) return; // already advanced this week
    lastResearchWeekRef.current = weeksLived;
    const state = stateRef.current;
    if (state) advanceResearch(state, setGameState);
  }, [weeksLived, setGameState]);

  const buyWarehouse = useCallback(() => {
    const latestState = stateRef.current;
    if (!latestState) {
      return { success: false, message: 'Game state not available' };
    }
    const result = CompanyActions.buyWarehouse(latestState, setGameState);
    if (!result.success) {
      showError('Purchase Failed', result.message || 'Could not purchase warehouse');
    }
    return result;
  }, [setGameState, showError]);

  const upgradeWarehouse = useCallback(() => {
    const latestState = stateRef.current;
    if (!latestState) {
      return { success: false, message: 'Game state not available' };
    }
    const result = CompanyActions.upgradeWarehouse(latestState, setGameState);
    if (!result.success) {
      showError('Upgrade Failed', result.message || 'Could not upgrade warehouse');
    }
    return result;
  }, [setGameState, showError]);

  const buyMiner = useCallback((minerId: string, minerName: string, cost: number) => {
    const latestState = stateRef.current;
    if (!latestState) {
      return { success: false, message: 'Game state not available' };
    }
    const result = CompanyActions.buyMiner(latestState, setGameState, minerId, minerName, cost);
    if (!result.success) {
      showError('Purchase Failed', result.message || 'Could not purchase miner');
    }
    return result;
  }, [setGameState, showError]);

  const sellMiner = useCallback((minerId: string, minerName: string, purchasePrice: number, companyId?: string) => {
    const latestState = stateRef.current;
    if (!latestState) {
      return { success: false, message: 'Game state not available' };
    }
    const result = CompanyActions.sellMiner(latestState, setGameState, minerId, minerName, purchasePrice, companyId);
    if (!result.success) {
      showError('Sale Failed', result.message || 'Could not sell miner');
    }
    return result;
  }, [setGameState, showError]);

  const selectMiningCrypto = useCallback((cryptoId: string, companyId?: string) => {
    const latestState = stateRef.current;
    if (!latestState) return;
    CompanyActions.selectMiningCrypto(latestState, setGameState, cryptoId, companyId);
  }, [setGameState]);

  // Enhanced Mining Features
  const buyMinerUpgrade = useCallback((upgradeId: string, minerId: string) => {
    const latestState = stateRef.current;
    if (!latestState) {
      return { success: false, message: 'Game state not available' };
    }
    const result = MiningActions.buyMinerUpgrade(latestState, setGameState, upgradeId, minerId);
    if (!result.success) {
      showError('Upgrade Failed', result.message || 'Could not purchase upgrade');
    }
    return result;
  }, [setGameState, showError]);

  const joinMiningPool = useCallback((poolId: string) => {
    const latestState = stateRef.current;
    if (!latestState) {
      return { success: false, message: 'Game state not available' };
    }
    const result = MiningActions.joinMiningPool(latestState, setGameState, poolId);
    if (!result.success) {
      showError('Pool Join Failed', result.message || 'Could not join pool');
    }
    return result;
  }, [setGameState, showError]);

  const leaveMiningPool = useCallback(() => {
    const latestState = stateRef.current;
    if (!latestState) {
      return { success: false, message: 'Game state not available' };
    }
    const result = MiningActions.leaveMiningPool(latestState, setGameState);
    if (!result.success) {
      showError('Pool Leave Failed', result.message || 'Could not leave pool');
    }
    return result;
  }, [setGameState, showError]);

  const stakeCrypto = useCallback((cryptoId: string, amount: number, lockWeeks: number) => {
    const latestState = stateRef.current;
    if (!latestState) {
      return { success: false, message: 'Game state not available' };
    }
    const result = MiningActions.stakeCrypto(latestState, setGameState, cryptoId, amount, lockWeeks);
    if (!result.success) {
      showError('Staking Failed', result.message || 'Could not stake crypto');
    }
    return result;
  }, [setGameState, showError]);

  const claimStakingRewards = useCallback(() => {
    const latestState = stateRef.current;
    if (!latestState) {
      return { success: false, message: 'Game state not available' };
    }
    const result = MiningActions.claimStakingRewards(latestState, setGameState);
    if (!result.success && result.message !== 'No rewards available yet') {
      showError('Claim Failed', result.message || 'Could not claim rewards');
    }
    return result;
  }, [setGameState, showError]);

  const upgradeEnergySystem = useCallback((energyType: 'solar' | 'wind' | 'hybrid') => {
    const latestState = stateRef.current;
    if (!latestState) {
      return { success: false, message: 'Game state not available' };
    }
    const result = MiningActions.upgradeEnergySystem(latestState, setGameState, energyType);
    if (!result.success) {
      showError('Upgrade Failed', result.message || 'Could not upgrade energy system');
    }
    return result;
  }, [setGameState, showError]);

  const upgradeAutomation = useCallback(() => {
    const latestState = stateRef.current;
    if (!latestState) {
      return { success: false, message: 'Game state not available' };
    }
    const result = MiningActions.upgradeAutomation(latestState, setGameState);
    if (!result.success) {
      showError('Upgrade Failed', result.message || 'Could not upgrade automation');
    }
    return result;
  }, [setGameState, showError]);

  const createFamilyBusiness = useCallback((companyId: string) => {
    const latestState = stateRef.current;
    if (!latestState) return;
    createFamilyBusinessModule(latestState, setGameState, companyId, { updateMoney: updateMoneyModule });
  }, [setGameState]);

  const enterCompetition = useCallback((companyId: string, competitionId: string) => {
    const latestState = stateRef.current;
    if (!latestState) {
      return { success: false, message: 'Game state not available' };
    }
    const result = enterCompetitionModule(latestState, setGameState, companyId, competitionId, { updateMoney: updateMoneyModule });
    if (!result.success) {
      showError('Competition Entry Failed', result.message);
    }
    return result;
  }, [setGameState, showError]);

  const value = useMemo<CompanyActionsContextType>(() => ({
    buyWarehouse,
    upgradeWarehouse,
    buyMiner,
    sellMiner,
    selectMiningCrypto,
    buyMinerUpgrade,
    joinMiningPool,
    leaveMiningPool,
    stakeCrypto,
    claimStakingRewards,
    upgradeEnergySystem,
    upgradeAutomation,
    createFamilyBusiness,
    enterCompetition,
  }), [buyWarehouse, upgradeWarehouse, buyMiner, sellMiner, selectMiningCrypto, buyMinerUpgrade, joinMiningPool, leaveMiningPool, stakeCrypto, claimStakingRewards, upgradeEnergySystem, upgradeAutomation, createFamilyBusiness, enterCompetition]);

  return (
    <CompanyActionsContext.Provider value={value}>
      {children}
    </CompanyActionsContext.Provider>
  );
}

