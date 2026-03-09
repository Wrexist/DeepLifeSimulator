import React, { useEffect } from 'react';
import { useGame } from '@/contexts/GameContext';
import { iapService } from '@/services/IAPService';
import { logger } from '@/utils/logger';

export function IAPHandler() {
    const { setGameState, saveGame } = useGame();

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

                    // Deep clone state to ensure immutability
                    let newState;
                    try {
                        newState = JSON.parse(JSON.stringify(prevState));
                    } catch (e) {
                        logger.error('IAPHandler: Failed to clone state', e);
                        resolve(false);
                        return prevState;
                    }

                    // Apply logic using the shared helper
                    const applied = iapService.applyProductToState(newState, productId);

                    if (applied) {
                        logger.info('IAPHandler: State updated successfully');
                    } else {
                        logger.warn('IAPHandler: Failed to apply product to state');
                    }

                    // Save after React commits the state, then resolve
                    setTimeout(() => {
                        logger.info('IAPHandler: Triggering force save');
                        saveGame(true)
                            .then(() => resolve(true))
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
