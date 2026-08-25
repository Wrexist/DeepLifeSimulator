import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { iapService } from '@/services/IAPService';
import { getProductConfig } from '@/utils/iapConfig';
import { logger } from '@/utils/logger';

/**
 * The ONE in-app-purchase flow, shared by every surface that can sell something.
 *
 * This used to live inside `GemShopModal` as a local `handlePurchase`, which is
 * why the death screen could not sell the Revival Pack: it had no way to run a
 * purchase, so it bridged out to the shop instead and left the player to find
 * the card and tap Buy a second time. Copying the flow onto the death screen
 * would have been a SECOND set of rules for taking someone's money - the
 * availability gate, the busy lock, the "you were charged but it did not apply"
 * message - so the flow moved here and both surfaces call it.
 *
 * Everything transactional still belongs to `IAPService`: this owns the store
 * subscription (so a buy button can degrade honestly while the catalog loads),
 * the per-SKU availability gate, the localized price, and the alerts.
 */

export interface StorePurchaseOptions {
  /** Price already rendered on the button, if the caller has one. */
  displayPrice?: string;
  /** Another operation (e.g. Restore) is in flight - refuse with the busy alert. */
  blocked?: boolean;
  /**
   * Show our own "Confirm Purchase" alert before handing off to the store.
   * Default true (the shop's long-standing behaviour). The death screen passes
   * false: its row already states the product and the price, and the platform's
   * own pay sheet is the confirmation - a second dialog in front of it just
   * adds a tap to the one flow where the player has already decided.
   */
  confirm?: boolean;
  /** Show the "Purchase Successful!" alert. Default true. */
  successAlert?: boolean;
  /**
   * Runs after a SUCCESSFUL purchase, before the success alert. The benefit has
   * already been granted by `IAPService` (in memory and on disk) by the time
   * this fires - use it to act on the grant, never to re-apply it.
   */
  onSuccess?: () => void | Promise<void>;
}

export function useStorePurchase() {
  const [iapState, setIapState] = useState(() => iapService.getState());
  // Scoped so ONLY the pressed product shows "Processing…", not every button.
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  // The in-flight LATCH is a ref, not the state above. `setPurchasingId(id)`
  // does not update `purchasingId` until the next render, so two taps landing in
  // one React batch would both read `null` and both open a store sheet - the
  // gate-then-act shape from CLAUDE.md §4.4. The ref flips synchronously.
  const inFlightRef = useRef(false);

  // Reflect the store's live connection/catalog so buy buttons can degrade to a
  // clear "Store unavailable" state instead of failing on tap. Presentation only
  // - no transaction logic here; the app initializes IAP at startup.
  useEffect(() => {
    setIapState(iapService.getState());
    const unsubscribe = iapService.addListener((s) => setIapState(s));
    return unsubscribe;
  }, []);

  const productsById = useMemo(() => {
    const map = new Map<string, any>();
    for (const p of iapState.products) {
      if (p && p.productId) map.set(p.productId, p);
    }
    return map;
  }, [iapState.products]);

  // True only when the store connected AND a non-empty catalog loaded - mirrors
  // iapService.isStoreAvailable(), but read from local state so the UI re-renders
  // when the catalog finishes loading.
  const storeReady = iapState.isConnected && iapState.products.length > 0;

  // Per-SKU availability: an IAP is buyable only if THIS product id actually
  // loaded from the store. `storeReady` (any product loaded) still drives the
  // global banner, but a mixed catalog - most SKUs loaded, one missing - must
  // not present a buyable button for the missing one on a config-price fallback.
  const isProductAvailable = useCallback(
    (id: string): boolean => productsById.has(id),
    [productsById],
  );

  // Prefer the store SDK's localized price; fall back to the config USD price.
  const resolveDisplayPrice = useCallback(
    (id: string): string => {
      const p = productsById.get(id);
      const localized = p?.displayPrice ?? p?.localizedPrice ?? p?.price;
      if (typeof localized === 'string' && localized.trim().length > 0) return localized;
      return getProductConfig(id)?.price ?? '';
    },
    [productsById],
  );

  const purchase = useCallback(
    async (id: string, name: string, options: StorePurchaseOptions = {}) => {
      const { displayPrice, blocked, confirm = true, successAlert = true, onSuccess } = options;

      if (inFlightRef.current || blocked) {
        Alert.alert('Please Wait', 'Another purchase is in progress. Please wait for it to complete.');
        return;
      }
      // Refuse before touching iapService when THIS SKU didn't load - its price on
      // the card is a config fallback, not a real store price, so it isn't buyable.
      if (!isProductAvailable(id)) {
        Alert.alert(
          'Item Unavailable',
          'This item isn’t available right now. Please check your connection and try again in a moment.',
        );
        return;
      }

      const priceText = displayPrice || resolveDisplayPrice(id);

      const run = async () => {
        // Re-latch here as well as at the gate above: with `confirm: true` the
        // gate ran BEFORE the dialog, so two taps could have queued two dialogs.
        if (inFlightRef.current) return;
        inFlightRef.current = true;
        setPurchasingId(id);
        try {
          logger.info(`Attempting to purchase: ${id} (${name})`);
          const result = await iapService.purchaseProduct(id);
          if (result.success) {
            // IAPService already applies benefits - do not re-apply here. The
            // callback acts ON the grant (the death screen spends it), and a
            // throw in it must not be reported as a failed purchase: the player
            // HAS been charged and HAS been granted.
            if (onSuccess) {
              try {
                await onSuccess();
              } catch (error) {
                logger.error('Post-purchase handler failed:', error);
              }
            }
            if (successAlert) {
              Alert.alert(
                'Purchase Successful!',
                result.message || 'Purchase completed! Your items have been added to your account.',
              );
            }
          } else {
            const errorMessage = result.message || 'Unable to complete purchase. Please try again.';
            if (!errorMessage.includes('cancelled')) {
              Alert.alert('Purchase Failed', errorMessage);
            }
          }
        } catch (error) {
          logger.error('Purchase error:', error);
          let errorMsg = 'An unexpected error occurred during purchase.';
          if (error instanceof Error) {
            errorMsg = error.message;
          }
          Alert.alert('Error', `${errorMsg}\n\nPlease try again or contact support if the problem persists.`);
        } finally {
          inFlightRef.current = false;
          setPurchasingId(null);
        }
      };

      if (!confirm) {
        await run();
        return;
      }

      Alert.alert(
        'Confirm Purchase',
        `Buy ${name}${priceText ? ` for ${priceText}` : ''}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: priceText ? `Buy ${priceText}` : 'Buy', onPress: run },
        ],
      );
    },
    [isProductAvailable, resolveDisplayPrice],
  );

  return {
    iapState,
    productsById,
    storeReady,
    isProductAvailable,
    resolveDisplayPrice,
    purchasingId,
    setPurchasingId,
    purchase,
  };
}
