import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { apiFetch, paginate, formatDate } from '@/lib/api'
import { Screen, Card, Spinner, EmptyState, Badge } from '@/components/ui'
import { Colors } from '@/lib/theme'
import { Ionicons } from '@expo/vector-icons'

interface Conversation {
  id: string
  title: string
  status: string
  department?: string | null
  handledBy?: string | null
  lastMessage?: string | null
  createdAt: string
}

interface Summary {
  total: number
  active: number
  leads: number
  appointments: number
}

export default function OverviewScreen() {
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [docCount, setDocCount] = useState(0)
  const [summary, setSummary] = useState<Summary>({ total: 0, active: 0, leads: 0, appointments: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    Promise.all([
      apiFetch('/conversations'),
      apiFetch('/analytics/summary'),
      apiFetch('/knowledge-base'),
    ])
      .then(([convData, sumData, kbData]) => {
        if (!mounted) return
        setConversations(paginate<Conversation>(convData).items)
        setSummary(sumData as Summary)
        setDocCount((Array.isArray(kbData) ? kbData : kbData.documents || []).length)
      })
      .catch(() => {})
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }, [])

  const stats = [
    { label: 'Total Conversations', value: summary.total, color: Colors.blue },
    { label: 'Active Chats', value: summary.active, color: Colors.green },
    { label: 'Leads Captured', value: summary.leads, color: Colors.purple },
    { label: 'Appointments', value: summary.appointments, color: Colors.orange },
  ]

  const setupSteps = [
    { label: 'Add knowledge base documents', done: docCount > 0, hint: 'Give the AI the facts it needs', route: '/(dashboard)/knowledge' as const },
    { label: 'Embed the chat widget on your site', done: summary.total > 0, hint: 'Copy the code from Settings', route: '/(dashboard)/settings' as const },
    { label: 'Chat with the AI to test it', done: summary.total > 0, hint: 'Open a conversation to see how it responds', route: '/(dashboard)/(tabs)/inbox' as const },
    { label: 'Review captured leads', done: summary.leads > 0, hint: 'Contacts the AI captured from visitors', route: '/(dashboard)/(tabs)/leads' as const },
  ]
  const completedSteps = setupSteps.filter((s) => s.done).length
  const allDone = completedSteps === setupSteps.length

  const quickActions: { label: string; desc: string; icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; route: string }[] = [
    { label: 'Open Chat', desc: 'View and reply to conversations', icon: 'chatbubbles-outline', color: Colors.primary, bg: Colors.blueSoft, route: '/(dashboard)/(tabs)/inbox' },
    { label: 'View Leads', desc: 'Contacts captured by the AI', icon: 'people-outline', color: Colors.purple, bg: Colors.purpleSoft, route: '/(dashboard)/(tabs)/leads' },
    { label: 'Appointments', desc: 'Meetings booked by the AI', icon: 'calendar-outline', color: Colors.orange, bg: Colors.orangeSoft, route: '/(dashboard)/(tabs)/appointments' },
    { label: 'Knowledge Base', desc: 'Manage your AI training docs', icon: 'document-text-outline', color: Colors.green, bg: Colors.greenSoft, route: '/(dashboard)/knowledge' },
    { label: 'Analytics', desc: 'Track performance metrics', icon: 'stats-chart-outline', color: Colors.blue, bg: Colors.blueSoft, route: '/(dashboard)/analytics' },
    { label: 'Read the Guide', desc: 'How to use every feature', icon: 'compass-outline', color: Colors.slate, bg: Colors.slateSoft, route: '/(dashboard)/guide' },
  ]

  const recent = conversations.slice(0, 5)
  const statusVariant: Record<string, 'green' | 'blue' | 'slate'> = {
    active: 'green',
    resolved: 'blue',
  }

  const openConversation = (id: string) => {
    router.push({ pathname: '/(dashboard)/(tabs)/inbox', params: { open: id } })
  }

  return (
    <Screen scroll>
      <Text style={{ color: Colors.foreground, fontSize: 22, fontWeight: '700', marginBottom: 4 }}>Overview</Text>
      <Text style={{ color: Colors.mutedForeground, fontSize: 13, marginBottom: 16 }}>
        How your AI receptionist is doing
      </Text>

      {loading ? (
        <Spinner label="Loading dashboard…" />
      ) : (
        <>
          {!allDone && (
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: Colors.foreground, fontSize: 15, fontWeight: '700' }}>Getting Started</Text>
                  <Text style={{ color: Colors.mutedForeground, fontSize: 12, marginTop: 2 }}>
                    {completedSteps} of {setupSteps.length} steps done — follow these to get your receptionist running
                  </Text>
                </View>
                <TouchableOpacity onPress={() => router.push('/(dashboard)/guide')} style={styles.guideBtn} hitSlop={8}>
                  <Text style={{ color: Colors.primary, fontSize: 12, fontWeight: '600' }}>Full guide</Text>
                </TouchableOpacity>
              </View>
              {setupSteps.map((step) => (
                <TouchableOpacity key={step.label} onPress={() => router.push(step.route)} style={styles.stepRow}>
                  <Ionicons
                    name={step.done ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                    color={step.done ? Colors.green : Colors.slate}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: step.done ? Colors.mutedForeground : Colors.foreground,
                        fontSize: 13,
                        fontWeight: step.done ? '400' : '600',
                        textDecorationLine: step.done ? 'line-through' : 'none',
                      }}
                      numberOfLines={1}
                    >
                      {step.label}
                    </Text>
                    <Text style={{ color: Colors.mutedForeground, fontSize: 11, marginTop: 1 }} numberOfLines={1}>
                      {step.hint}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={15} color={Colors.mutedForeground} />
                </TouchableOpacity>
              ))}
            </Card>
          )}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
            {stats.map((stat) => (
              <View key={stat.label} style={[styles.statCard, { width: '48%', flexGrow: 1 }]}>
                <Text style={{ color: Colors.mutedForeground, fontSize: 12 }}>{stat.label}</Text>
                <Text style={{ color: stat.color, fontSize: 28, fontWeight: '800', marginTop: 4 }}>{stat.value}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.label}
                activeOpacity={0.8}
                onPress={() => router.push(action.route as any)}
                style={[styles.quickAction, { width: '48%', flexGrow: 1 }]}
              >
                <View style={[styles.iconBox, { backgroundColor: action.bg }]}>
                  <Ionicons name={action.icon} size={18} color={action.color} />
                </View>
                <Text style={{ color: Colors.foreground, fontSize: 13, fontWeight: '600' }}>{action.label}</Text>
                <Text style={{ color: Colors.mutedForeground, fontSize: 11, marginTop: 2 }}>{action.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Recent Conversations</Text>
          {recent.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Ionicons name="chatbubbles-outline" size={40} color={Colors.slate} />}
                title="No conversations yet"
                subtitle="When a visitor uses the widget on your site, their conversation appears here."
              />
            </Card>
          ) : (
            recent.map((conv) => (
              <TouchableOpacity key={conv.id} activeOpacity={0.8} onPress={() => openConversation(conv.id)} style={styles.convRow}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: Colors.foreground, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
                    {conv.title || 'Untitled'}
                  </Text>
                  <Text style={{ color: Colors.mutedForeground, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                    {formatDate(conv.createdAt)}
                    {conv.department ? ` · ${conv.department}` : ''}
                    {conv.lastMessage ? ` · ${conv.lastMessage.slice(0, 60)}` : ''}
                  </Text>
                </View>
                <Badge text={conv.status} variant={statusVariant[conv.status] || 'slate'} />
              </TouchableOpacity>
            ))
          )}
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  statCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 16,
  },
  sectionTitle: { color: Colors.mutedForeground, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 20, marginBottom: 10 },
  guideBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
  },
  quickAction: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 14,
  },
  convRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  iconBox: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
})
