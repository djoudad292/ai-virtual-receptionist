import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '@/lib/auth-context'
import { apiFetch } from '@/lib/api'
import { Screen, Spinner, EmptyState, Badge, ModalView, Field, Button } from '@/components/ui'
import { StackHeader } from '@/components/stack-header'
import { Colors } from '@/lib/theme'
import { Ionicons } from '@expo/vector-icons'

interface Agent {
  id: string
  name?: string | null
  email?: string | null
  role?: string | null
  isOnline?: boolean
  lastSeen?: string | null
  status?: string
  createdAt?: string
}

export default function TeamScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const isAdmin = user?.role === 'COMPANY_ADMIN'
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => {
    apiFetch('/agents')
      .then((data) => setAgents(Array.isArray(data) ? data : data.items || []))
      .catch((e) => setError(e?.message || 'Failed to load team'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const invite = async () => {
    if (!email.trim()) {
      setError('An email is required')
      return
    }
    setBusy(true)
    setError('')
    try {
      await apiFetch('/agents/invite', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), name: name.trim() }),
      })
      setShowInvite(false)
      setEmail('')
      setName('')
      load()
    } catch (e: any) {
      setError(e?.message || 'Failed to invite agent')
    } finally {
      setBusy(false)
    }
  }

  const remove = (agent: Agent) => {
    Alert.alert('Remove agent', `Remove ${agent.name || agent.email || 'this agent'} from your team?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiFetch(`/agents/${agent.id}`, { method: 'DELETE' })
            setAgents((prev) => prev.filter((a) => a.id !== agent.id))
          } catch (e: any) {
            setError(e?.message || 'Failed to remove agent')
          }
        },
      },
    ])
  }

  const toggleOnline = async (agent: Agent) => {
    try {
      await apiFetch(`/agents/${agent.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isOnline: !agent.isOnline }),
      })
      setAgents((prev) => prev.map((a) => (a.id === agent.id ? { ...a, isOnline: !a.isOnline } : a)))
    } catch (e: any) {
      setError(e?.message || 'Failed to update status')
    }
  }

  return (
    <Screen>
      <StackHeader title="Team" onBack={() => router.back()} />

      {isAdmin ? (
        <View style={{ marginBottom: 16 }}>
          <Button title="Invite Agent" onPress={() => setShowInvite(true)} />
        </View>
      ) : null}

      {error ? <Text style={{ color: Colors.red, fontSize: 13, marginBottom: 12 }}>{error}</Text> : null}

      {loading ? (
        <Spinner label="Loading team…" />
      ) : agents.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="shield-outline" size={40} color={Colors.slate} />}
          title="No team members yet"
          subtitle={isAdmin ? 'Invite agents to help handle conversations.' : 'Agents added by your admin will appear here.'}
        />
      ) : (
        <FlatList
          data={agents}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ paddingBottom: 20, gap: 8 }}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={[styles.avatar, { backgroundColor: item.isOnline ? Colors.greenSoft : Colors.muted }]}>
                <Text style={{ color: item.isOnline ? Colors.green : Colors.mutedForeground, fontSize: 15, fontWeight: '700' }}>
                  {(item.name || 'A').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: Colors.foreground, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
                  {item.name || 'Unnamed agent'}
                </Text>
                <Text style={{ color: Colors.mutedForeground, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                  {item.email || '—'}
                </Text>
              </View>
              <Badge text={item.isOnline ? 'Online' : 'Offline'} variant={item.isOnline ? 'green' : 'slate'} />
              <TouchableOpacity onPress={() => toggleOnline(item)} style={styles.iconBtn} hitSlop={8}>
                <Ionicons name="power-outline" size={18} color={Colors.blue} />
              </TouchableOpacity>
              {isAdmin ? (
                <TouchableOpacity onPress={() => remove(item)} style={styles.iconBtn} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color={Colors.red} />
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        />
      )}

      <ModalView visible={showInvite} onClose={() => setShowInvite(false)} title="Invite Agent">
        <Field label="Name" value={name} onChangeText={setName} placeholder="Jane Doe" />
        <Field label="Email" value={email} onChangeText={setEmail} placeholder="jane@company.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
        <Button title="Send Invite" onPress={invite} loading={busy} />
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
    gap: 10,
  },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { padding: 4 },
})
