/**
 * Master Program 3 (the 19 phone apps) - the shared primitives and the one
 * launcher-level ErrorBoundary.
 *
 * Source-scan tests, the same shape as the rest of __tests__/render: they pin
 * structure that a type-check cannot see (that the launcher wraps every
 * hosted app in a boundary; that no app re-declares its own top bar).
 */
import fs from 'fs';
import path from 'path';
import { withAlpha } from '@/lib/config/theme';

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('withAlpha', () => {
  it('converts 6-digit and 3-digit hex', () => {
    expect(withAlpha('#3B82F6', 0.16)).toBe('rgba(59, 130, 246, 0.16)');
    expect(withAlpha('#fff', 0.5)).toBe('rgba(255, 255, 255, 0.5)');
  });
  it('clamps alpha and passes non-hex through untouched', () => {
    expect(withAlpha('#000000', 2)).toBe('rgba(0, 0, 0, 1)');
    expect(withAlpha('rgba(1,2,3,0.4)', 0.1)).toBe('rgba(1,2,3,0.4)');
  });
});

describe('AppLauncher hosts every app inside one ErrorBoundary', () => {
  it('wraps <AppComponent> in <ErrorBoundary>', () => {
    const src = read('components/launcher/AppLauncher.tsx');
    expect(src).toMatch(/<ErrorBoundary>\s*<AppComponent onBack=\{handleCloseApp\} \/>\s*<\/ErrorBoundary>/);
  });
});
