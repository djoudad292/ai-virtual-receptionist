import { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import * as DocumentPicker from 'expo-document-picker'
import { apiFetch, paginate, formatDate } from '@/lib/api'
import { Screen, Card, Spinner, EmptyState, Button, ModalView, Field } from '@/components/ui'
import { StackHeader } from '@/components/stack-header'
import { Colors } from '@/lib/theme'
import { Ionicons } from '@expo/vector-icons'

interface Document {
  id: string
  title: string
  content?: string
  chunkCount?: number
  createdAt: string
}

export default function KnowledgeScreen() {
  const router = useRouter()
  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  const load = () => {
    apiFetch('/knowledge-base')
      .then((data) => setDocs(paginate<Document>(data).items))
      .catch((e) => setError(e?.message || 'Failed to load documents'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const createDoc = async () => {
    if (!title.trim() || !content.trim()) {
      setError('Both title and content are required')
      return
    }
    setBusy(true)
    setError('')
    try {
      await apiFetch('/knowledge-base', {
        method: 'POST',
        body: JSON.stringify({ title: title.trim(), content: content.trim() }),
      })
      setShowCreate(false)
      setTitle('')
      setContent('')
      load()
    } catch (e: any) {
      setError(e?.message || 'Failed to create document')
    } finally {
      setBusy(false)
    }
  }

  const uploadDoc = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', 'text/markdown'],
        copyToCacheDirectory: true,
      })
      if (result.canceled || !result.assets?.length) return
      const asset = result.assets[0]
      const form = new FormData()
      const file: any = {
        uri: asset.uri,
        name: asset.name || 'document.txt',
        type: asset.mimeType || 'text/plain',
      }
      form.append('file', file)
      setBusy(true)
      setError('')
      await apiFetch('/knowledge-base/upload', {
        method: 'POST',
        body: form,
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      load()
    } catch (e: any) {
      setError(e?.message || 'Failed to upload file')
    } finally {
      setBusy(false)
    }
  }

  const deleteDoc = (doc: Document) => {
    Alert.alert('Delete document', `Remove "${doc.title}" from your knowledge base?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiFetch(`/knowledge-base/${doc.id}`, { method: 'DELETE' })
            setDocs((prev) => prev.filter((d) => d.id !== doc.id))
          } catch (e: any) {
            setError(e?.message || 'Failed to delete document')
          }
        },
      },
    ])
  }

  const reindexDoc = async (doc: Document) => {
    try {
      await apiFetch(`/knowledge-base/${doc.id}/reindex`, { method: 'POST' })
    } catch (e: any) {
      setError(e?.message || 'Failed to reindex document')
    }
  }

  return (
    <Screen>
      <StackHeader title="Knowledge Base" onBack={() => router.back()} />

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
        <View style={{ flex: 1 }}>
          <Button title="Add Document" onPress={() => setShowCreate(true)} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Upload File" onPress={uploadDoc} variant="outline" loading={busy} />
        </View>
      </View>

      {error ? <Text style={{ color: Colors.red, fontSize: 13, marginBottom: 12 }}>{error}</Text> : null}

      {loading ? (
        <Spinner label="Loading documents…" />
      ) : docs.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Ionicons name="document-text-outline" size={40} color={Colors.slate} />}
            title="No documents yet"
            subtitle="Add facts, FAQs or product info so the AI can answer visitors accurately. Supports .txt, .md and .markdown files."
          />
        </Card>
      ) : (
        <FlatList
          data={docs}
          keyExtractor={(d) => d.id}
          contentContainerStyle={{ paddingBottom: 20, gap: 8 }}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: Colors.foreground, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={{ color: Colors.mutedForeground, fontSize: 12, marginTop: 3 }}>
                  {item.chunkCount ? `${item.chunkCount} chunks · ` : ''}Added {formatDate(item.createdAt)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => reindexDoc(item)} style={styles.iconBtn} hitSlop={8}>
                <Ionicons name="refresh-outline" size={18} color={Colors.blue} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteDoc(item)} style={styles.iconBtn} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={Colors.red} />
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      <ModalView visible={showCreate} onClose={() => setShowCreate(false)} title="Add Document">
        <Field label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Shipping policy" />
        <View style={{ marginBottom: 14 }}>
          <Text style={{ color: Colors.foreground, fontSize: 13, fontWeight: '600', marginBottom: 6 }}>Content</Text>
          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder="Facts the AI should know..."
            placeholderTextColor={Colors.mutedForeground}
            multiline
            style={[styles.input, { minHeight: 120, textAlignVertical: 'top' }]}
          />
        </View>
        <Button title="Save Document" onPress={createDoc} loading={busy} />
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
  iconBtn: { padding: 6 },
  input: {
    backgroundColor: Colors.muted,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.foreground,
    fontSize: 15,
  },
})
