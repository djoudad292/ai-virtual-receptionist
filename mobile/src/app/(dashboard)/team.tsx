import { useEffect, useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import * as Clipboard from 'expo-clipboard'
import { useAuth } from '@/lib/auth-context'
import { apiFetch } from '@/lib/api'
import { Screen, Spinner, EmptyState, Badge, ModalView, Field, Button, Card } from '@/components/ui'
import { StackHeader } from '@/components/stack-header'
import { Colors } from '@/lib/theme'
import { Ionicons } from '@expo/vector-icons'

interface Agent {
  id: string
  userId?: string
  name?: string | null
  email?: string | null
  role?: string | null
  isOnline?: boolean
  lastSeen?: string | null
  status?: string
  createdAt?: string
  user?: {
    id: string
    name: string
    email: string
    role: string
  } | null
}

export default function TeamScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const isAdmin = user?.role === 'COMPANY_ADMIN'
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [generated, setGenerated] = useState<{ email: string; name: string; tempPassword: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const data = await apiFetch('/agents')
      setAgents(Array.isArray(data) ? data : data.items || [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load team')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const invite = async () => {
    if (!email.trim()) {
      setError('An email is required')
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await apiFetch('/agents/invite', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), name: name.trim() }),
      })
      setGenerated({
        email: result.email || email.trim(),
        name: result.name || name.trim() || email.trim(),
        tempPassword: result.tempPassword || '',
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

  const copyCredentials = async () => {
    if (!generated) return
    await Clipboard.setStringAsync(
      `Email: ${generated.email}\nName: ${generated.name}\nTemporary password: ${generated.tempPassword}`,
    )
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const remove = (agent: Agent) => {
    Alert.alert('Remove agent', `Remove ${agent.name || agent.user?.name || agent.email || 'this agent'} from your team?`, [
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

      {generated ? (
        <Card style={{ borderColor: Colors.primary }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: Colors.foreground, fontSize: 14, fontWeight: '700' }}>Agent invited</Text>
              <Text style={{ color: Colors.mutedForeground, fontSize: 12, marginTop: 2 }}>
                Share these credentials with {generated.name} so they can sign in.
              </Text>
            </View>
            <TouchableOpacity onPress={copyCredentials} style={styles.copyBtn} hitSlop={8}>
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={copied ? Colors.green : Colors.foreground} />
              <Text style={{ color: copied ? Colors.green : Colors.foreground, fontSize: 12, fontWeight: '600' }}>
                {copied ? 'Copied' : 'Copy'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.credsBox}>
            <Text style={styles.credText}>Email: {generated.email}</Text>
            <Text style={styles.credText}>Name: {generated.name}</Text>
            <Text style={styles.credText}>
              Temporary password: <Text style={{ color: Colors.primary, fontWeight: '700' }}>{generated.tempPassword}</Text>
            </Text>
          </View>
        </Card>
      ) : null}

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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={Colors.primary} />}
          renderItem={({ item }) => {
            const agentName = item.name || item.user?.name || 'Unnamed agent'
            const agentEmail = item.email || item.user?.email || '—'
            const online = !!item.isOnline
            const isSelf = item.userId === user?.id || (item.user?.id && item.user.id === user?.id)
            return (
              <View style={styles.row}>
                <View style={[styles.avatar, { backgroundColor: online ? Colors.greenSoft : Colors.muted }]}>
                  <Text style={{ color: online ? Colors.green : Colors.mutedForeground, fontSize: 15, fontWeight: '700' }}>
                    {agentName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ color: Colors.foreground, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
                      {agentName}
                    </Text>
                    {isSelf ? (
                      <View style={styles.youTag}>
                        <Text style={{ color: Colors.primary, fontSize: 10, fontWeight: '700' }}>YOU</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={{ color: Colors.mutedForeground, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                    {agentEmail}
                  </Text>
                </View>
                <Badge text={online ? 'Online' : 'Offline'} variant={online ? 'green' : 'slate'} />
                {isSelf ? (
                  <TouchableOpacity onPress={() => toggleOnline(item)} style={styles.toggleBtn} hitSlop={8}>
                    <Ionicons name="power-outline" size={18} color={online ? Colors.green : Colors.mutedForeground} />
                    <Text style={{ color: online ? Colors.green : Colors.mutedForeground, fontSize: 11, fontWeight: '600' }}>
                      {online ? 'Online' : 'Offline'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
                {isAdmin ? (
                  <TouchableOpacity onPress={() => remove(item)} style={styles.iconBtn} hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color={Colors.red} />
                  </TouchableOpacity>
                ) : null}
              </View>
            )
          }}
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
  toggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, padding: 4 },
  youTag: {
    backgroundColor: Colors.primarySoft,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  credsBox: {
    backgroundColor: Colors.secondary,
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  credText: { color: Colors.foreground, fontSize: 12 },
})
