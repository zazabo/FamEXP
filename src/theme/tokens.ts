import type { ResolvedTheme } from '../types';

/** Colour tokens. Components never hard-code colours; they use these (as CSS variables). */
export interface ColorTokens {
  bg: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  primaryText: string;
  success: string;
  warning: string;
  danger: string;
  overlay: string;
}

export const colors: Record<ResolvedTheme, ColorTokens> = {
  light: {
    bg: '#F7F7F5',
    surface: '#FFFFFE',
    surfaceAlt: '#EEEEEA',
    text: '#141413',
    textMuted: '#5E5D59',
    border: '#DDDCD6',
    primary: '#1F6B5C',
    primaryText: '#F7F7F5',
    success: '#2E7D4F',
    warning: '#B26A00',
    danger: '#B3261E',
    overlay: 'rgba(20, 20, 19, 0.45)',
  },
  dark: {
    bg: '#121211',
    surface: '#1C1C1A',
    surfaceAlt: '#262624',
    text: '#F2F1EC',
    textMuted: '#A3A29C',
    border: '#34332F',
    primary: '#5CC2A8',
    primaryText: '#0E1F1B',
    success: '#5FBF84',
    warning: '#E5A443',
    danger: '#F2726A',
    overlay: 'rgba(0, 0, 0, 0.6)',
  },
};

/**
 * Categorical chart palette, fixed order (validated for colour-vision deficiency on both
 * surfaces with the dataviz validator). A slot follows the entity (category / member),
 * never its rank. Light slots 2–5 are below 3:1 on white, so every chart ships with
 * visible labels / a ranked table next to it.
 */
export const chartPalette: Record<ResolvedTheme, string[]> = {
  light: ['#257de0', '#f47230', '#00b894', '#f2a600', '#ee7fac', '#008a17', '#6a4ce2', '#ec4647'],
  dark: ['#338ced', '#e76624', '#00a888', '#d28e05', '#e24d8b', '#0aac23', '#9887ef', '#eb6263'],
};

/** Colour of a chart slot as a CSS variable (works in both themes). */
export const chartColor = (slot: number): string => `var(--c-chart-${(slot % 8) + 1})`;

export const typography = {
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, 'Noto Sans', 'Helvetica Neue', Arial, sans-serif",
  size: { xs: '12px', sm: '14px', md: '16px', lg: '18px', xl: '22px', xxl: '30px', display: '40px' },
  weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
  lineHeight: { tight: 1.2, normal: 1.45 },
} as const;

export const spacing = { xs: '4px', sm: '8px', md: '12px', lg: '16px', xl: '24px', xxl: '32px' } as const;

export const radius = { sm: '8px', md: '12px', lg: '18px', pill: '999px' } as const;

/** Minimum comfortable touch target. */
export const touchTarget = '48px';

/** Write the tokens of a theme as CSS custom properties on <html>. */
export function applyThemeVariables(theme: ResolvedTheme): void {
  const root = document.documentElement;
  const c = colors[theme];
  for (const [name, value] of Object.entries(c)) {
    root.style.setProperty(`--c-${name.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`, value);
  }
  for (const [k, v] of Object.entries(typography.size)) root.style.setProperty(`--fs-${k}`, v);
  for (const [k, v] of Object.entries(spacing)) root.style.setProperty(`--sp-${k}`, v);
  for (const [k, v] of Object.entries(radius)) root.style.setProperty(`--r-${k}`, v);
  chartPalette[theme].forEach((hex, i) => root.style.setProperty(`--c-chart-${i + 1}`, hex));
  root.style.setProperty('--font', typography.fontFamily);
  root.style.setProperty('--touch', touchTarget);
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', c.bg);
}
