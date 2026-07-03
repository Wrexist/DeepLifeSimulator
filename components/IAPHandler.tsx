import React, { useEffect } from 'react';
import type { GameState } from '@/contexts/game/types';
// BUGFIX: importing from `@/contexts/GameContext` re-routes through the
// `contexts/game/index.ts` barrel which in turn imports `GameProvider` which
// imports this file — a require cycle that left `useGame` undefined during
// onboarding boot and crashed `<Stack>` with "Element type is invalid".
// Pulling the hooks directly from the leaf context modules breaks the cycle.
import { useGameState } from '@/contexts/game/GameStateContext';
import { useGameActions } from '@/contexts/game/GameActionsContext';
import { iapService } from '@/services/IAPService';
import { logger } from '@/utils/logger';

export function IAPHandler() {
    const { setGameState } = useGameState();
    const { saveGame } = useGameActions();

    useEffect(() => {
        logger.info('IAPHandler: Registering state updater');

        // Register updater
        iapService.setStateUpdater(async (productId) => {
            logger.info(`IAPHandler: Updating in-memory state for ${productId}`);

            return new Promise<boolean>((resolve) => {
                setGameState(prevState => {
                    if (!prevState) {
                        resolve(false);
                        return prevState;
                    }

                    // Deep clone state to ensure immutability.
                    // R2-E: use structuredClone (Hermes/RN 0.81+) — JSON round-trip
                    // is 60-150ms on a 200KB+ GameState AND drops `undefined`,
                    // `Date`, `Map`, `Set`, and function properties silently.
                    let newState;
                    try {
                        newState = typeof structuredClone === 'function'
                            ? structuredClone(prevState)
                            : JSON.parse(JSON.stringify(prevState));
                    } catch (e) {
                        logger.error('IAPHandler: Failed to clone state', e);
                        resolve(false);
                        return prevState;
                    }

                    // Apply logic using the shared helper
                    const applied = iapService.applyProductToState(newState as GameState, productId);

                    if (applied) {
                        logger.info('IAPHandler: State updated successfully');
                    } else {
                        logger.warn('IAPHandler: Failed to apply product to state');
                    }

                    // Save after React commits the state, then resolve
                    setTimeout(() => {
                        logger.info('IAPHandler: Triggering force save');
                        saveGame(true)
                            // Resolve with the ACTUAL apply result, not an
                            // unconditional `true`. IAPService keys its
                            // skip-disk-reapply guard on this boolean: if the
                            // in-memory apply failed (applied === false) but the
                            // save succeeded, resolving `true` made the service
                            // skip the additive disk re-apply and the paid
                            // consumable was silently never credited. `applied`
                            // is only true when the benefit actually landed.
                            .then(() => resolve(applied))
                            .catch(e => {
                                logger.error('IAPHandler: Save failed', e);
                                resolve(false);
                            });
                    }, 100);

                    return newState;
                });
            });
        });

        return () => {
            logger.info('IAPHandler: Unregistering state updater');
            iapService.setStateUpdater(null);
        };
    }, [setGameState, saveGame]);

    return null;
}
