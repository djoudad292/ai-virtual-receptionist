import { useEffect, useState, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import * as DocumentPicker from 'expo-document-picker'
import { File, Directory, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { apiFetch, paginate, formatDate, getApiUrl, getToken } from '@/lib/api'
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
  filename?: string | null
  sizeBytes?: number
  pageCount?: number
  status?: string
  published?: boolean
}

const PAGE_SIZE = 20
const MAX_FILE_SIZE = 2 * 1024 * 1024
const MAX_PDF_SIZE = 10 * 1024 * 1024

export default function KnowledgeScreen() {
  const router = useRouter()
  const [docs, setDocs] = useState<Document[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Document[]>([])
  const [searching, setSearching] = useState(false)

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const data = await apiFetch(`/knowledge-base?page=${page}&limit=${PAGE_SIZE}`)
      const p = paginate<Document>(data)
      setDocs(p.items)
      setTotal(p.total)
    } catch (e: any) {
      setError(e?.message || 'Failed to load documents')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [page])

  useEffect(() => {
    load()
  }, [load])

  const reloadFirstPage = () => {
    if (page === 1) load()
    else setPage(1)
  }

  const createDoc = async () => {
    if (!title.trim() || !content.trim()) {
      setError('Both title and content are required')
      return
    }
    setSaving(true)
    setError('')
    try {
      await apiFetch('/knowledge-base', {
        method: 'POST',
        body: JSON.stringify({ title: title.trim(), content: content.trim() }),
      })
      setShowCreate(false)
      setTitle('')
      setContent('')
      Alert.alert('Document added', `"${title.trim()}" was added to your knowledge base.`)
      reloadFirstPage()
    } catch (e: any) {
      setError(e?.message || 'Failed to create document')
    } finally {
      setSaving(false)
    }
  }

  const uploadDoc = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', 'text/markdown', 'application/pdf'],
        copyToCacheDirectory: true,
      })
      if (result.canceled || !result.assets?.length) return
      const asset = result.assets[0]
      const ext = (asset.name || '').split('.').pop()?.toLowerCase()
      const isPdf = ext === 'pdf'
      if (!ext || !['txt', 'md', 'markdown', 'pdf'].includes(ext)) {
        Alert.alert('Unsupported file', 'Please choose a .txt, .md or .pdf file.')
        return
      }
      if (asset.size && asset.size > (isPdf ? MAX_PDF_SIZE : MAX_FILE_SIZE)) {
        Alert.alert('File too large', isPdf ? 'The PDF must be under 10MB.' : 'The file must be under 2MB.')
        return
      }
      const form = new FormData()
      const file: any = {
        uri: asset.uri,
        name: asset.name || 'document.txt',
        type: asset.mimeType || (isPdf ? 'application/pdf' : 'text/plain'),
      }
      form.append('file', file)
      setUploading(true)
      setError('')
      await apiFetch('/knowledge-base/upload', {
        method: 'POST',
        body: form,
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      Alert.alert('Uploaded', `"${asset.name}" was added to your knowledge base.`)
      reloadFirstPage()
    } catch (e: any) {
      setError(e?.message || 'Failed to upload file')
    } finally {
      setUploading(false)
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
            setTotal((t) => Math.max(t - 1, 0))
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
      Alert.alert('Re-indexed', `"${doc.title}" was re-indexed.`)
    } catch (e: any) {
      setError(e?.message || 'Failed to reindex document')
    }
  }

  const togglePublished = async (doc: Document) => {
    const next = !doc.published
    setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, published: next } : d)))
    try {
      await apiFetch(`/knowledge-base/${doc.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ published: next }),
      })
      Alert.alert('Updated', next ? 'Document published to the chat widget.' : 'Document hidden from the chat widget.')
    } catch (e: any) {
      setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, published: !next } : d)))
      setError(e?.message || 'Failed to update document')
    }
  }

  const downloadDoc = async (doc: Document) => {
    try {
      const token = await getToken()
      const file = await File.downloadFileAsync(
        `${getApiUrl()}/knowledge-base/${doc.id}/download`,
        new Directory(Paths.cache),
        {
          idempotent: true,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        }
      )
      const available = await Sharing.isAvailableAsync()
      if (available) {
        await Sharing.shareAsync(file.uri, { mimeType: file.type || 'application/octet-stream', dialogTitle: doc.filename || doc.title })
      } else {
        Alert.alert('Downloaded', `File saved to cache: ${file.uri}`)
      }
    } catch (e: any) {
      const msg = e?.message || ''
      if (msg.includes('404')) {
        setError('No original file stored for this document')
      } else {
        setError(msg || 'Failed to download file')
      }
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    setError('')
    try {
      const data = await apiFetch('/knowledge-base/search', {
        method: 'POST',
        body: JSON.stringify({ query: searchQuery.trim() }),
      })
      setSearchResults(Array.isArray(data) ? data : data.results || [])
    } catch (e: any) {
      setError(e?.message || 'Search failed')
    } finally {
      setSearching(false)
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
          <Button title={uploading ? 'Uploading…' : 'Upload File'} onPress={uploadDoc} variant="outline" loading={uploading} />
        </View>
      </View>

      {error ? <Text style={{ color: Colors.red, fontSize: 13, marginBottom: 12 }}>{error}</Text> : null}

      <Text style={styles.sectionTitle}>Search knowledge base</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search your documents..."
          placeholderTextColor={Colors.mutedForeground}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          style={styles.searchInput}
        />
        <TouchableOpacity onPress={handleSearch} disabled={searching || !searchQuery.trim()} style={[styles.searchBtn, { opacity: searching || !searchQuery.trim() ? 0.5 : 1 }]}>
          <Ionicons name="search" size={18} color={Colors.primaryForeground} />
        </TouchableOpacity>
      </View>
      {searchResults.length > 0 ? (
        <Card>
          {searchResults.map((doc) => (
            <View key={doc.id} style={styles.searchResult}>
              <Text style={{ color: Colors.foreground, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
                {doc.title}
              </Text>
              {doc.content ? (
                <Text style={{ color: Colors.mutedForeground, fontSize: 12, marginTop: 3, lineHeight: 17 }} numberOfLines={2}>
                  {doc.content}
                </Text>
              ) : null}
            </View>
          ))}
        </Card>
      ) : null}

      <Text style={styles.sectionTitle}>Documents ({total})</Text>

      {loading ? (
        <Spinner label="Loading documents…" />
      ) : docs.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Ionicons name="document-text-outline" size={40} color={Colors.slate} />}
            title="No documents yet"
            subtitle="Add facts, FAQs or product info so the AI can answer visitors accurately. Supports .txt, .md, .markdown and .pdf files."
          />
        </Card>
      ) : (
        <>
          <FlatList
            data={docs}
            keyExtractor={(d) => d.id}
            contentContainerStyle={{ paddingBottom: 12, gap: 8 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={Colors.primary} />}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ color: Colors.foreground, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {item.status === 'ready' ? (
                      <Ionicons name="checkmark-circle" size={14} color={Colors.green} />
                    ) : item.status === 'error' ? (
                      <Ionicons name="alert-circle" size={14} color={Colors.red} />
                    ) : null}
                  </View>
                  <Text style={{ color: Colors.mutedForeground, fontSize: 12, marginTop: 3 }}>
                    {item.chunkCount ? `${item.chunkCount} chunks · ` : ''}Added {formatDate(item.createdAt)}
                    {item.pageCount ? ` · ${item.pageCount} pages` : ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => togglePublished(item)} style={styles.iconBtn} hitSlop={8}>
                  <Ionicons
                    name={item.published !== false ? 'globe-outline' : 'eye-off-outline'}
                    size={18}
                    color={item.published !== false ? Colors.blue : Colors.mutedForeground}
                  />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => downloadDoc(item)} style={styles.iconBtn} hitSlop={8}>
                  <Ionicons name="download-outline" size={18} color={Colors.green} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => reindexDoc(item)} style={styles.iconBtn} hitSlop={8}>
                  <Ionicons name="refresh-outline" size={18} color={Colors.blue} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteDoc(item)} style={styles.iconBtn} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color={Colors.red} />
                </TouchableOpacity>
              </View>
            )}
          />
          {total > PAGE_SIZE && (
            <View style={styles.pager}>
              <TouchableOpacity
                onPress={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page <= 1}
                style={[styles.pagerBtn, { opacity: page <= 1 ? 0.4 : 1 }]}
              >
                <Ionicons name="chevron-back" size={16} color={Colors.foreground} />
                <Text style={{ color: Colors.foreground, fontSize: 12, fontWeight: '600' }}>Previous</Text>
              </TouchableOpacity>
              <Text style={{ color: Colors.mutedForeground, fontSize: 12 }}>
                Page {page} of {totalPages}
              </Text>
              <TouchableOpacity
                onPress={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
                style={[styles.pagerBtn, { opacity: page >= totalPages ? 0.4 : 1 }]}
              >
                <Text style={{ color: Colors.foreground, fontSize: 12, fontWeight: '600' }}>Next</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.foreground} />
              </TouchableOpacity>
            </View>
          )}
        </>
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
        <Button title="Save Document" onPress={createDoc} loading={saving} />
      </ModalView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  sectionTitle: { color: Colors.mutedForeground, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8, marginBottom: 8 },
  searchInput: {
    flex: 1,
    backgroundColor: Colors.secondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    color: Colors.foreground,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  searchBtn: {
    width: 42,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResult: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
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
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  pagerBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6 },
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
