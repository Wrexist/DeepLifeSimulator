/**
 * Full-screen Modals that raise gameAlert must NEST their own AlertHost.
 *
 * iOS presents an RN Modal from the view controller nearest its mount point.
 * While a full-screen Modal is presented, the root AlertHost's sibling Modal
 * is silently refused the presentation - the dialog never renders and the tap
 * that raised it looks dead. That is exactly how "Start New Life" on the death
 * screen became a dead button: its "erase and start over?" confirm went to the
 * root host and nothing appeared.
 *
 * The fix is the repo's established iOS-safe pattern (GemShopModal ->
 * OfferCenterModal): mount an AlertHost INSIDE the presented Modal so its
 * dialog presents from that Modal's own view controller. gameAlert dispatches
 * to the most recently registered host (utils/gameAlert.ts), so the nested
 * copy takes over exactly while its Modal is up.
 *
 * This used to be a HAND-MAINTAINED list of three files, with a comment asking
 * the next author to remember to extend it. They didn't: a scan on 2026-09-04
 * found THIRTEEN more surfaces that render a Modal and raise gameAlert from
 * inside it, including the property "Sell" confirm and the skill tree's
 * "Unlock" confirm - both reported from the field as buttons that light up and
 * do nothing. An inventory nobody can forget to update is the only kind worth
 * having, so the list is DERIVED now: every component that renders a Modal and
 * calls gameAlert is required to nest a host, and a new one fails here on the
 * commit that adds it.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../..');

/** The host itself renders the dialog; it obviously does not nest a copy. */
const EXEMPT = new Set(['components/ui/AlertHost.tsx']);

const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** Every .tsx under the UI roots, repo-relative, excluding tests. */
function uiFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
        walk(rel);
      } else if (entry.name.endsWith('.tsx') && !entry.name.includes('.test.')) {
        out.push(rel);
      }
    }
  };
  for (const root of ['components', 'app', 'src']) walk(root);
  return out;
}

