/**
 * @supportai/ui — Native component library (React Native / Expo, token-driven).
 * Import from '@supportai/ui/native'.
 */
import React, { useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  type TextInputProps,
  type ViewStyle,
  type StyleProp,
  type TextStyle,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, radii, spacing, typography, minTouchTarget, type Palette } from './tokens'

const t = colors.dark

/* ---------------------------------- Screen --------------------------------- */

export function Screen({
  children,
  scroll = false,
  style,
}: {
  children: React.ReactNode
  scroll?: boolean
  style?: ViewStyle
}) {
  const content = <View style={[styles.screen, style]}>{children}</View>
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {scroll ? (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {content}
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </SafeAreaView>
  )
}

/* ----------------------------------- Card ---------------------------------- */

export function Card({
  children,
  style,
  interactive = false,
}: {
  children: React.ReactNode
  style?: ViewStyle
  interactive?: boolean
}) {
  return (
    <View
      style={[
        styles.card,
        interactive && { borderColor: t.borderStrong, backgroundColor: t.surfaceAlt },
        style,
      ]}
    >
      {children}
    </View>
  )
}

export function CardTitle({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.cardTitle, style]}>{children}</Text>
}

/* -------------------------------- Form field ------------------------------- */

export interface InputProps extends TextInputProps {
  label?: string
  error?: string
}

export function Input({ label, error, style, ...rest }: InputProps) {
  return (
    <View style={styles.fieldWrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={t.fgMuted}
        accessibilityLabel={label}
        {...rest}
        style={[styles.input, error && styles.inputError, style]}
      />
      {error ? (
        <Text accessibilityRole="alert" style={styles.errorText}>
          {error}
        </Text>
      ) : null}
    </View>
  )
}

/** Back-compat alias for screens using <Field label=... /> */
export const Field = Input

/* ---------------------------------- Button --------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon,
  style,
}: {
  title: string
  onPress?: () => void
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
  fullWidth?: boolean
  icon?: React.ReactNode
  style?: ViewStyle
}) {
  const isDisabled = disabled || loading
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        size === 'sm' && styles.buttonSm,
        size === 'lg' && styles.buttonLg,
        variantStyles[variant],
        fullWidth && { alignSelf: 'stretch' },
        pressed && !isDisabled && styles.buttonPressed,
        isDisabled && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'primary' ? '#FFFFFF' : t.primary} />
      ) : (
        <View style={styles.buttonInner}>
          {icon}
          <Text style={[styles.buttonText, variantTextStyles[variant], size === 'sm' && { fontSize: 13 }]}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  )
}

const variantStyles: Record<ButtonVariant, ViewStyle> = {
  primary: { backgroundColor: t.primaryStrong },
  secondary: { backgroundColor: t.primarySoft, borderWidth: 1, borderColor: 'rgba(129,140,248,0.30)' },
  outline: { borderWidth: 1, borderColor: t.borderStrong, backgroundColor: 'transparent' },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: t.dangerSoft, borderWidth: 1, borderColor: 'rgba(248,113,113,0.30)' },
}

const variantTextStyles: Record<ButtonVariant, TextStyle> = {
  primary: { color: '#FFFFFF' },
  secondary: { color: t.primary },
  outline: { color: t.fg },
  ghost: { color: t.primary },
  danger: { color: t.danger },
}

/* ---------------------------------- Badge ---------------------------------- */

export type BadgeTone = 'primary' | 'success' | 'warning' | 'danger' | 'violet' | 'accent' | 'neutral'

const badgeTones: Record<BadgeTone, { bg: string; fg: string }> = {
  primary: { bg: t.primarySoft, fg: t.primary },
  success: { bg: t.successSoft, fg: t.success },
  warning: { bg: t.warningSoft, fg: t.warning },
  danger: { bg: t.dangerSoft, fg: t.danger },
  violet: { bg: t.violetSoft, fg: t.violet },
  accent: { bg: t.accentSoft, fg: t.accent },
  neutral: { bg: t.surfaceHover, fg: t.fgSecondary },
}

/** Legacy tone names kept for drop-in compatibility with old screens. */
const legacyTones: Record<string, BadgeTone> = {
  green: 'success',
  blue: 'primary',
  orange: 'warning',
  purple: 'violet',
  red: 'danger',
  slate: 'neutral',
}

export function Badge({
  label,
  text,
  tone,
  variant,
}: {
  label?: string
  text?: string
  tone?: BadgeTone
  variant?: string
}) {
  const content = text ?? label ?? ''
  const resolved = badgeTones[(tone ?? (variant ? legacyTones[variant] ?? 'neutral' : 'neutral')) as BadgeTone]
  return (
    <View style={[styles.badge, { backgroundColor: resolved.bg }]}>
      <Text style={[styles.badgeText, { color: resolved.fg }]}>{content}</Text>
    </View>
  )
}

/* --------------------------------- Feedback -------------------------------- */

export function Spinner({ label }: { label?: string }) {
  return (
    <View style={styles.spinnerWrap} accessibilityRole="progressbar" accessibilityLabel={label ?? 'Loading'}>
      <ActivityIndicator size="large" color={t.primary} />
      {label ? <Text style={styles.spinnerLabel}>{label}</Text> : null}
    </View>
  )
}

export function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon?: React.ReactNode
  title: string
  subtitle?: string
}) {
  return (
    <View style={styles.emptyWrap}>
      {icon ? <View style={styles.emptyIcon}>{icon}</View> : null}
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySubtitle}>{subtitle}</Text> : null}
    </View>
  )
}

