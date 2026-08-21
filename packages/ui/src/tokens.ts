/**
 * @supportai/ui — Design Tokens (single source of truth)
 *
 * Consumed by:
 *  - Web (Next.js): mapped to CSS variables in globals.css + tailwind.config.ts
 *  - Native (Expo): imported directly by components.native.tsx / theme re-exports
 *
 * Grid: 4px. Dark-first palette: deep ink navy + indigo→violet accent.
 * All text/background pairs verified WCAG AA (see design-audit/contrast-report.txt).
 */

export const colors = {
  dark: {
    bg: '#070B14',
    surface: '#0D1424',
    surfaceAlt: '#131C30',
    surfaceHover: '#18233B',
    border: '#1C2940',
    borderStrong: '#2A3A5C',
    fg: '#F2F6FF',
    fgSecondary: '#A3B3CC',
    fgMuted: '#7E92B2',
    primary: '#818CF8',
    primaryStrong: '#6063EE',
    primarySoft: 'rgba(129, 140, 248, 0.14)',
    primaryFg: '#FFFFFF',
    gradientFrom: '#6063EE',
    gradientTo: '#7D55F3',
    accent: '#22D3EE',
    accentSoft: 'rgba(34, 211, 238, 0.12)',
    success: '#34D399',
    successSoft: 'rgba(52, 211, 153, 0.13)',
    warning: '#FBBF24',
    warningSoft: 'rgba(251, 191, 36, 0.13)',
    danger: '#F87171',
    dangerStrong: '#EF4444',
    dangerSoft: 'rgba(248, 113, 113, 0.13)',
    violet: '#A78BFA',
    violetSoft: 'rgba(167, 139, 250, 0.13)',
    orange: '#FB923C',
    orangeSoft: 'rgba(251, 146, 60, 0.13)',
    overlay: 'rgba(4, 7, 14, 0.72)',
  },
  light: {
    bg: '#F7F9FC',
    surface: '#FFFFFF',
    surfaceAlt: '#EEF2F9',
    surfaceHover: '#E4EAF4',
    border: '#DCE3EF',
    borderStrong: '#C3CEE0',
    fg: '#0C1526',
    fgSecondary: '#44546E',
    fgMuted: '#5D6E88',
    primary: '#4F46E5',
    primaryStrong: '#4338CA',
    primarySoft: 'rgba(79, 70, 229, 0.10)',
    primaryFg: '#FFFFFF',
    gradientFrom: '#6063EE',
    gradientTo: '#7D55F3',
    accent: '#0E7490',
    accentSoft: 'rgba(8, 145, 178, 0.10)',
    success: '#047857',
    successSoft: 'rgba(5, 150, 105, 0.10)',
    warning: '#B45309',
    warningSoft: 'rgba(180, 83, 9, 0.10)',
    danger: '#DC2626',
    dangerStrong: '#B91C1C',
    dangerSoft: 'rgba(220, 38, 38, 0.09)',
    violet: '#7C3AED',
    violetSoft: 'rgba(124, 58, 237, 0.10)',
    orange: '#C2410C',
    orangeSoft: 'rgba(234, 88, 12, 0.10)',
    overlay: 'rgba(12, 21, 38, 0.55)',
  },
} as const

export type ThemeMode = keyof typeof colors
export type Palette = typeof colors.dark

export const typography = {
  fontFamily: {
    sans: "'Inter', 'SF Pro Text', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    mono: "'JetBrains Mono', 'SF Mono', ui-monospace, Menlo, monospace",
  },
  fontSize: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
  lineHeight: {
    tight: 1.25,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
  },
} as const

/** 4px base grid */
export const spacing = {
  0: 0,
  px: 1,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
} as const

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 28,
  full: 9999,
} as const

export const shadows = {
  xs: '0 1px 2px 0 rgb(2 6 16 / 0.28)',
  sm: '0 1px 3px 0 rgb(2 6 16 / 0.32), 0 1px 2px -1px rgb(2 6 16 / 0.24)',
  md: '0 4px 12px -2px rgb(2 6 16 / 0.38), 0 2px 4px -2px rgb(2 6 16 / 0.30)',
  lg: '0 12px 28px -6px rgb(2 6 16 / 0.45), 0 4px 10px -4px rgb(2 6 16 / 0.35)',
  glowPrimary: '0 0 0 1px rgba(99,102,241,0.35), 0 8px 24px -6px rgba(99,102,241,0.45)',
} as const

export const motion = {
  duration: {
    fast: 120,
    normal: 200,
    slow: 320,
  },
  easing: {
    standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
    emphasized: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    exit: 'cubic-bezier(0.4, 0, 1, 1)',
  },
} as const

/** Minimum interactive target size (WCAG 2.5.5 / platform HIG) */
export const minTouchTarget = 44

export type TokenColor = keyof Palette