/** Files that present a Modal AND raise gameAlert - the surfaces at risk. */
function surfacesNeedingAHost(): string[] {
  return uiFiles().filter((rel) => {
    if (EXEMPT.has(rel)) return false;
    const src = read(rel);
    return src.includes('<Modal') && /\bgameAlert\s*\(/.test(src);
  });
}

describe('modals that raise gameAlert nest their own AlertHost', () => {
  const surfaces = surfacesNeedingAHost();

  it('finds the surfaces to check (a scan returning nothing would pass vacuously)', () => {
    // Guards against a refactor that moves the UI out from under these roots
    // and turns this whole suite into a no-op.
    expect(surfaces.length).toBeGreaterThanOrEqual(16);
  });

  it.each(surfaces)('%s nests an <AlertHost /> inside its Modal', (rel) => {
    const src = read(rel);
    expect(src).toMatch(/import AlertHost from '@\/components\/ui\/AlertHost'/);
    const hostAt = src.indexOf('<AlertHost />');
    const lastModalClose = src.lastIndexOf('</Modal>');
    expect(hostAt).toBeGreaterThan(-1);
    // Inside the Modal subtree: rendered before the component's closing
    // </Modal>, not as a sibling after it.
    expect(lastModalClose).toBeGreaterThan(hostAt);
  });

  /**
   * `BaseModal` is itself a raw RN Modal, so the 22 components built on it are
   * presented sheets too - and `'<Modal'` does not match `'<BaseModal'`, which
   * is how the Spark Premium and Verified Pro upsells raised their "cancel
   * subscription?" confirms from inside a presented sheet with no host and
   * nothing appeared (found by the 2026-09-04 release audit). One host inside
   * BaseModal covers every consumer; this pins that it stays there, and that
   * the consumers it is covering are still being counted.
   */
  it('BaseModal hosts its own AlertHost, covering every BaseModal consumer', () => {
    const src = read('components/ui/BaseModal.tsx');
    expect(src).toMatch(/import AlertHost from '@\/components\/ui\/AlertHost'/);
    const hostAt = src.indexOf('<AlertHost />');
    const lastModalClose = src.lastIndexOf('</Modal>');
    expect(hostAt).toBeGreaterThan(-1);
    expect(lastModalClose).toBeGreaterThan(hostAt);
  });

  it('finds the BaseModal consumers that raise gameAlert (the scan is not vacuous)', () => {
    const consumers = uiFiles().filter((rel) => {
      const src = read(rel);
      return src.includes('<BaseModal') && /\bgameAlert\s*\(/.test(src);
    });
    // TravelApp, PetApp, VerifiedProUpsellModal, SparkPremiumUpsellModal today.
    expect(consumers.length).toBeGreaterThanOrEqual(4);
  });

  it('DeathPopup nests LifeStoryModal too (a sibling Modal cannot present)', () => {
    const src = read('components/DeathPopup.tsx');
    const storyAt = src.indexOf('<LifeStoryModal');
    const lastModalClose = src.lastIndexOf('</Modal>');
    expect(storyAt).toBeGreaterThan(-1);
    expect(lastModalClose).toBeGreaterThan(storyAt);
  });

  it('the death screen cash-revive row deep-links to the SKU it is offering', () => {
    // Was pinned to REVIVAL_PACK. The row now resolves WHICH revive it is
    // selling - the repeatable consumable when the store has it, the one-time
    // pack otherwise - so the deep link has to follow that choice rather than
    // a hardcoded id. Which SKU wins is covered by
    // __tests__/monetization/repeatableRevive.test.ts.
    const src = read('components/DeathPopup.tsx');
    expect(src).toMatch(/bridgeToStore\('perks', cashReviveProductId\)/);
  });
});

/**
 * The deep-linked buy is one gesture: tap "Revival Pack" on the death screen,
 * confirm, land back on the death screen with the pack ready to spend. Each
 * assertion below is a step that, if dropped, silently turns it back into
 * "you are now in a shop, find your own way out".
 */
describe('the Revival Pack buy is a single gesture', () => {
  const shop = () => read('components/GemShopModal.tsx');

  it('waits for the catalog before auto-opening the confirm', () => {
    // Firing before the catalog loads would hit the per-SKU availability gate
    // and tell the player a real product is unavailable.
    expect(shop()).toMatch(/!storeReady/);
  });

  it('waits for the sheet to finish presenting (iOS refuses a mid-animation present)', () => {
    const src = shop();
    expect(src).toMatch(/onShow=\{\(\) => setSheetShown\(true\)\}/);
    expect(src).toMatch(/!sheetShown/);
  });

  it('fires at most once per open', () => {
    expect(shop()).toMatch(/autoPurchaseFiredRef\.current = true/);
  });

  it('routes through the SAME handlePurchase every Buy button uses', () => {
    // Not a second copy of the transaction flow on the death screen.
    expect(shop()).toMatch(/void handlePurchase\(initialPurchaseId/);
  });

  it('returns to the caller after a deep-linked purchase, on acknowledgement', () => {
    const src = shop();
    expect(src).toMatch(/const returnAfter = id === initialPurchaseId/);
    // Closing must hang off the receipt's OK, not run beside it: this sheet
    // hosts the alert, so unmounting it early would take the message with it.
    expect(src).toMatch(/returnAfter \? \[\{ text: 'OK', style: 'default', onPress: onClose \}\] : undefined/);
  });

  it('does not close the sheet on a failed purchase (let them retry)', () => {
    const src = shop();
    const failBranch = src.slice(src.indexOf("const errorMessage"), src.indexOf('} catch (error)'));
    expect(failBranch).not.toContain('onClose');
  });
});

/**
 * The fresh start keeps what the player owns. These pin the wiring; the
 * behaviour itself is covered by __tests__/monetization/newLifeCarryOver.test.ts.
 */
describe('fresh start carries gems and purchases', () => {
  it('the death screen banks the carry BEFORE the slot is deleted', () => {
    const src = read('components/DeathPopup.tsx');
    const stashAt = src.indexOf('stashNewLifeCarryOver(gameState)');
    const deleteAt = src.indexOf('deleteSaveSlot(currentSlot)');
    expect(stashAt).toBeGreaterThan(-1);
    expect(deleteAt).toBeGreaterThan(-1);
    expect(stashAt).toBeLessThan(deleteAt);
  });

  it('onboarding applies the pending carry to the new life', () => {
    // Lives in the shared start-life hook now (see useStartLife).
    expect(read('src/features/onboarding/useStartLife.ts')).toMatch(
      /await applyPendingNewLifeCarryOver\(newState\)/,
    );
  });

  it('the confirm no longer claims gems or purchases are erased', () => {
    const src = read('components/DeathPopup.tsx');
    const alertAt = src.indexOf("'Start a completely new life?'");
    expect(alertAt).toBeGreaterThan(-1);
    const body = src.slice(alertAt, alertAt + 900);
    expect(body).toMatch(/gems and anything you have purchased carry over/i);
    // The old copy listed a gem count among the things it erased.
    expect(body).not.toMatch(/erases[^`]*gems/i);
  });
});
