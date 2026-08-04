import { useEffect, useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, FlatList, StyleSheet, RefreshControl } from 'react-native'
import { apiFetch, paginate, formatDate } from '@/lib/api'
import { Screen, Spinner, EmptyState, Badge, ModalView, Field, Button } from '@/components/ui'
import { Colors } from '@/lib/theme'
import { Ionicons } from '@expo/vector-icons'

interface Lead {
  id: string
  name?: string | null
  email?: string | null
  phone?: string | null
  message?: string | null
  source?: string | null
  status: string
  department?: string | null
  createdAt: string
}

const statusColors: Record<string, 'green' | 'blue' | 'orange' | 'purple' | 'slate' | 'red'> = {
  new: 'blue',
  contacted: 'orange',
  qualified: 'green',
  closed: 'slate',
}

const statusOptions = ['new', 'contacted', 'qualified', 'closed']

export default function LeadsScreen() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selected, setSelected] = useState<Lead | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const data = await apiFetch('/leads')
      setLeads(paginate<Lead>(data).items)
    } catch (e: any) {
      setError(e?.message || 'Failed to load leads')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const updateStatus = async (status: string) => {
    if (!selected) return
    try {
      await apiFetch(`/leads/${selected.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      setLeads((prev) => prev.map((l) => (l.id === selected.id ? { ...l, status } : l)))
      setSelected((prev) => (prev ? { ...prev, status } : prev))
    } catch (e: any) {
      setError(e?.message || 'Failed to update status')
    }
  }

  return (
    <Screen>
      <View style={{ paddingTop: 12 }}>
        <Text style={{ color: Colors.foreground, fontSize: 22, fontWeight: '700', marginBottom: 4 }}>Leads</Text>
        <Text style={{ color: Colors.mutedForeground, fontSize: 13, marginBottom: 12 }}>
          People captured through the widget
        </Text>
      </View>

      {loading ? (
        <Spinner label="Loading leads…" />
      ) : leads.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="people-outline" size={40} color={Colors.slate} />}
          title="No leads yet"
          subtitle="When visitors leave their details in the chat, they show up here."
        />
      ) : (
        <FlatList
          data={leads}
          keyExtractor={(l) => l.id}
          contentContainerStyle={{ paddingBottom: 20, gap: 8 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={Colors.primary} />}
          renderItem={({ item }) => (
            <TouchableOpacity activeOpacity={0.8} onPress={() => setSelected(item)} style={styles.row}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <Text style={{ color: Colors.foreground, fontSize: 14, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                    {item.name || 'Anonymous'}
                  </Text>
                  <Badge text={item.status} variant={statusColors[item.status] || 'slate'} />
                </View>
                {item.email ? (
                  <Text style={{ color: Colors.mutedForeground, fontSize: 12, marginTop: 3 }} numberOfLines={1}>{item.email}</Text>
                ) : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 }}>
                  {item.department ? (
                    <Text style={{ color: Colors.primary, fontSize: 11 }}>{item.department}</Text>
                  ) : null}
                  {item.phone ? <Text style={{ color: Colors.slate, fontSize: 11 }}>{item.phone}</Text> : null}
                  <Text style={{ color: Colors.slate, fontSize: 11 }}>{formatDate(item.createdAt)}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.mutedForeground} />
            </TouchableOpacity>
          )}
        />
      )}

      <ModalView visible={!!selected} onClose={() => setSelected(null)} title="Lead Details">
        {selected && (
          <>
            {error ? <Text style={{ color: Colors.red, fontSize: 12, marginBottom: 10 }}>{error}</Text> : null}
            <Field label="Name" value={selected.name || 'Anonymous'} editable={false} />
            <Field label="Email" value={selected.email || '—'} editable={false} />
            <Field label="Phone" value={selected.phone || '—'} editable={false} />
            {selected.department ? (
              <Field label="Department" value={selected.department} editable={false} />
            ) : null}
            {selected.source ? (
              <Field label="Source" value={selected.source} editable={false} />
            ) : null}
            {selected.message ? (
              <View style={{ marginBottom: 14 }}>
                <Text style={{ color: Colors.mutedForeground, fontSize: 12, marginBottom: 6 }}>Message</Text>
                <Text style={{ color: Colors.foreground, fontSize: 14, backgroundColor: Colors.secondary, borderRadius: 10, padding: 12, lineHeight: 20 }}>
                  {selected.message}
                </Text>
              </View>
            ) : null}
            <Text style={{ color: Colors.mutedForeground, fontSize: 12, marginBottom: 8 }}>Update status</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {statusOptions.map((status) => (
                <TouchableOpacity
                  key={status}
                  onPress={() => updateStatus(status)}
                  style={[styles.statusChip, selected.status === status && { backgroundColor: Colors.primarySoft, borderColor: Colors.primary }]}
                >
                  <Text style={{ color: selected.status === status ? Colors.primary : Colors.mutedForeground, fontSize: 12, fontWeight: '600', textTransform: 'capitalize' }}>
                    {status}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Button title="Done" onPress={() => setSelected(null)} />
          </>
        )}
      </ModalView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  statusChip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
})
