import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native'
import { apiFetch, paginate, formatDate, formatDateTime } from '@/lib/api'
import { Screen, Spinner, EmptyState, Badge, ModalView, Field, Button } from '@/components/ui'
import { Colors } from '@/lib/theme'
import { Ionicons } from '@expo/vector-icons'

interface Appointment {
  id: string
  customerName?: string | null
  customerEmail?: string | null
  title?: string | null
  notes?: string | null
  startTime: string
  endTime?: string | null
  status: string
  createdAt: string
}

const statusColors: Record<string, 'green' | 'blue' | 'orange' | 'purple' | 'slate' | 'red'> = {
  requested: 'orange',
  confirmed: 'green',
  completed: 'blue',
  cancelled: 'red',
}

export default function AppointmentsScreen() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Appointment | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    apiFetch('/appointments')
      .then((data) => setAppointments(paginate<Appointment>(data).items))
      .catch((e) => setError(e?.message || 'Failed to load appointments'))
      .finally(() => setLoading(false))
  }, [])

  const updateStatus = async (status: string) => {
    if (!selected) return
    try {
      await apiFetch(`/appointments/${selected.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      setAppointments((prev) => prev.map((a) => (a.id === selected.id ? { ...a, status } : a)))
      setSelected((prev) => (prev ? { ...prev, status } : prev))
    } catch (e: any) {
      setError(e?.message || 'Failed to update appointment')
    }
  }

  const statusOptions = ['requested', 'confirmed', 'completed', 'cancelled']

  return (
    <Screen>
      <View style={{ paddingTop: 12 }}>
        <Text style={{ color: Colors.foreground, fontSize: 22, fontWeight: '700', marginBottom: 4 }}>Appointments</Text>
        <Text style={{ color: Colors.mutedForeground, fontSize: 13, marginBottom: 12 }}>
          Bookings your AI assistant scheduled
        </Text>
      </View>

      {loading ? (
        <Spinner label="Loading appointments…" />
      ) : appointments.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="calendar-outline" size={40} color={Colors.slate} />}
          title="No appointments yet"
          subtitle="When the AI books a meeting for a visitor, it appears here."
        />
      ) : (
        <FlatList
          data={appointments}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ paddingBottom: 20, gap: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity activeOpacity={0.8} onPress={() => setSelected(item)} style={styles.row}>
              <View style={[styles.dateBox, { backgroundColor: Colors.primarySoft }]}>
                <Text style={{ color: Colors.primary, fontSize: 16, fontWeight: '800' }}>
                  {new Date(item.startTime).getDate()}
                </Text>
                <Text style={{ color: Colors.primary, fontSize: 10, fontWeight: '600', textTransform: 'uppercase' }}>
                  {new Date(item.startTime).toLocaleString('en', { month: 'short' })}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <Text style={{ color: Colors.foreground, fontSize: 14, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                    {item.title || 'Meeting'}
                  </Text>
                  <Badge text={item.status} variant={statusColors[item.status] || 'slate'} />
                </View>
                <Text style={{ color: Colors.mutedForeground, fontSize: 12, marginTop: 3 }} numberOfLines={1}>
                  {item.customerName || '—'}
                </Text>
                <Text style={{ color: Colors.slate, fontSize: 11, marginTop: 3 }}>{formatDateTime(item.startTime)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.mutedForeground} />
            </TouchableOpacity>
          )}
        />
      )}

      <ModalView visible={!!selected} onClose={() => setSelected(null)} title="Appointment Details">
        {selected && (
          <>
            {error ? <Text style={{ color: Colors.red, fontSize: 12, marginBottom: 10 }}>{error}</Text> : null}
            <Field label="Title" value={selected.title || 'Meeting'} editable={false} />
            <Field label="Customer" value={selected.customerName || '—'} editable={false} />
            <Field label="Email" value={selected.customerEmail || '—'} editable={false} />
            <Field label="Start" value={formatDateTime(selected.startTime)} editable={false} />
            {selected.notes ? (
              <View style={{ marginBottom: 14 }}>
                <Text style={{ color: Colors.mutedForeground, fontSize: 12, marginBottom: 6 }}>Notes</Text>
                <Text style={{ color: Colors.foreground, fontSize: 14, backgroundColor: Colors.secondary, borderRadius: 10, padding: 12, lineHeight: 20 }}>
                  {selected.notes}
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
    gap: 12,
  },
  dateBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusChip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
})
