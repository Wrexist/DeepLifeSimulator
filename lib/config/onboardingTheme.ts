import { getThemeColors } from '@/lib/config/theme';

export interface OnboardingTheme {
  backdrop: string;
  topGlow: string;
  bottomShade: string;
  glassBorder: string;
  glassHighlight: string;
  title: string;
  subtitle: string;
  eyebrow: string;
  accentText: string;
}

export function getOnboardingTheme(darkMode: boolean): OnboardingTheme {
  const base = getThemeColors(darkMode);

  return {
    backdrop: darkMode ? 'rgba(2, 6, 23, 0.52)' : 'rgba(15, 23, 42, 0.2)',
    topGlow: darkMode ? 'rgba(148, 163, 184, 0.16)' : 'rgba(255, 255, 255, 0.38)',
    bottomShade: darkMode ? 'rgba(2, 6, 23, 0.72)' : 'rgba(15, 23, 42, 0.32)',
    glassBorder: darkMode ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.64)',
    glassHighlight: darkMode ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.72)',
    title: base.text,
    subtitle: darkMode ? 'rgba(226, 232, 240, 0.9)' : 'rgba(15, 23, 42, 0.78)',
    eyebrow: darkMode ? 'rgba(191, 219, 254, 0.96)' : 'rgba(30, 64, 175, 0.86)',
    accentText: darkMode ? 'rgba(186, 230, 253, 1)' : 'rgba(2, 132, 199, 0.92)',
  };
}
