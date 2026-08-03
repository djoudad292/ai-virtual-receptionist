import React from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  Modal,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  type TextInputProps,
  type ViewStyle,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Colors } from '@/lib/theme'

export function Screen({ children, scroll = false, style }: { children: React.ReactNode; scroll?: boolean; style?: ViewStyle }) {
  const content = (
    <View style={[styles.screen, style]}>{children}</View>
  )
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {scroll ? (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {content}
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </SafeAreaView>
  )
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={Colors.mutedForeground}
        {...props}
        style={[styles.input, props.style]}
      />
    </View>
  )
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
}: {
  title: string
  onPress?: () => void
  variant?: 'primary' | 'outline' | 'ghost' | 'danger'
  loading?: boolean
  disabled?: boolean
  style?: ViewStyle
}) {
  const isPrimary = variant === 'primary'
  const isOutline = variant === 'outline'
  const isGhost = variant === 'ghost'
  const isDanger = variant === 'danger'
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        isPrimary && { backgroundColor: Colors.primary },
        isOutline && { borderColor: Colors.border, borderWidth: 1 },
        isGhost && { backgroundColor: 'transparent' },
        isDanger && { backgroundColor: Colors.redSoft },
        (disabled || loading) && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={isPrimary ? Colors.primaryForeground : Colors.foreground} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            isPrimary && { color: Colors.primaryForeground },
            isOutline && { color: Colors.foreground },
            isGhost && { color: Colors.primary },
            isDanger && { color: Colors.red },
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  )
}

const badgeVariants: Record<string, { color: string; textColor: string }> = {
  green: { color: Colors.greenSoft, textColor: Colors.green },
  blue: { color: Colors.blueSoft, textColor: Colors.blue },
  orange: { color: Colors.orangeSoft, textColor: Colors.orange },
  purple: { color: Colors.purpleSoft, textColor: Colors.purple },
  red: { color: Colors.redSoft, textColor: Colors.red },
  slate: { color: Colors.muted, textColor: Colors.mutedForeground },
}

export function Badge({
  label,
  text,
  color,
  textColor,
  variant,
}: {
  label?: string
  text?: string
  color?: string
  textColor?: string
  variant?: keyof typeof badgeVariants | string
}) {
  const content = text ?? label ?? ''
  const v = variant ? badgeVariants[variant] : undefined
  const bg = v?.color ?? color ?? Colors.muted
  const fg = v?.textColor ?? textColor ?? Colors.mutedForeground
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{content}</Text>
    </View>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <View style={{ paddingVertical: 32, alignItems: 'center' }}>
      <ActivityIndicator size="large" color={Colors.primary} />
      {label && <Text style={{ color: Colors.mutedForeground, fontSize: 13, marginTop: 10 }}>{label}</Text>}
    </View>
  )
}

export function EmptyState({ icon, title, subtitle }: { icon?: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 }}>
      {icon}
      <Text style={{ color: Colors.foreground, fontSize: 15, fontWeight: '600', marginTop: 12 }}>{title}</Text>
      {subtitle && (
        <Text style={{ color: Colors.mutedForeground, fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 19 }}>
          {subtitle}
        </Text>
      )}
    </View>
  )
}

export function ErrorText({ message }: { message: string }) {
  if (!message) return null
  return (
    <View style={{ backgroundColor: Colors.redSoft, borderRadius: 10, padding: 12, marginBottom: 14 }}>
      <Text style={{ color: Colors.red, fontSize: 13 }}>{message}</Text>
    </View>
  )
}

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
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Text style={{ color: Colors.mutedForeground, fontSize: 20 }}>×</Text>
            </TouchableOpacity>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

export function Row({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.row, style]}>{children}</View>
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  screen: { flex: 1, padding: 16, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: 32 },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 16,
  },
  label: { color: Colors.foreground, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: Colors.muted,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.foreground,
    fontSize: 15,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 15, fontWeight: '600' },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 12, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { color: Colors.foreground, fontSize: 16, fontWeight: '700' },
})
