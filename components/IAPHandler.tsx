import React, { useEffect } from 'react';
import { Alert } from 'react-native';
import type { GameState } from '@/contexts/game/types';
// BUGFIX: importing from `@/contexts/GameContext` re-routes through the
// `contexts/game/index.ts` barrel which in turn imports `GameProvider` which
// imports this file — a require cycle that left `useGame` undefined during
// onboarding boot and crashed `<Stack>` with "Element type is invalid".
// Pulling the hooks directly from the leaf context modules breaks the cycle.
import { useGameState } from '@/contexts/game/GameStateContext';
import { useGameActions } from '@/contexts/game/GameActionsContext';
import { iapService, IAPService } from '@/services/IAPService';
import { logger } from '@/utils/logger';

export function IAPHandler() {
    const { setGameState } = useGameState();
    const { saveGame } = useGameActions();

    useEffect(() => {
        logger.info('IAPHandler: Registering state updater');

        // Register updater
        iapService.setStateUpdater(async (productId, opts) => {
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
                    // `opts.entitlementsOnly` is set when RESTORING a mixed product —
                    // a consumable that also carries permanent entitlements. It drops
                    // every quantity grant so a Restore Purchases tap can never
                    // re-credit the Mega Pack's 40,000 gems.
                    const applied = iapService.applyProductToState(newState as GameState, productId, opts);

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

    // ── Entitlements present but unreadable → offer a restore ──────────────
    //
    // `loadPermanentPerks` already detects this precisely: a permanent-perk
    // envelope that EXISTS but fails verification means the player bought
    // something and we cannot read it — not that they never bought anything. It
    // sets `entitlementsUnreadable` and persists a marker, and the comment
    // there says the point is "so the app can offer a restore instead of
    // silently presenting a paying player as never having bought anything".
    //
    // Nothing ever read it. The detection shipped; the offer did not, so the
    // paying player got silence and an app that behaved as if they were free.
    // The usual trigger is a change to EXPO_PUBLIC_SAVE_HMAC_KEY, which
    // invalidates every entitlement envelope on every device at once — and a
    // restore genuinely fixes it, because the App Store is the source of truth
    // and the re-grant re-signs under the CURRENT key.
    useEffect(() => {
        let cancelled = false;

        const offerRestore = async () => {
            try {
                if (!(await IAPService.areEntitlementsUnreadable())) return;
                if (cancelled) return;

                logger.warn('IAPHandler: entitlements unreadable — prompting for restore');
                Alert.alert(
                    'Restore Your Purchases',
                    "We can see you've bought something, but this device can't read the record right now. " +
                        'Restoring re-checks with the App Store and puts everything back. Your purchases are safe.',
                    [
                        { text: 'Later', style: 'cancel' },
                        {
                            text: 'Restore',
                            onPress: () => {
                                void (async () => {
                                    try {
                                        const { success } = await iapService.restorePurchases();
                                        if (success) {
                                            await iapService.loadPurchases();
                                            // Only clear the marker on a real restore, so a
                                            // failed attempt still prompts next launch.
                                            await IAPService.clearEntitlementsUnreadable();
                                        }
                                    } catch (restoreError) {
                                        logger.error('IAPHandler: restore after unreadable entitlements failed', restoreError);
                                    }
                                })();
                            },
                        },
                    ]
                );
            } catch (error) {
                // Never let a diagnostic prompt take the app down.
                logger.error('IAPHandler: entitlement readability check failed', error);
            }
        };

        void offerRestore();
        return () => {
            cancelled = true;
        };
    }, []);

    return null;
}
