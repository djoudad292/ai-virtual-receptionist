import { useEffect, useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, FlatList, StyleSheet, RefreshControl, Platform } from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { apiFetch, paginate, formatDateTime } from '@/lib/api'
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

const statusOptions = ['requested', 'confirmed', 'completed', 'cancelled']
const durationOptions = [15, 30, 45, 60]

export default function AppointmentsScreen() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selected, setSelected] = useState<Appointment | null>(null)
  const [error, setError] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title: '', customerName: '', customerEmail: '', notes: '' })
  const [date, setDate] = useState(new Date())
  const [time, setTime] = useState(new Date(Date.now() + 60 * 60 * 1000))
  const [duration, setDuration] = useState(30)
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const data = await apiFetch('/appointments')
      setAppointments(paginate<Appointment>(data).items)
    } catch (e: any) {
      setError(e?.message || 'Failed to load appointments')
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

  const onPickerChange = (event: any, value?: Date) => {
    if (Platform.OS === 'android') setPickerMode(null)
    if (!value) return
    if (pickerMode === 'date') setDate(value)
    else if (pickerMode === 'time') setTime(value)
  }

  const createAppointment = async () => {
    if (!form.title.trim() || !form.customerName.trim()) {
      setError('Title and customer name are required')
      return
    }
    setSaving(true)
    setError('')
    try {
      const startTime = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        time.getHours(),
        time.getMinutes(),
      )
      await apiFetch('/appointments', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title.trim(),
          customerName: form.customerName.trim(),
          customerEmail: form.customerEmail.trim(),
          notes: form.notes.trim(),
          startTime: startTime.toISOString(),
          durationMinutes: duration,
        }),
      })
      setShowCreate(false)
      setForm({ title: '', customerName: '', customerEmail: '', notes: '' })
      load()
    } catch (e: any) {
      setError(e?.message || 'Failed to create appointment')
    } finally {
      setSaving(false)
    }
  }

  const formatDuration = (start: string, end?: string | null) => {
    if (end) {
      const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)
      if (mins > 0) return `${mins} min`
    }
    return null
  }

  const closeCreate = () => {
    setShowCreate(false)
    setError('')
    setPickerMode(null)
  }

  return (
    <Screen>
      <View style={{ paddingTop: 12, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: Colors.foreground, fontSize: 22, fontWeight: '700', marginBottom: 4 }}>Appointments</Text>
          <Text style={{ color: Colors.mutedForeground, fontSize: 13, marginBottom: 12 }}>
            Bookings your AI assistant scheduled
          </Text>
        </View>
        <TouchableOpacity onPress={() => setShowCreate(true)} style={styles.addBtn}>
          <Ionicons name="add" size={18} color={Colors.primaryForeground} />
          <Text style={{ color: Colors.primaryForeground, fontSize: 13, fontWeight: '600' }}>New</Text>
        </TouchableOpacity>
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={Colors.primary} />}
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
                <Text style={{ color: Colors.slate, fontSize: 11, marginTop: 3 }}>
                  {formatDateTime(item.startTime)}
                  {formatDuration(item.startTime, item.endTime) ? ` · ${formatDuration(item.startTime, item.endTime)}` : ''}
                </Text>
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
            {selected.endTime ? (
              <Field label="Duration" value={formatDuration(selected.startTime, selected.endTime) || '—'} editable={false} />
            ) : null}
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

      <ModalView visible={showCreate} onClose={closeCreate} title="New Appointment">
        {error ? <Text style={{ color: Colors.red, fontSize: 12, marginBottom: 10 }}>{error}</Text> : null}
        <Field label="Title" value={form.title} onChangeText={(t) => setForm({ ...form, title: t })} placeholder="e.g. Demo call" />
        <Field label="Customer name" value={form.customerName} onChangeText={(t) => setForm({ ...form, customerName: t })} placeholder="Jane Doe" />
        <Field label="Customer email" value={form.customerEmail} onChangeText={(t) => setForm({ ...form, customerEmail: t })} placeholder="jane@company.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
        <Field label="Notes" value={form.notes} onChangeText={(t) => setForm({ ...form, notes: t })} placeholder="Anything to know for the meeting" />

        <Text style={{ color: Colors.mutedForeground, fontSize: 12, marginBottom: 6 }}>Date</Text>
        <TouchableOpacity onPress={() => setPickerMode('date')} style={styles.pickBtn}>
          <Ionicons name="calendar-outline" size={16} color={Colors.primary} />
          <Text style={{ color: Colors.foreground, fontSize: 14, flex: 1 }}>
            {date.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
          </Text>
        </TouchableOpacity>

        <Text style={{ color: Colors.mutedForeground, fontSize: 12, marginTop: 12, marginBottom: 6 }}>Time</Text>
        <TouchableOpacity onPress={() => setPickerMode('time')} style={styles.pickBtn}>
          <Ionicons name="time-outline" size={16} color={Colors.primary} />
          <Text style={{ color: Colors.foreground, fontSize: 14, flex: 1 }}>
            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </TouchableOpacity>

        <Text style={{ color: Colors.mutedForeground, fontSize: 12, marginTop: 12, marginBottom: 6 }}>Duration</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          {durationOptions.map((d) => (
            <TouchableOpacity
              key={d}
              onPress={() => setDuration(d)}
              style={[styles.statusChip, duration === d && { backgroundColor: Colors.primarySoft, borderColor: Colors.primary }]}
            >
              <Text style={{ color: duration === d ? Colors.primary : Colors.mutedForeground, fontSize: 12, fontWeight: '600' }}>
                {d} min
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {pickerMode && (
          <DateTimePicker
            value={pickerMode === 'date' ? date : time}
            mode={pickerMode}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onPickerChange}
          />
        )}

        <Button title="Create Appointment" onPress={createAppointment} loading={saving} />
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
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.secondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
})
