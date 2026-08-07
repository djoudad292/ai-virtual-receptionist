import { useState, useCallback, useEffect, useRef } from 'react'
import { View, Text, FlatList, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, Animated, Easing } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Screen, Spinner, EmptyState } from '@/components/ui'
import { StackHeader } from '@/components/stack-header'
import { apiFetch, paginate } from '@/lib/api'
import { Colors } from '@/lib/theme'

interface Document {
  id: string
  title: string
  status: string
}

interface Source {
  chunkText: string
  similarity: number
}

interface AskResult {
  answer: string
  sources: Source[]
}

interface Message {
  id: number
  role: 'user' | 'assistant'
  text: string
  sources?: Source[]
  reveal: number
  showSources?: boolean
}

function TypingDots() {
  const dots = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current

  useEffect(() => {
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 140),
          Animated.timing(dot, { toValue: 1, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.delay(140 * (3 - i)),
        ])
      )
    )
    animations.forEach((a) => a.start())
    return () => animations.forEach((a) => a.stop())
  }, [dots])

  return (
    <View style={{ flexDirection: 'row', gap: 5, paddingVertical: 4 }}>
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: 3.5,
            backgroundColor: Colors.mutedForeground,
            opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
            transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
          }}
        />
      ))}
    </View>
  )
}

