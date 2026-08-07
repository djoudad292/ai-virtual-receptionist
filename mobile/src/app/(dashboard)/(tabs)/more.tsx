import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '@/lib/auth-context'
import { Screen } from '@/components/ui'
import { Colors } from '@/lib/theme'
import { Ionicons } from '@expo/vector-icons'

const sections = [
  { key: 'analytics', label: 'Analytics', desc: 'Track performance metrics', icon: 'stats-chart-outline', color: Colors.blue },
  { key: 'ask', label: 'Ask Documents', desc: 'Ask questions with cited sources', icon: 'chatbubble-ellipses-outline', color: Colors.purple },
  { key: 'summary', label: 'Summaries', desc: 'Generate document summaries', icon: 'sparkles-outline', color: Colors.orange },
  { key: 'knowledge', label: 'Knowledge Base', desc: 'Manage your AI training docs', icon: 'document-text-outline', color: Colors.green },
  { key: 'team', label: 'Team', desc: 'Invite and manage agents', icon: 'shield-outline', color: Colors.purple },
  { key: 'guide', label: 'Guide', desc: 'How to use every feature', icon: 'compass-outline', color: Colors.slate },
  { key: 'settings', label: 'Settings', desc: 'Company, departments and widget', icon: 'settings-outline', color: Colors.orange },
] as const

export default function MoreScreen() {
  const router = useRouter()
  const { user, logout } = useAuth()

  const handleLogout = async () => {
    await logout()
    router.replace('/(auth)/login')
  }

  return (
    <Screen scroll>
      <View style={{ paddingTop: 12 }}>
        <View style={[styles.userCard, { flexDirection: 'row', alignItems: 'center', gap: 14 }]}>
          <View style={[styles.avatar, { backgroundColor: Colors.primarySoft }]}>
            <Text style={{ color: Colors.primary, fontSize: 18, fontWeight: '700' }}>
              {(user?.name || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: Colors.foreground, fontSize: 16, fontWeight: '700' }} numberOfLines={1}>
              {user?.name || 'User'}
            </Text>
            <Text style={{ color: Colors.mutedForeground, fontSize: 13 }} numberOfLines={1}>
              {user?.email || ''}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Menu</Text>

        {sections.map((section) => {
          return (
            <TouchableOpacity
              key={section.key}
              activeOpacity={0.8}
              onPress={() => router.push(`/(dashboard)/${section.key}` as any)}
              style={styles.row}
            >
              <View style={[styles.iconBox, { backgroundColor: `${section.color}22` }]}>
                <Ionicons name={section.icon as any} size={20} color={section.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{section.label}</Text>
                <Text style={styles.rowDesc}>{section.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.mutedForeground} />
            </TouchableOpacity>
          )
        })}

        <TouchableOpacity activeOpacity={0.8} onPress={handleLogout} style={[styles.row, { borderColor: Colors.redSoft }]}>
          <View style={[styles.iconBox, { backgroundColor: Colors.redSoft }]}>
            <Ionicons name="log-out-outline" size={20} color={Colors.red} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: Colors.red }]}>Sign Out</Text>
            <Text style={styles.rowDesc}>End your session</Text>
          </View>
          <Ionicons name="log-out-outline" size={16} color={Colors.red} />
        </TouchableOpacity>

        <Text style={{ textAlign: 'center', color: Colors.slate, fontSize: 11, marginTop: 24 }}>
          AI Virtual Receptionist by djaouad frih
        </Text>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  userCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { color: Colors.mutedForeground, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 20, marginBottom: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { color: Colors.foreground, fontSize: 15, fontWeight: '600' },
  rowDesc: { color: Colors.mutedForeground, fontSize: 12, marginTop: 2 },
})
