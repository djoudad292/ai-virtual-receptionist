export * from './tokens'

import { colors, type ThemeMode } from './tokens'

/** Resolve a flat semantic palette for a mode (used by native theme + CSS var generation). */
export function palette(mode: ThemeMode) {
  return colors[mode]
}

/** CSS custom properties for the web app, generated from tokens so there is one source of truth. */
export function cssVariables(mode: ThemeMode): Record<string, string> {
  const p = colors[mode]
  return {
    '--bg': p.bg,
    '--surface': p.surface,
    '--surface-alt': p.surfaceAlt,
    '--surface-hover': p.surfaceHover,
    '--border': p.border,
    '--border-strong': p.borderStrong,
    '--fg': p.fg,
    '--fg-secondary': p.fgSecondary,
    '--fg-muted': p.fgMuted,
    '--primary': p.primary,
    '--primary-strong': p.primaryStrong,
    '--primary-soft': p.primarySoft,
    '--primary-fg': p.primaryFg,
    '--gradient-from': p.gradientFrom,
    '--gradient-to': p.gradientTo,
    '--accent': p.accent,
    '--accent-soft': p.accentSoft,
    '--success': p.success,
    '--success-soft': p.successSoft,
    '--warning': p.warning,
    '--warning-soft': p.warningSoft,
    '--danger': p.danger,
    '--danger-strong': p.dangerStrong,
    '--danger-soft': p.dangerSoft,
    '--violet': p.violet,
    '--violet-soft': p.violetSoft,
    '--orange': p.orange,
    '--orange-soft': p.orangeSoft,
    '--overlay': p.overlay,
  }
}
