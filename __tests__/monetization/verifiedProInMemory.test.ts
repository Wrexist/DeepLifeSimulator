/**
 * A DeepLife+ purchase grants Pulse Verified Pro. That grant used to be written
 * only to the ON-DISK save: the in-memory updater returned false for
 * subscriptions (no product config), so the live state never had it, and the
 * purchase flow's next save of the live state overwrote the disk copy.
 */
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { iapService } from '@/services/IAPService';
import { SUBSCRIPTION_PRODUCTS } from '@/utils/iapConfig';

describe('Verified Pro reaches the live state on a DeepLife+ purchase', () => {
  it('applies to the in-memory state and records the transaction', () => {
    const state = createTestGameState();
    const applied = iapService.applyProductToState(state, SUBSCRIPTION_PRODUCTS.PREMIUM_MONTHLY, {
      transactionId: 'tx-1',
    });
    expect(applied).toBe(true);
    expect(state.socialMedia?.verifiedPro?.active).toBe(true);
    expect(state.processedIAPTransactions).toContain('tx-1');
  });

  it('does not re-apply (or re-pay the 500 followers) for a recorded transaction', () => {
    const state = createTestGameState();
    iapService.applyProductToState(state, SUBSCRIPTION_PRODUCTS.PREMIUM_MONTHLY, { transactionId: 'tx-1' });
    const followers = state.socialMedia?.followers;
    iapService.applyProductToState(state, SUBSCRIPTION_PRODUCTS.PREMIUM_MONTHLY, { transactionId: 'tx-1' });
    expect(state.socialMedia?.followers).toBe(followers);
  });

  it('still refuses an unknown SKU', () => {
    expect(iapService.applyProductToState(createTestGameState(), 'not_a_product')).toBe(false);
  });
});
