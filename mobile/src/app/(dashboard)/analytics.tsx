import { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { apiFetch } from '@/lib/api'
import { Screen, Card, Spinner, EmptyState } from '@/components/ui'
import { StackHeader } from '@/components/stack-header'
import { Colors } from '@/lib/theme'

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

function shortDay(day: string): string {
  try {
    const d = new Date(day)
    if (!isNaN(d.getTime())) return d.getDate().toString()
  } catch {}
  return day.slice(8) || day
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

  const aiPercent = summary && summary.total > 0 ? Math.round((summary.aiHandled / summary.total) * 100) : 0
  const humanPercent = summary && summary.total > 0 ? Math.round((summary.humanHandled / summary.total) * 100) : 0
  const resolved = summary ? Math.max(summary.total - summary.unresolved, 0) : 0

  const stats: { label: string; value: number | string; sub?: string; color: string }[] = summary
    ? [
        { label: 'Total Chats', value: summary.total, color: Colors.blue },
        { label: 'AI Handled', value: `${aiPercent}%`, sub: `${summary.aiHandled} conversations`, color: Colors.purple },
        { label: 'Leads Captured', value: summary.leads, color: Colors.orange },
        { label: 'Appointments', value: summary.appointments, color: Colors.green },
        { label: 'Active now', value: summary.active, color: Colors.green },
        { label: 'Human handled', value: summary.humanHandled, color: Colors.orange },
      ]
    : []

  const maxConv = Math.max(1, ...(detail?.conversationsByDay.map((d) => d.count) || [0]))
  const maxLead = Math.max(1, ...(detail?.leadsByDay.map((d) => d.count) || [0]))
  const maxDept = Math.max(1, ...(detail?.leadsByDepartment.map((d) => d.count) || [0]))

  return (
    <Screen scroll>
      <StackHeader title="Analytics" onBack={() => router.back()} />

      {error ? <Text style={{ color: Colors.red, fontSize: 13, marginBottom: 12 }}>{error}</Text> : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
        {stats.map((stat) => (
          <View key={stat.label} style={[styles.statCard, { width: '48%', flexGrow: 1 }]}>
            <Text style={{ color: Colors.mutedForeground, fontSize: 12 }}>{stat.label}</Text>
            <Text style={{ color: stat.color, fontSize: 26, fontWeight: '800', marginTop: 4 }}>{stat.value}</Text>
            {stat.sub ? (
              <Text style={{ color: Colors.mutedForeground, fontSize: 11, marginTop: 2 }}>{stat.sub}</Text>
            ) : null}
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Conversations — last 14 days</Text>
      <Card>
        {detail && detail.conversationsByDay.length > 0 ? (
          <>
            <BarChart data={detail.conversationsByDay} max={maxConv} color={Colors.blue} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              <Text style={{ color: Colors.slate, fontSize: 11 }}>{shortDay(detail.conversationsByDay[0].day)}</Text>
              <Text style={{ color: Colors.slate, fontSize: 11 }}>{shortDay(detail.conversationsByDay[detail.conversationsByDay.length - 1].day)}</Text>
            </View>
          </>
        ) : (
          <EmptyState title="No data yet" subtitle="Charts appear here once visitors start chatting." />
        )}
      </Card>

      <Text style={styles.sectionTitle}>Leads — last 14 days</Text>
      <Card>
        {detail && detail.leadsByDay.length > 0 ? (
          <>
            <BarChart data={detail.leadsByDay} max={maxLead} color={Colors.orange} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              <Text style={{ color: Colors.slate, fontSize: 11 }}>{shortDay(detail.leadsByDay[0].day)}</Text>
              <Text style={{ color: Colors.slate, fontSize: 11 }}>{shortDay(detail.leadsByDay[detail.leadsByDay.length - 1].day)}</Text>
            </View>
          </>
        ) : (
          <EmptyState title="No data yet" />
        )}
      </Card>

      <Text style={styles.sectionTitle}>Leads by department</Text>
      <Card>
        {detail && detail.leadsByDepartment.length > 0 ? (
          detail.leadsByDepartment.map((d, i) => (
            <View key={d.name} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ color: Colors.foreground, fontSize: 13, width: '45%' }} numberOfLines={1}>
                {d.name}
              </Text>
              <View style={{ flex: 1, backgroundColor: Colors.muted, height: 8, borderRadius: 4, marginHorizontal: 10 }}>
                <View
                  style={{
                    backgroundColor: [Colors.blue, Colors.purple, Colors.orange, Colors.green, Colors.red, Colors.cyan][i % 6],
                    height: 8,
                    borderRadius: 4,
                    width: `${Math.min(100, (d.count / maxDept) * 100)}%`,
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

      <Text style={styles.sectionTitle}>AI vs Human handled</Text>
      <Card>
        <View style={{ flexDirection: 'row', height: 32, borderRadius: 8, overflow: 'hidden', backgroundColor: Colors.muted }}>
          {aiPercent > 0 && (
            <View style={{ width: `${aiPercent}%`, backgroundColor: Colors.purple, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{aiPercent > 8 ? `AI ${aiPercent}%` : ''}</Text>
            </View>
          )}
          {humanPercent > 0 && (
            <View style={{ width: `${humanPercent}%`, backgroundColor: Colors.orange, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{humanPercent > 8 ? `Human ${humanPercent}%` : ''}</Text>
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={[styles.legendDot, { backgroundColor: Colors.purple }]} />
            <Text style={{ color: Colors.mutedForeground, fontSize: 12 }}>AI ({summary?.aiHandled || 0})</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={[styles.legendDot, { backgroundColor: Colors.orange }]} />
            <Text style={{ color: Colors.mutedForeground, fontSize: 12 }}>Human ({summary?.humanHandled || 0})</Text>
          </View>
        </View>
      </Card>

      <Text style={styles.sectionTitle}>Conversation status</Text>
      <Card>
        {summary && summary.total > 0 ? (
          <>
            {[
              { label: 'Active', value: summary.active, color: Colors.green },
              { label: 'Resolved', value: resolved, color: Colors.blue },
              { label: 'Unresolved', value: summary.unresolved, color: Colors.red },
            ].map((row) => (
              <View key={row.label} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                  <Text style={{ color: Colors.mutedForeground, fontSize: 13 }}>{row.label}</Text>
                  <Text style={{ color: Colors.foreground, fontSize: 13, fontWeight: '600' }}>{row.value}</Text>
                </View>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: Colors.muted, overflow: 'hidden' }}>
                  <View style={{ width: `${Math.min(100, (row.value / summary.total) * 100)}%`, height: 6, borderRadius: 3, backgroundColor: row.color }} />
                </View>
              </View>
            ))}
          </>
        ) : (
          <EmptyState title="No conversations yet" />
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
          <Text style={{ color: Colors.slate, fontSize: 8, marginTop: 6 }}>{shortDay(d.day)}</Text>
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
  legendDot: { width: 12, height: 12, borderRadius: 6 },
})
