import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { apiFetch } from '@/lib/api'
import { Screen, Card, Spinner, EmptyState } from '@/components/ui'
import { StackHeader } from '@/components/stack-header'
import { Colors } from '@/lib/theme'
import { Ionicons } from '@expo/vector-icons'

interface Summary {
  total: number
  active: number
  aiHandled: number
  humanHandled: number
  unresolved: number
  leads: number
  appointments: number
}

interface Detail {
  conversationsByDay: { day: string; count: number }[]
  leadsByDay: { day: string; count: number }[]
  leadsByDepartment: { name: string; count: number }[]
}

export default function AnalyticsScreen() {
  const router = useRouter()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([apiFetch('/analytics/summary'), apiFetch('/analytics/detail')])
      .then(([s, d]) => {
        setSummary(s as Summary)
        setDetail(d as Detail)
      })
      .catch((e) => setError(e?.message || 'Failed to load analytics'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <Screen>
        <StackHeader title="Analytics" onBack={() => router.back()} />
        <Spinner label="Loading analytics…" />
      </Screen>
    )
  }

  const stats: { label: string; value: number; color: string }[] = summary
    ? [
        { label: 'Conversations', value: summary.total, color: Colors.blue },
        { label: 'Active now', value: summary.active, color: Colors.green },
        { label: 'AI handled', value: summary.aiHandled, color: Colors.purple },
        { label: 'Human handled', value: summary.humanHandled, color: Colors.orange },
        { label: 'Unresolved', value: summary.unresolved, color: Colors.red },
        { label: 'Leads', value: summary.leads, color: Colors.green },
        { label: 'Appointments', value: summary.appointments, color: Colors.orange },
      ]
    : []

  const maxConv = Math.max(1, ...(detail?.conversationsByDay.map((d) => d.count) || [0]))
  const maxLead = Math.max(1, ...(detail?.leadsByDay.map((d) => d.count) || [0]))

  return (
    <Screen scroll>
      <StackHeader title="Analytics" onBack={() => router.back()} />

      {error ? <Text style={{ color: Colors.red, fontSize: 13, marginBottom: 12 }}>{error}</Text> : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
        {stats.map((stat) => (
          <View key={stat.label} style={[styles.statCard, { width: '48%', flexGrow: 1 }]}>
            <Text style={{ color: Colors.mutedForeground, fontSize: 12 }}>{stat.label}</Text>
            <Text style={{ color: stat.color, fontSize: 26, fontWeight: '800', marginTop: 4 }}>{stat.value}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Conversations — last 14 days</Text>
      <Card>
        {detail && detail.conversationsByDay.length > 0 ? (
          <BarChart data={detail.conversationsByDay} max={maxConv} color={Colors.blue} />
        ) : (
          <EmptyState title="No data yet" subtitle="Charts appear here once visitors start chatting." />
        )}
      </Card>

      <Text style={styles.sectionTitle}>Leads — last 14 days</Text>
      <Card>
        {detail && detail.leadsByDay.length > 0 ? (
          <BarChart data={detail.leadsByDay} max={maxLead} color={Colors.green} />
        ) : (
          <EmptyState title="No data yet" />
        )}
      </Card>

      <Text style={styles.sectionTitle}>Leads by department</Text>
      <Card>
        {detail && detail.leadsByDepartment.length > 0 ? (
          detail.leadsByDepartment.map((d) => (
            <View key={d.name} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ color: Colors.foreground, fontSize: 13, width: '45%' }} numberOfLines={1}>
                {d.name}
              </Text>
              <View style={{ flex: 1, backgroundColor: Colors.muted, height: 8, borderRadius: 4, marginHorizontal: 10 }}>
                <View
                  style={{
                    backgroundColor: Colors.primary,
                    height: 8,
                    borderRadius: 4,
                    width: `${Math.min(100, (d.count / Math.max(1, detail.leadsByDepartment[0].count)) * 100)}%`,
                  }}
                />
              </View>
              <Text style={{ color: Colors.mutedForeground, fontSize: 13, width: 32, textAlign: 'right' }}>{d.count}</Text>
            </View>
          ))
        ) : (
          <EmptyState title="No leads by department yet" />
        )}
      </Card>
    </Screen>
  )
}

function BarChart({ data, max, color }: { data: { day: string; count: number }[]; max: number; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 4 }}>
      {data.map((d) => (
        <View key={d.day} style={{ flex: 1, alignItems: 'center' }}>
          <View
            style={{
              width: '100%',
              maxWidth: 18,
              height: Math.max(4, (d.count / max) * 100),
              backgroundColor: d.count > 0 ? color : Colors.muted,
              borderRadius: 3,
            }}
          />
          <Text style={{ color: Colors.slate, fontSize: 8, marginTop: 6 }}>{d.day.slice(8)}</Text>
        </View>
      ))}
    </View>
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
  sectionTitle: {
    color: Colors.mutedForeground,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 10,
  },
})
