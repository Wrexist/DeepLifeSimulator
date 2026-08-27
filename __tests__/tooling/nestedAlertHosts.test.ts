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
 * This suite pins the surfaces known to need it. If you add gameAlert calls
 * to a new full-screen Modal, nest an AlertHost there too and add the file
 * here.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../..');

/** Surfaces that present a Modal AND raise gameAlert from inside it. */
const NESTED_HOST_FILES = [
  'components/DeathPopup.tsx',
  'components/GemShopModal.tsx',
  'components/OfferCenterModal.tsx',
];

const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('modals that raise gameAlert nest their own AlertHost', () => {
  it.each(NESTED_HOST_FILES)('%s nests an <AlertHost /> inside its Modal', (rel) => {
    const src = read(rel);
    expect(src).toMatch(/import AlertHost from '@\/components\/ui\/AlertHost'/);
    const hostAt = src.indexOf('<AlertHost />');
    const lastModalClose = src.lastIndexOf('</Modal>');
    expect(hostAt).toBeGreaterThan(-1);
    // Inside the Modal subtree: rendered before the component's closing
    // </Modal>, not as a sibling after it.
    expect(lastModalClose).toBeGreaterThan(hostAt);
  });

  it('DeathPopup nests LifeStoryModal too (a sibling Modal cannot present)', () => {
    const src = read('components/DeathPopup.tsx');
    const storyAt = src.indexOf('<LifeStoryModal');
    const lastModalClose = src.lastIndexOf('</Modal>');
    expect(storyAt).toBeGreaterThan(-1);
    expect(lastModalClose).toBeGreaterThan(storyAt);
  });

  it('the death screen Revival Pack row deep-links to its own SKU', () => {
    const src = read('components/DeathPopup.tsx');
    expect(src).toMatch(/bridgeToStore\('perks', IAP_PRODUCTS\.REVIVAL_PACK\)/);
  });
});
