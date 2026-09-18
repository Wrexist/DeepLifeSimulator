import React from 'react';
import { renderWithProviders } from './helpers/renderWithProviders';
import Work from '@/app/(tabs)/work';

/**
 * The weekly stat toll on a job card used to render as a bare "-3" / "-2" next
 * to a 13px smile/heart glyph, so the only thing separating happiness from
 * health was the icon. PLAYER REPORT (2026-08-31) named the ambiguity; the chip
 * now names the stat the same way the Fitness / Reputation chips do.
 */
describe('render - Work job cards name their weekly stat toll', () => {
  it('labels the happiness and health toll instead of a bare number', () => {
    const { json, unmount } = renderWithProviders(<Work />);

    // The default state is a fresh life, so every entry-tier career shows its
    // profile toll (-3 happiness / -2 health for the uniform default).
    expect(json).toContain('Happiness -3');
    expect(json).toContain('Health -2');
    unmount();
  });
});