export default function AskScreen() {
  const router = useRouter()
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState('')
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [asking, setAsking] = useState(false)
  const nextId = useRef(0)
  const revealRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const listRef = useRef<FlatList<Message>>(null)

  const load = useCallback(async () => {
    try {
      const data = await apiFetch('/knowledge-base?page=1&limit=100')
      const ready = paginate<Document>(data).items.filter((d) => d.status === 'ready')
      setDocuments(ready)
      if (ready.length === 1 && !selectedId) setSelectedId(ready[0].id)
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to load documents')
    } finally {
      setLoading(false)
    }
  }, [selectedId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    return () => {
      if (revealRef.current) clearInterval(revealRef.current)
    }
  }, [])

  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true })
  }, [messages, asking])

  const revealAnswer = (id: number, answer: string) => {
    const words = answer.split(' ')
    let revealed = 0
    revealRef.current = setInterval(() => {
      revealed += 2
      if (revealed >= words.length) {
        revealed = words.length
        if (revealRef.current) clearInterval(revealRef.current)
      }
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, reveal: revealed } : m)))
    }, 30)
  }

  const ask = async () => {
    const q = question.trim()
    if (!selectedId) {
      Alert.alert('Select a document', 'Pick a ready document before asking.')
      return
    }
    if (!q) return
    if (revealRef.current) clearInterval(revealRef.current)
    const userMsg: Message = { id: nextId.current++, role: 'user', text: q, reveal: -1 }
    setMessages((prev) => [...prev, userMsg])
    setQuestion('')
    setAsking(true)
    try {
      const result = await apiFetch<AskResult>(`/knowledge-base/${selectedId}/ask`, {
        method: 'POST',
        body: JSON.stringify({ question: q }),
      })
      const assistantMsg: Message = { id: nextId.current++, role: 'assistant', text: result.answer, sources: result.sources, reveal: 0 }
      setMessages((prev) => [...prev, assistantMsg])
      revealAnswer(assistantMsg.id, result.answer)
    } catch (err: any) {
      const text = `Error: ${err?.message || 'Something went wrong'}`
      setMessages((prev) => [...prev, { id: nextId.current++, role: 'assistant', text, reveal: -1 }])
    } finally {
      setAsking(false)
    }
  }

  const toggleSources = (id: number) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, showSources: !m.showSources } : m)))
  }

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user'
    const done = item.reveal < 0 || item.reveal >= item.text.split(' ').length
    const visible = item.reveal >= 0 ? item.text.split(' ').slice(0, item.reveal).join(' ') : item.text
    return (
      <View style={{ alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: '85%', marginBottom: 10 }}>
        <View
          style={{
            backgroundColor: isUser ? Colors.primary : Colors.muted,
            borderRadius: 16,
            borderBottomRightRadius: isUser ? 4 : 16,
            borderBottomLeftRadius: isUser ? 16 : 4,
            paddingHorizontal: 14,
            paddingVertical: 10,
          }}
        >
          <Text style={{ color: isUser ? Colors.primaryForeground : Colors.foreground, fontSize: 14, lineHeight: 20 }}>
            {visible}
            {item.reveal >= 0 && !done && <Text style={{ color: Colors.primary }}>▍</Text>}
          </Text>
        </View>

        {!isUser && item.sources && item.sources.length > 0 && done && (
          <TouchableOpacity onPress={() => toggleSources(item.id)} style={{ marginTop: 6 }}>
            <Text style={{ color: Colors.primary, fontSize: 12, fontWeight: '600' }}>
              {item.showSources ? 'Hide sources' : `Show ${item.sources.length} source${item.sources.length > 1 ? 's' : ''}`}
            </Text>
          </TouchableOpacity>
        )}
        {!isUser && item.sources && item.showSources && (
          <View style={{ marginTop: 6, gap: 4 }}>
            {item.sources.map((s, i) => (
              <View key={i} style={{ backgroundColor: Colors.secondary, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 8 }}>
                <Text style={{ color: Colors.mutedForeground, fontSize: 10, marginBottom: 2 }}>Match {Math.round(s.similarity * 100)}%</Text>
                <Text numberOfLines={2} style={{ color: Colors.foreground, fontSize: 11 }}>{s.chunkText}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    )
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: Colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <StackHeader title="Ask a document" onBack={() => router.back()} />

        {loading ? (
          <Spinner label="Loading documents…" />
        ) : documents.length === 0 ? (
          <EmptyState
            icon={<Ionicons name="chatbubble-ellipses-outline" size={40} color={Colors.mutedForeground} />}
            title="Nothing to ask yet"
            subtitle="Upload and process a document first — questions will be answered from its content."
          />
        ) : (
          <>
            <Text style={{ color: Colors.mutedForeground, fontSize: 13, marginBottom: 6 }}>Document</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {documents.map((doc) => (
                <TouchableOpacity
                  key={doc.id}
                  onPress={() => setSelectedId(doc.id)}
                  style={{
                    borderWidth: 1,
                    borderColor: selectedId === doc.id ? Colors.primary : Colors.border,
                    backgroundColor: selectedId === doc.id ? Colors.primarySoft : Colors.muted,
                    borderRadius: 999,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                  }}
                >
                  <Text
                    style={{ color: selectedId === doc.id ? Colors.primary : Colors.mutedForeground, fontSize: 12, fontWeight: '600' }}
                    numberOfLines={1}
                  >
                    {doc.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(m) => String(m.id)}
              renderItem={renderMessage}
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 12 }}
              ListEmptyComponent={
                <Text style={{ color: Colors.mutedForeground, fontSize: 13, textAlign: 'center', marginTop: 24 }}>
                  Ask a question and the answer (with sources) will appear here.
                </Text>
              }
            />

            {asking && (
              <View style={{ alignSelf: 'flex-start', backgroundColor: Colors.muted, borderRadius: 16, borderBottomLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 6 }}>
                <TypingDots />
              </View>
            )}

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 8 }}>
              <TextInput
                value={question}
                onChangeText={setQuestion}
                placeholder="Ask a question…"
                placeholderTextColor={Colors.mutedForeground}
                style={{
                  flex: 1,
                  backgroundColor: Colors.muted,
                  borderWidth: 1,
                  borderColor: Colors.border,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  color: Colors.foreground,
                  fontSize: 15,
                }}
                returnKeyType="send"
                onSubmitEditing={ask}
              />
              <TouchableOpacity
                onPress={ask}
                disabled={asking}
                style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', opacity: asking || !question.trim() ? 0.5 : 1 }}
              >
                <Ionicons name="send" size={18} color={Colors.primaryForeground} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </Screen>
    </KeyboardAvoidingView>
  )
}
