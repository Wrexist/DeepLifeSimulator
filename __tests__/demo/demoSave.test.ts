/**
 * Guard for the App Preview demo saves.
 *
 * The capture rig boots the app on a pre-built save (`scripts/demo/demo-save.json`).
 * If that file drifts from the app — a `STATE_VERSION` bump, a renamed career
 * or property id, a field that stops validating — the failure mode is a blank
 * or half-loaded screen discovered partway through a capture run, or worse,
 * baked into footage that then goes to Apple.
 *
 * These assertions are the cheap version of finding out: they fail in CI the
 * moment the committed bundle stops matching what the app would accept.
 * Fix by re-running `npm run demo:save`.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { STATE_VERSION } from '@/contexts/game/initialState';
import { validateGameState } from '@/utils/saveValidation';

const BUNDLE_PATH = resolve(__dirname, '../../scripts/demo/demo-save.json');

interface Bundle {
  entries: Record<string, string>;
  chapters: { slot: number; key: string; title: string; netWorth: number; age: number }[];
  stateVersion: number;
}

describe('App Preview demo saves', () => {
  const bundleExists = existsSync(BUNDLE_PATH);
  const bundle: Bundle | null = bundleExists
    ? (JSON.parse(readFileSync(BUNDLE_PATH, 'utf8')) as Bundle)
    : null;

  it('the committed bundle exists', () => {
    expect(bundleExists).toBe(true);
  });

  it('was built against the current STATE_VERSION', () => {
    // A stale bundle still *loads* — the migration layer would quietly upgrade
    // it — which is exactly why this needs asserting rather than eyeballing.
    expect(bundle?.stateVersion).toBe(STATE_VERSION);
  });

  it('carries the three capture chapters', () => {
    expect(bundle?.chapters.map((c) => c.key)).toEqual(['week-one', 'the-climb', 'the-empire']);
  });

  it('tells a rising story — each chapter is older and richer than the last', () => {
    const chapters = bundle?.chapters ?? [];
    for (let i = 1; i < chapters.length; i++) {
      expect(chapters[i].age).toBeGreaterThan(chapters[i - 1].age);
      expect(chapters[i].netWorth).toBeGreaterThan(chapters[i - 1].netWorth);
    }
  });

  it('every slot decodes to a state the app accepts', () => {
    for (const chapter of bundle?.chapters ?? []) {
      const raw = bundle?.entries[`save_slot_${chapter.slot}_A`];
      if (!raw) throw new Error(`slot ${chapter.slot} (${chapter.key}) envelope missing from bundle`);

      const envelope = JSON.parse(raw as string) as { v: number; data: string; checksum: string };
      expect(envelope.v).toBe(2);
      expect(typeof envelope.checksum).toBe('string');

      const state = JSON.parse(envelope.data);
      expect(state.version).toBe(STATE_VERSION);

      const result = validateGameState(state, false);
      expect(result.errors).toEqual([]);
      expect(result.valid).toBe(true);
    }
  });

  it('opens into the hero chapter', () => {
    const hero = bundle?.chapters[bundle.chapters.length - 1];
    expect(bundle?.entries.currentSlot).toBe(String(hero?.slot));
    expect(bundle?.entries[`save_slot_${hero?.slot}_active`]).toBe('A');
  });

  it('the hero save is photogenic — the numbers the shot list promises are really there', () => {
    const hero = bundle?.chapters[bundle.chapters.length - 1];
    const raw = bundle?.entries[`save_slot_${hero?.slot}_A`] as string;
    const state = JSON.parse((JSON.parse(raw) as { data: string }).data);

    // The Apps tab — Stocks, Bank, Real Estate, i.e. most of the shot list —
    // is hidden from the tab bar unless a device is owned.
    const ownsDevice = state.items.some(
      (i: { id: string; owned: boolean }) => (i.id === 'smartphone' || i.id === 'computer') && i.owned
    );
    expect(ownsDevice).toBe(true);

    // The Identity card renders careers[currentJob].levels[level].name. Level 0
    // captions a 40-year-old founder "Business Intern".
    const career = state.careers.find((c: { id: string }) => c.id === state.currentJob);
    expect(career).toBeTruthy();
    expect(career.level).toBeGreaterThan(0);
    expect(career.accepted).toBe(true);

    // Without a scenario the card renders the literal word "Unknown".
    expect(typeof state.scenarioId).toBe('string');
    expect(state.scenarioId.length).toBeGreaterThan(0);

    // A market with no previous close reports 0 advancing / 0 declining and
    // draws flat sparklines — a dead board under a "living market" caption.
    expect(Object.keys(state.stocks?.lastWeekPrices ?? {}).length).toBeGreaterThan(10);
    expect(state.stocks?.holdings?.length ?? 0).toBeGreaterThan(0);

    expect(state.companies.length).toBeGreaterThan(0);
    expect(state.realEstate.length).toBeGreaterThan(0);
    expect(state.family?.children?.length ?? 0).toBeGreaterThan(0);
  });
});