export function ErrorBanner({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <View accessibilityRole="alert" style={styles.errorBanner}>
      <Text style={styles.errorBannerText}>{message}</Text>
    </View>
  )
}

/** Back-compat alias */
export const ErrorText = ErrorBanner

/* ---------------------------------- Modal ---------------------------------- */

export function ModalView({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  useEffect(() => {
    if (!visible) return
    const sub = () => {}
    void sub
  }, [visible])

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Close dialog"
          onPress={onClose}
        />
        <View style={styles.modalCard} accessibilityViewIsModal>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              hitSlop={12}
              style={styles.modalClose}
            >
              <Text style={styles.modalCloseText}>✕</Text>
            </Pressable>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  )
}

/* --------------------------------- Utilities ------------------------------- */

export function Row({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.row, style]}>{children}</View>
}

/** Section heading used across list screens. */
export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {action}
    </View>
  )
}

/** Brand mark used in headers/auth screens. */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <View
      accessible
      accessibilityLabel="SupportAI"
      style={{
        height: size,
        width: size,
        borderRadius: size * 0.3,
        backgroundColor: t.primaryStrong,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#FFFFFF', fontSize: size * 0.5, fontWeight: '800' }}>S</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.bg },
  flex: { flex: 1 },
  screen: { flex: 1, padding: spacing[4], backgroundColor: t.bg },
  scrollContent: { paddingBottom: spacing[8] },
  card: {
    backgroundColor: t.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: t.border,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  cardTitle: {
    color: t.fg,
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  fieldWrap: { marginBottom: spacing[4] },
  label: {
    color: t.fg,
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    marginBottom: spacing[1.5]},
  },
  input: {
    backgroundColor: t.surfaceAlt,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing[3.5]},
    minHeight: minTouchTarget,
    paddingVertical: 11,
    color: t.fg,
    fontSize: typography.fontSize.base,
  },
  inputError: { borderColor: t.danger },
  errorText: { color: t.danger, fontSize: typography.fontSize.sm, marginTop: spacing[1.5]} },
  button: {
    minHeight: minTouchTarget,
    borderRadius: radii.md,
    paddingHorizontal: spacing[5],
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  buttonSm: { minHeight: 36, paddingHorizontal: spacing[3], borderRadius: radii.sm },
  buttonLg: { minHeight: 48, paddingHorizontal: spacing[6], borderRadius: radii.md },
  buttonPressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  buttonText: { fontSize: typography.fontSize.base, fontWeight: '600', letterSpacing: 0.1 },
  badge: {
    paddingHorizontal: spacing[2.5]},
    paddingVertical: 4,
    borderRadius: radii.full,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: typography.fontSize.xs + 1, fontWeight: '600' },
  spinnerWrap: { paddingVertical: spacing[8], alignItems: 'center' },
  spinnerLabel: { color: t.fgMuted, fontSize: typography.fontSize.sm, marginTop: spacing[2.5]} },
  emptyWrap: { alignItems: 'center', paddingVertical: spacing[10], paddingHorizontal: spacing[6] },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    backgroundColor: t.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  emptyTitle: { color: t.fg, fontSize: typography.fontSize.md, fontWeight: '600' },
  emptySubtitle: {
    color: t.fgMuted,
    fontSize: typography.fontSize.sm,
    marginTop: spacing[1.5]},
    textAlign: 'center',
    lineHeight: 20,
  },
  errorBanner: {
    backgroundColor: t.dangerSoft,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.30)',
    borderRadius: radii.md,
    padding: spacing[3],
    marginBottom: spacing[4],
  },
  errorBannerText: { color: t.danger, fontSize: typography.fontSize.sm },
  row: { flexDirection: 'row', alignItems: 'center' },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing[2],
    marginBottom: spacing[3],
  },
  sectionTitle: {
    color: t.fgSecondary,
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: t.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[5],
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '88%',
    backgroundColor: t.surface,
    borderRadius: radii['2xl'],
    borderWidth: 1,
    borderColor: t.borderStrong,
    padding: spacing[5],
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  modalTitle: { color: t.fg, fontSize: typography.fontSize.lg, fontWeight: '700', flex: 1 },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.surfaceHover,
  },
  modalCloseText: { color: t.fgSecondary, fontSize: 15 },
})

export { colors as themeColors }
export type { Palette }
