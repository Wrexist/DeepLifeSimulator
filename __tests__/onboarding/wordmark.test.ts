/**
 * ONB-13 (owner decision 2026-10-22): one shared wordmark that matches the
 * store title. The boot screen and the main menu used to render different
 * names/taglines in the same position, so the game's name changed during the
 * boot -> menu handoff.
 */
import fs from 'fs';
import path from 'path';
import { PRODUCT_NAME, STORE_TITLE, WORDMARK, WORDMARK_ONE_LINE } from '@/lib/config/brand';

const root = path.join(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('ONB-13 - one wordmark', () => {
  it('matches the store title in marketing/aso (iOS name and Play title)', () => {
    const aso = read('marketing/aso/metadata.mjs');
    const apple = aso.slice(aso.indexOf('export const APPLE'), aso.indexOf('export const PLAY'));
    const play = aso.slice(aso.indexOf('export const PLAY'));
    expect(apple).toContain(`name: '${STORE_TITLE}'`);
    expect(play).toContain(`title: '${STORE_TITLE}'`);
  });

  it('is the store title before the colon', () => {
    const name = STORE_TITLE.split(':')[0].trim();
    expect(PRODUCT_NAME).toBe(name);
    expect(WORDMARK_ONE_LINE).toBe(name.toUpperCase());
  });

  it('the boot screen and the main menu both render it from the constant', () => {
    for (const rel of ['app/index.tsx', 'app/(onboarding)/MainMenu.tsx']) {
      const src = read(rel);
      expect(`${rel}:${src.includes("from '@/lib/config/brand'")}`).toBe(`${rel}:true`);
      for (const key of ['tagline', 'top', 'bottom']) {
        expect(`${rel}:${key}:${src.includes(`{WORDMARK.${key}}`)}`).toBe(`${rel}:${key}:true`);
      }
      // No hand-typed wordmark lines left to drift.
      expect(src).not.toMatch(/>\s*(SIMULATOR|TYCOON)\s*</);
      expect(src).not.toContain(`>${WORDMARK.tagline}<`);
      expect(src).not.toContain('ONE WEEK AT A TIME');
    }
  });

  it('the Intro header uses it too', () => {
    const src = read('app/(onboarding)/Intro.tsx');
    expect(src).toContain('{WORDMARK.top}');
    expect(src).toContain('accessibilityLabel={PRODUCT_NAME}');
  });
});
