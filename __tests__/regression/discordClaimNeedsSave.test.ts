/**
 * The Discord reward is finalized only once its grant is on disk.
 *
 * `saveGame` reports most failures by RESOLVING `false` - a pristine state,
 * autosave suspended while the player is in the pre-game menus, the slot
 * changing mid-save - and throws only for a few. All three claim sites awaited
 * it bare and finalized in the `try`, so opening Settings from the Main Menu,
 * joining Discord and then loading a life lost the reward for good: the claim
 * was marked complete, and the grant had only ever existed in a state that was
 * thrown away. 2026-10-17 audit.
 */
import fs from 'fs';
import path from 'path';

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

describe.each([
  ['app/(tabs)/home.tsx', 2],
  ['components/SettingsModal.tsx', 1],
])('%s', (file, sites) => {
  const src = read(file);

  it('checks the saveGame result at every grant-then-finalize site', () => {
    // home.tsx has one more finalize: the reconciler's "grant already on disk"
    // branch, which saves nothing and so has nothing to check.
    const checked = (src.match(/\(await saveGame\(\)\) (===|!==) true/g) ?? []).length;
    expect(checked).toBe(sites);
  });

  it('never finalizes straight after a bare saveGame', () => {
    expect(src).not.toMatch(/await saveGame\(\);\s*\n\s*await finalizeDiscordClaim\(\)/);
  });
});
