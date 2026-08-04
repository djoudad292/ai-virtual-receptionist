import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import * as Clipboard from 'expo-clipboard'
import { useAuth } from '@/lib/auth-context'
import { apiFetch } from '@/lib/api'
import { Screen, Card, Spinner, Button, ModalView, Field } from '@/components/ui'
import { StackHeader } from '@/components/stack-header'
import { Colors, API_URL } from '@/lib/theme'
import { Ionicons } from '@expo/vector-icons'

interface Department {
  id: string
  name: string
  description?: string | null
  keywords: string[]
  email?: string | null
}

const COLOR_PRESETS = ['#3b82f6', '#8b5cf6', '#f97316', '#22c55e', '#ef4444', '#14b8a6']

export default function SettingsScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [companyName, setCompanyName] = useState('Your Company')
  const [departments, setDepartments] = useState<Department[]>([])
  const [widget, setWidget] = useState({ title: 'Customer Support', color: '#3b82f6', position: 'right' })
  const [widgetSaving, setWidgetSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [deptModal, setDeptModal] = useState(false)
  const [deptForm, setDeptForm] = useState({ name: '', description: '', keywords: '' })
  const [deptSaving, setDeptSaving] = useState(false)

  useEffect(() => {
    apiFetch('/companies/profile')
      .then((data) => {
        setCompanyName(data?.name || 'Your Company')
        const w = data?.settings?.widget
        if (w) {
          setWidget({
            title: w.title || 'Customer Support',
            color: w.color || '#3b82f6',
            position: w.position === 'left' ? 'left' : 'right',
          })
        }
      })
      .catch((e) => setError(e?.message || 'Failed to load settings'))
    apiFetch('/departments')
      .then((data) => setDepartments(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const saveWidget = async () => {
    setWidgetSaving(true)
    setError('')
    try {
      await apiFetch('/companies/settings', {
        method: 'PATCH',
        body: JSON.stringify({ widget }),
      })
      Alert.alert('Saved', 'Widget settings updated.')
    } catch (e: any) {
      setError(e?.message || 'Failed to save widget settings')
    } finally {
      setWidgetSaving(false)
    }
  }

  const embedCode = user?.companyId
    ? `<script src="${API_URL}/widget.js" data-api-url="${API_URL}" data-ws-url="${API_URL}" data-company-id="${user.companyId}" data-title="${widget.title}" data-primary-color="${widget.color}" data-position="${widget.position}"></script>`
    : ''

  const copyEmbed = async () => {
    await Clipboard.setStringAsync(embedCode)
    setCopied(true)
    Alert.alert('Copied', 'Embed code copied to your clipboard.')
    setTimeout(() => setCopied(false), 2000)
  }

  const createDepartment = async () => {
    if (!deptForm.name.trim()) {
      setError('Department name is required')
      return
    }
    setDeptSaving(true)
    setError('')
    try {
      const dept = await apiFetch('/departments', {
        method: 'POST',
        body: JSON.stringify({
          name: deptForm.name.trim(),
          description: deptForm.description.trim(),
          keywords: deptForm.keywords,
        }),
      })
      setDepartments((prev) => [...prev, dept])
      setDeptModal(false)
      setDeptForm({ name: '', description: '', keywords: '' })
      Alert.alert('Added', 'Department created.')
    } catch (e: any) {
      setError(e?.message || 'Failed to add department')
    } finally {
      setDeptSaving(false)
    }
  }

  const deleteDepartment = (id: string, name: string) => {
    Alert.alert('Delete department', `Delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiFetch(`/departments/${id}`, { method: 'DELETE' })
            setDepartments((prev) => prev.filter((d) => d.id !== id))
            Alert.alert('Deleted', 'Department removed.')
          } catch (e: any) {
            setError(e?.message || 'Failed to delete department')
          }
        },
      },
    ])
  }

  return (
    <Screen scroll>
      <StackHeader title="Settings" onBack={() => router.back()} />

      {loading ? (
        <Spinner label="Loading settings…" />
      ) : (
        <>
          {error ? <Text style={{ color: Colors.red, fontSize: 13, marginBottom: 12 }}>{error}</Text> : null}

          <Text style={styles.sectionTitle}>Company</Text>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[styles.iconBox, { backgroundColor: Colors.primarySoft }]}>
                <Ionicons name="business-outline" size={20} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: Colors.foreground, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
                  {companyName}
                </Text>
                <Text style={{ color: Colors.mutedForeground, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                  ID: {user?.companyId}
                </Text>
              </View>
            </View>
          </Card>

          <Text style={styles.sectionTitle}>Widget</Text>
          <Card>
            <Field label="Widget title" value={widget.title} onChangeText={(t) => setWidget({ ...widget, title: t })} placeholder="Customer Support" />
            <Text style={{ color: Colors.foreground, fontSize: 13, fontWeight: '600', marginBottom: 6 }}>Primary color</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
              {COLOR_PRESETS.map((color) => (
                <TouchableOpacity
                  key={color}
                  onPress={() => setWidget({ ...widget, color })}
                  style={[
                    styles.swatch,
                    { backgroundColor: color },
                    widget.color.toLowerCase() === color && styles.swatchActive,
                  ]}
                />
              ))}
            </View>
            <Field
              label="Custom color (hex)"
              value={widget.color}
              onChangeText={(c) => setWidget({ ...widget, color: c })}
              placeholder="#3b82f6"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={{ color: Colors.foreground, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>Position</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {(['right', 'left'] as const).map((pos) => (
                <TouchableOpacity
                  key={pos}
                  onPress={() => setWidget({ ...widget, position: pos })}
                  style={[styles.chip, widget.position === pos && { backgroundColor: Colors.primarySoft, borderColor: Colors.primary }]}
                >
                  <Text style={{ color: widget.position === pos ? Colors.primary : Colors.mutedForeground, fontSize: 13, fontWeight: '600', textTransform: 'capitalize' }}>
                    {pos}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Button title="Save Widget Settings" onPress={saveWidget} loading={widgetSaving} />
          </Card>

          <Text style={styles.sectionTitle}>Embed code</Text>
          <Card>
            <Text style={{ color: Colors.mutedForeground, fontSize: 12, marginBottom: 10 }}>
              Add this script to your website to enable the AI receptionist chat widget.
            </Text>
            <View style={styles.codeBox}>
              <Text style={styles.codeText} selectable>
                {embedCode}
              </Text>
            </View>
            <View style={{ marginTop: 12 }}>
              <Button title={copied ? 'Copied!' : 'Copy Embed Code'} onPress={copyEmbed} variant={copied ? 'primary' : 'outline'} />
            </View>
          </Card>

          <Text style={styles.sectionTitle}>Departments</Text>
          <View style={{ marginBottom: 12 }}>
            <Button title="Add Department" onPress={() => setDeptModal(true)} variant="outline" />
          </View>
          {departments.length === 0 ? (
            <Card>
              <Text style={{ color: Colors.mutedForeground, fontSize: 13, textAlign: 'center', paddingVertical: 8 }}>
                No departments yet — create one to route conversations.
              </Text>
            </Card>
          ) : (
            departments.map((dept) => (
              <View key={dept.id} style={styles.deptRow}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: Colors.foreground, fontSize: 14, fontWeight: '600' }}>{dept.name}</Text>
                  {dept.description ? (
                    <Text style={{ color: Colors.mutedForeground, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                      {dept.description}
                    </Text>
                  ) : null}
                  {dept.keywords?.length ? (
                    <Text style={{ color: Colors.primary, fontSize: 11, marginTop: 3 }} numberOfLines={1}>
                      {dept.keywords.join(', ')}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity onPress={() => deleteDepartment(dept.id, dept.name)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color={Colors.red} />
                </TouchableOpacity>
              </View>
            ))
          )}

          <ModalView visible={deptModal} onClose={() => setDeptModal(false)} title="Add Department">
            <Field label="Name" value={deptForm.name} onChangeText={(t) => setDeptForm({ ...deptForm, name: t })} placeholder="Support" />
            <Field label="Description" value={deptForm.description} onChangeText={(t) => setDeptForm({ ...deptForm, description: t })} placeholder="What is this department for?" />
            <Field label="Keywords (comma separated)" value={deptForm.keywords} onChangeText={(t) => setDeptForm({ ...deptForm, keywords: t })} placeholder="billing, invoice, refund" />
            <Button title="Create Department" onPress={createDepartment} loading={deptSaving} />
          </ModalView>
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  sectionTitle: {
    color: Colors.mutedForeground,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 10,
  },
  chip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  codeBox: {
    backgroundColor: Colors.secondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 12,
  },
  codeText: { color: Colors.mutedForeground, fontSize: 11, lineHeight: 16 },
  deptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 14,
    gap: 10,
    marginBottom: 8,
  },
  iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchActive: { borderColor: Colors.foreground },
})
