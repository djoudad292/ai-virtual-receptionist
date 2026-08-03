import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { apiFetch, paginate, formatDate, timeAgo } from '@/lib/api'
import { Screen, Card, Spinner, EmptyState } from '@/components/ui'
import { Colors } from '@/lib/theme'
import { Ionicons } from '@expo/vector-icons'

interface Conversation {
  id: string
  title: string
  status: string
  department?: string | null
  createdAt: string
  lastMessage?: string | null
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

  const recent = conversations.slice(0, 5)

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
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {stats.map((stat) => (
              <View key={stat.label} style={[styles.statCard, { width: '48%', flexGrow: 1 }]}>
                <Text style={{ color: Colors.mutedForeground, fontSize: 12 }}>{stat.label}</Text>
                <Text style={{ color: stat.color, fontSize: 28, fontWeight: '800', marginTop: 4 }}>{stat.value}</Text>
              </View>
            ))}
          </View>

          <View style={{ marginTop: 20 }}>
            {docCount === 0 && (
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={[styles.iconBox, { backgroundColor: Colors.blueSoft }]}>
                    <Ionicons name="book-outline" size={20} color={Colors.blue} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: Colors.foreground, fontSize: 14, fontWeight: '600' }}>
                      Add your knowledge base
                    </Text>
                    <Text style={{ color: Colors.mutedForeground, fontSize: 12, marginTop: 2 }}>
                      Give the AI the facts it needs to answer visitors
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => router.push('/(dashboard)/knowledge')}>
                    <Text style={{ color: Colors.primary, fontSize: 13, fontWeight: '600' }}>Open</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            )}
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
              <TouchableOpacity key={conv.id} activeOpacity={0.8} onPress={() => router.push('/(dashboard)/(tabs)/inbox')} style={styles.convRow}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: Colors.foreground, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
                    {conv.title || 'Untitled'}
                  </Text>
                  <Text style={{ color: Colors.mutedForeground, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                    {conv.lastMessage || timeAgo(conv.createdAt)} · {formatDate(conv.createdAt)}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: conv.status === 'active' ? Colors.greenSoft : Colors.muted }]}>
                  <Text style={{ color: conv.status === 'active' ? Colors.green : Colors.mutedForeground, fontSize: 11, fontWeight: '600' }}>
                    {conv.status}
                  </Text>
                </View>
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
  iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
})
