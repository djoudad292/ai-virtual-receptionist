import { useState, useEffect, useCallback, useRef } from 'react'
import { View, Text, TouchableOpacity, Alert } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Screen, Card, Button, Spinner, EmptyState } from '@/components/ui'
import { StackHeader } from '@/components/stack-header'
import { MarkdownText } from '@/components/markdown'
import { apiFetch, paginate } from '@/lib/api'
import { Colors } from '@/lib/theme'

interface Document {
  id: string
  title: string
  status: string
}

export default function SummaryScreen() {
  const router = useRouter()
  const { id, title } = useLocalSearchParams<{ id: string; title: string }>()
  const [documents, setDocuments] = useState<Document[]>([])
  const [docsLoading, setDocsLoading] = useState(true)
  const [activeId, setActiveId] = useState<string>(id || '')
  const [activeTitle, setActiveTitle] = useState<string>(title || '')
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [revealed, setRevealed] = useState(0)
  const revealRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    apiFetch('/knowledge-base?page=1&limit=100')
      .then((data) => {
        const ready = paginate<Document>(data).items.filter((d) => d.status === 'ready')
        setDocuments(ready)
        if (!activeId && ready.length > 0) {
          setActiveId(ready[0].id)
          setActiveTitle(ready[0].title)
        }
      })
      .catch(() => Alert.alert('Error', 'Failed to load documents'))
      .finally(() => setDocsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reveal = useCallback((text: string) => {
    if (revealRef.current) clearInterval(revealRef.current)
    const words = text.split(' ')
    setRevealed(0)
    let n = 0
    revealRef.current = setInterval(() => {
      n += 2
      if (n >= words.length) {
        n = words.length
        if (revealRef.current) clearInterval(revealRef.current)
      }
      setRevealed(n)
    }, 24)
  }, [])

  useEffect(() => {
    return () => {
      if (revealRef.current) clearInterval(revealRef.current)
    }
  }, [])

  const generate = useCallback(
    async (force = false) => {
      if (!activeId) return
      setGenerating(true)
      setLoading(true)
      setSummary('')
      try {
        const res = await apiFetch<{ summary: string; cached: boolean }>(`/knowledge-base/${activeId}/summarize`, {
          method: 'POST',
          body: JSON.stringify({ force }),
        })
        setSummary(res.summary)
        reveal(res.summary)
      } catch (err: any) {
        Alert.alert('Error', err?.message || 'Failed to summarize')
      } finally {
        setGenerating(false)
        setLoading(false)
      }
    },
    [activeId, reveal]
  )

  useEffect(() => {
    if (activeId && !title) {
      setLoading(true)
      generate(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  const done = revealed >= summary.split(' ').length

  const selectDoc = (doc: Document) => {
    setActiveId(doc.id)
    setActiveTitle(doc.title)
  }

  return (
    <Screen scroll>
      <StackHeader title="Summaries" onBack={() => router.back()} />

      {docsLoading ? (
        <Spinner label="Loading documents…" />
      ) : documents.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="sparkles-outline" size={40} color={Colors.mutedForeground} />}
          title="Nothing to summarize yet"
          subtitle="Upload and process a document first — summaries are generated from its content."
        />
      ) : (
        <>
          <Text style={{ color: Colors.mutedForeground, fontSize: 13, marginBottom: 6 }}>Document</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {documents.map((doc) => (
              <TouchableOpacity
                key={doc.id}
                onPress={() => selectDoc(doc)}
                style={{
                  borderWidth: 1,
                  borderColor: activeId === doc.id ? Colors.primary : Colors.border,
                  backgroundColor: activeId === doc.id ? Colors.primarySoft : Colors.muted,
                  borderRadius: 999,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                }}
              >
                <Text
                  style={{ color: activeId === doc.id ? Colors.primary : Colors.mutedForeground, fontSize: 12, fontWeight: '600' }}
                  numberOfLines={1}
                >
                  {doc.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={{ color: Colors.foreground, fontSize: 16, fontWeight: '700', marginBottom: 10 }}>
            {activeTitle || 'Summary'}
          </Text>

          {loading && !summary ? (
            <Card>
              <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                <Ionicons name="sparkles" size={22} color={Colors.primary} />
                <View style={{ flexDirection: 'row', gap: 5, marginTop: 12 }}>
                  {[0, 1, 2].map((i) => (
                    <View
                      key={i}
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: Colors.primary,
                        opacity: 0.5,
                      }}
                    />
                  ))}
                </View>
                <Text style={{ color: Colors.mutedForeground, fontSize: 13, marginTop: 10 }}>Reading the document and writing a summary…</Text>
              </View>
            </Card>
          ) : (
            <Card>
              {summary ? (
                <View>
                  <MarkdownText>{summary.split(' ').slice(0, revealed).join(' ') + (done ? '' : ' ▍')}</MarkdownText>
                  <View style={{ marginTop: 16 }}>
                    <Button title="Regenerate" variant="outline" onPress={() => generate(true)} loading={generating} />
                  </View>
                </View>
              ) : (
                <Text style={{ color: Colors.mutedForeground, fontSize: 14 }}>
                  Pick a document above and tap Generate to create its summary.
                </Text>
              )}
            </Card>
          )}
        </>
      )}
    </Screen>
  )
}

