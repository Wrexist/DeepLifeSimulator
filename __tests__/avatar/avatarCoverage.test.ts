/**
 * Every face in the app comes from one system.
 *
 * The revamp replaced a 77-portrait asset pool with a parameterised avatar.
 * The failure mode this guards is not a crash — it is a screen quietly still
 * rendering the old art, so the game shows two different illustration styles
 * depending on where you look. That reads as broken, and it is exactly what a
 * partial migration produces.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');

/** Files tracked by git, excluding this test and the docs that discuss history. */
function grepRepo(pattern: string): string[] {
  let out = '';
  try {
    out = execFileSync('git', ['grep', '-l', '-E', pattern, '--', '*.ts', '*.tsx'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
  } catch {
    // git grep exits 1 when there are no matches, which is the passing case.
    return [];
  }
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((f) => !f.includes('__tests__/avatar/'));
}

describe('the old portrait system is fully gone', () => {
  it('has no facePool or characterImages module left', () => {
    expect(existsSync(resolve(ROOT, 'utils/facePool.ts'))).toBe(false);
    expect(existsSync(resolve(ROOT, 'utils/characterImages.ts'))).toBe(false);
  });

  it('ships none of the 3.5 MB of rendered portraits', () => {
    // These carried the artefacts players objected to — a floating heart, a
    // sparkle field and an orange glow baked into every frame.
    expect(existsSync(resolve(ROOT, 'assets/images/Face'))).toBe(false);
  });

  it('has no source file importing either module', () => {
    expect(grepRepo("from '@/utils/(facePool|characterImages)'")).toEqual([]);
    expect(grepRepo("from '\\./(facePool|characterImages)'")).toEqual([]);
  });

  it('has no caller of the old portrait helpers', () => {
    expect(
      grepRepo('\\b(getPortrait|getParentPortrait|getAvatarPortrait|legacyFace|listStarterAvatars|getCharacterImage|getRelationshipImage|getParentImage|getDatingProfileImage)\\s*\\(')
    ).toEqual([]);
  });

  it('references no asset under the deleted Face directory', () => {
    expect(grepRepo("assets/images/Face")).toEqual([]);
  });
});

describe('faces render through the avatar components', () => {
  it('routes every screen through CharacterAvatar or VectorAvatar', () => {
    // Not an exhaustive list of screens — a spot check that the surfaces which
    // used to read the pool now read the new system.
    const expected = [
      'components/IdentityCard.tsx',
      'components/FamilyTab.tsx',
      'components/FamilyTreeModal.tsx',
      'components/DeathPopup.tsx',
      'components/PrestigeModal.tsx',
      'components/mobile/ContactsApp.tsx',
      'components/mobile/Spark/SparkApp.tsx',
      'components/mobile/Spark/components/ProfileCard.tsx',
      'components/mobile/Spark/components/MatchBanner.tsx',
      'components/mobile/Spark/screens/MatchesScreen.tsx',
      'components/mobile/Spark/screens/LikesScreen.tsx',
      'components/mobile/Spark/screens/ChatScreen.tsx',
      'components/mobile/Spark/screens/PartnerProfileScreen.tsx',
      'components/mobile/Hustle/screens/CompanyDetailScreen.tsx',
      'app/(onboarding)/Customize.tsx',
    ];
    const using = new Set(grepRepo('avatar/(CharacterAvatar|VectorAvatar)'));
    for (const file of expected) {
      expect(using.has(file)).toBe(true);
    }
  });

  it('imports the art from its own package, never the 30-style barrel', () => {
    // `@dicebear/collection` re-exports every style (~6 MB on disk). Only the
    // dev-only evaluation scripts may touch it, and those are .mjs.
    expect(grepRepo("from '@dicebear/collection'")).toEqual([]);
  });

  it('keeps lib/ free of the art package', () => {
    // `lib/avatar` must stay pure data and pure functions so the catalogs and
    // option building are testable without an ESM-only dependency.
    const importers = grepRepo("from '@dicebear/");
    for (const file of importers) {
      expect(file.startsWith('lib/')).toBe(false);
    }
  });
});

describe('the designed face survives onboarding', () => {
  it('hands the encoded config to the state builder', () => {
    // The one wiring step with no type error to catch it: every field
    // `buildNewGameState` reads is optional, so omitting `avatar` compiled
    // cleanly and shipped a game where the character who walked out of the
    // creator was a DIFFERENT PERSON from the one on the screen — the derived
    // fallback in `resolveAvatar`, seeded from the name. Nothing crashes and
    // nothing logs; the whole creator is simply thrown away at the last step.
    // The ceremony moved out of the Perks screen into the shared
    // `useStartLife` hook (2026-09-01 UI overhaul) so MainMenu's quick-start
    // door could stop routing through that screen to reach it. One caller
    // still, one place to keep wired.
    const source = readFileSync(resolve(ROOT, 'src/features/onboarding/useStartLife.ts'), 'utf8');
    const call = /buildNewGameState\(\{([\s\S]*?)\n {8}\}\)/.exec(source);
    expect(call).toBeTruthy();
    expect(call![1]).toMatch(/\bavatar:\s*state\.avatar\b/);
  });

  it('has no other route building a life, which would need the same wiring', () => {
    // If this list grows, the new caller needs `avatar` passed through too.
    const callers = grepRepo('buildNewGameState\\(\\{').filter((f) => !f.includes('__tests__/'));
    expect(callers).toEqual(['src/features/onboarding/useStartLife.ts']);
  });
});

describe("a child's face is inherited on every screen that shows one", () => {
  it('passes `parents` wherever a child avatar is rendered', () => {
    // `CharacterAvatar` falls back to a face seeded from the id when `parents`
    // is absent, so a screen that forgets it shows a DIFFERENT PERSON than the
    // one the Family tab shows for the same child. That is the "my character
    // turned into someone else" defect the whole revamp exists to remove,
    // reappearing across screens instead of across ages — and Contacts shipped
    // it: a child was green-haired there and blonde on the Family tab, in the
    // same save, in the same session.
    const screens = [
      'components/FamilyTab.tsx',
      'components/mobile/ContactsApp.tsx',
      'components/PrestigeModal.tsx',
      'components/DeathPopup.tsx',
    ];
    for (const file of screens) {
      const source = readFileSync(resolve(ROOT, file), 'utf8');
      expect(`${file} resolves parents: ${/parents=\{/.test(source)}`).toBe(`${file} resolves parents: true`);
      expect(`${file} imports childParentSources: ${source.includes('childParentSources')}`)
        .toBe(`${file} imports childParentSources: true`);
    }
  });
});
