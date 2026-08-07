import { useEffect, useState, useRef, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, RefreshControl, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams } from 'expo-router'
import { useAuth } from '@/lib/auth-context'
import { apiFetch, getSocketUrl, paginate, formatDate, formatTime } from '@/lib/api'
import { Screen, Spinner, EmptyState, Badge } from '@/components/ui'
import { Colors } from '@/lib/theme'
import { Ionicons } from '@expo/vector-icons'
import { io, Socket } from 'socket.io-client'

interface Conversation {
  id: string
  title: string
  status: string
  handledBy: string | null
  lastMessage?: string
  createdAt: string
  updatedAt: string
}

interface Source {
  chunkText: string
  similarity: number
  documentTitle?: string | null
}

interface Message {
  id: string
  content: string
  senderType: 'user' | 'ai' | 'agent' | 'system'
  senderId?: string
  createdAt: string
  metadata?: { sources?: Source[] }
}

const statusVariant: Record<string, 'green' | 'blue' | 'slate'> = {
  active: 'green',
  resolved: 'blue',
}

export default function InboxScreen() {
  const { token, user } = useAuth()
  const params = useLocalSearchParams<{ open?: string; ai?: string }>()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConv, setSelectedConv] = useState<string | null>(params.open || null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [socket, setSocket] = useState<Socket | null>(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [aiMode, setAiMode] = useState(false)
  const [aiSocket, setAiSocket] = useState<Socket | null>(null)
  const [aiThinking, setAiThinking] = useState(false)
  const [startingAi, setStartingAi] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const listRef = useRef<FlatList<Message>>(null)

  const loadConversations = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const data = await apiFetch('/conversations')
      setConversations(paginate<Conversation>(data).items)
    } catch (e: any) {
      setError(e?.message || 'Failed to load conversations')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  useEffect(() => {
    if (params.open) {
      setSelectedConv(params.open)
      setSearch('')
    }
  }, [params.open])

  useEffect(() => {
    if (!selectedConv) return
    setMessagesLoading(true)
    setError('')
    apiFetch(`/conversations/${selectedConv}/messages`)
      .then((data) => setMessages(Array.isArray(data) ? data : data.messages || []))
      .catch((e) => setError(e?.message || 'Failed to load messages'))
      .finally(() => setMessagesLoading(false))
  }, [selectedConv])

  useEffect(() => {
    const s = io(getSocketUrl(), {
      transports: ['websocket', 'polling'],
      timeout: 15000,
      auth: { token: token || '' },
    })
    s.on('connect', () => setSocket(s))
    s.on('newMessage', (msg: Message) => {
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
    })
    s.on('aiResponse', (data: { message: Message }) => {
      if (data?.message) {
        setMessages((prev) => (prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]))
      }
    })
    s.on('takeover', () => {
      setNotice('The AI has paused and a human agent is now handling this conversation.')
      setTimeout(() => setNotice(''), 4000)
    })
    return () => {
      s.disconnect()
    }
  }, [token])

  useEffect(() => {
    if (socket && selectedConv) {
      socket.emit('joinConversation', { conversationId: selectedConv })
    }
  }, [socket, selectedConv])

  useEffect(() => {
    if (!aiMode || !selectedConv || !user?.companyId) return
    const s = io(getSocketUrl(), {
      transports: ['websocket', 'polling'],
      timeout: 15000,
    })
    s.on('connect', () => {
      s.emit('joinConversation', { conversationId: selectedConv, companyId: user.companyId })
      setAiSocket(s)
    })
    s.on('newMessage', (msg: Message) => {
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
    })
    s.on('aiResponse', (data: { message: Message }) => {
      setAiThinking(false)
      if (data?.message) {
        setMessages((prev) => (prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]))
      }
    })
    s.on('aiThinking', (data: { isThinking: boolean }) => setAiThinking(Boolean(data?.isThinking)))
    return () => {
      s.disconnect()
      setAiSocket(null)
      setAiThinking(false)
    }
  }, [aiMode, selectedConv, user?.companyId])

  const scrollToEnd = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
  }, [])

  const startAiConversation = async () => {
    if (!user?.companyId) {
      setError('Missing company id')
      return
    }
    setStartingAi(true)
    setError('')
    try {
      const data = await apiFetch<{ id?: string; conversationId?: string }>('/conversations', {
        method: 'POST',
        body: JSON.stringify({ companyId: user.companyId }),
      })
      const id = data.id || data.conversationId
      if (!id) throw new Error('Could not create conversation')
      setAiMode(true)
      setSearch('')
      setSelectedConv(id)
      setMessages([
        {
          id: 'welcome',
          content: 'Welcome! Type a message to chat with your AI receptionist.',
          senderType: 'system',
          createdAt: new Date().toISOString(),
        },
      ])
      loadConversations()
    } catch (e: any) {
      setError(e?.message || 'Failed to start AI conversation')
    } finally {
      setStartingAi(false)
    }
  }

  const closeChat = () => {
    setSelectedConv(null)
    setAiMode(false)
  }

  const sendMessage = async () => {
    const content = input.trim()
    if (!content || !selectedConv) return
    setInput('')
    if (aiMode) {
      if (aiSocket && user?.companyId) {
        aiSocket.emit('sendMessage', { conversationId: selectedConv, content, companyId: user.companyId })
      } else {
        setError('AI chat is not connected yet — try again in a second.')
      }
      return
    }
    try {
      await apiFetch(`/conversations/${selectedConv}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content, senderType: 'agent' }),
      })
    } catch (e: any) {
      setError(e?.message || 'Failed to send message')
    }
  }

  const handleTakeover = async () => {
    if (!selectedConv) return
    setError('')
    try {
      await apiFetch(`/conversations/${selectedConv}/assign`, { method: 'PATCH' })
      setConversations((prev) => prev.map((c) => (c.id === selectedConv ? { ...c, handledBy: 'you' } : c)))
      setNotice('You have taken over this conversation. The AI is paused.')
      setTimeout(() => setNotice(''), 4000)
    } catch (e: any) {
      setError(e?.message || 'Failed to assign conversation')
    }
  }

  const handleResolve = async () => {
    if (!selectedConv) return
    setError('')
    try {
      await apiFetch(`/conversations/${selectedConv}/resolve`, { method: 'PATCH' })
      setConversations((prev) => prev.map((c) => (c.id === selectedConv ? { ...c, status: 'resolved' } : c)))
      setNotice('Conversation resolved.')
      setTimeout(() => setNotice(''), 4000)
    } catch (e: any) {
      setError(e?.message || 'Failed to resolve conversation')
    }
  }

  const handleSuggestReply = async () => {
    if (!selectedConv) return
    setSuggesting(true)
    setError('')
    try {
      const data = await apiFetch<{ reply?: string | null }>(`/conversations/${selectedConv}/suggest-reply`, { method: 'POST' })
      if (data?.reply) {
        setInput(data.reply)
        setNotice('Draft generated — review and send.')
      } else {
        setNotice('No relevant published documents to draft a reply.')
      }
      setTimeout(() => setNotice(''), 4000)
    } catch (e: any) {
      setError(e?.message || 'Failed to generate suggestion')
    } finally {
      setSuggesting(false)
    }
  }

  const selectedConvData = conversations.find((c) => c.id === selectedConv)
  const activeCount = conversations.filter((c) => c.status === 'active').length
  const filtered = conversations.filter(
    (c) =>
      (c.title || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.lastMessage || '').toLowerCase().includes(search.toLowerCase()),
  )

  if (selectedConv) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
          <View style={styles.chatHeader}>
            <TouchableOpacity onPress={closeChat} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="arrow-back" size={22} color={Colors.foreground} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{ color: Colors.foreground, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
                {aiMode ? 'AI Conversation' : selectedConvData?.title || 'Conversation'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={[styles.dot, { backgroundColor: Colors.primary }]} />
                <Text style={{ color: Colors.mutedForeground, fontSize: 12 }}>
                  {aiMode ? 'You are chatting with the AI' : `${selectedConvData?.status} · ${selectedConvData?.handledBy ? 'Agent' : 'AI'}`}
                </Text>
              </View>
            </View>
            {!aiMode && (
              <>
                <TouchableOpacity onPress={handleTakeover} style={styles.headerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="person-add-outline" size={18} color={Colors.foreground} />
                  <Text style={styles.headerBtnText}>Takeover</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleResolve} style={[styles.headerBtn, { borderColor: Colors.greenSoft }]} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="checkmark-circle-outline" size={18} color={Colors.green} />
                  <Text style={[styles.headerBtnText, { color: Colors.green }]}>Resolve</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {notice ? (
            <View style={styles.noticeBar}>
              <Ionicons name="information-circle-outline" size={16} color={Colors.blue} />
              <Text style={{ color: Colors.blue, fontSize: 12, flex: 1 }}>{notice}</Text>
            </View>
          ) : null}

          {messagesLoading ? (
            <Spinner label="Loading messages…" />
          ) : (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(m) => m.id}
              contentContainerStyle={{ padding: 16, gap: 10 }}
              onContentSizeChange={scrollToEnd}
              onLayout={scrollToEnd}
              ListEmptyComponent={
                <EmptyState icon={<Ionicons name="chatbubble-ellipses-outline" size={40} color={Colors.slate} />} title="No messages yet" subtitle="Send the first reply to get the conversation going." />
              }
              ListFooterComponent={
                aiThinking ? (
                  <View style={styles.typingRow}>
                    <View style={[styles.bubble, { backgroundColor: Colors.secondary }]}>
                      <Text style={{ color: Colors.mutedForeground, fontSize: 13 }}>AI is typing…</Text>
                    </View>
                  </View>
                ) : null
              }
              renderItem={({ item }) => {
                const isUser = item.senderType === 'user'
                const isAgent = item.senderType === 'agent'
                const isSystem = item.senderType === 'system'
                const bubbleColor = isUser ? Colors.primary : isAgent ? Colors.greenSoft : isSystem ? Colors.muted : Colors.secondary
                const textColor = isUser ? Colors.primaryForeground : Colors.foreground
                return (
                  <View style={{ alignItems: isUser ? 'flex-end' : 'flex-start' }}>
                    <View style={[styles.bubble, { backgroundColor: bubbleColor }]}>
                      {!isUser && (
                        <Text style={{ fontSize: 11, fontWeight: '700', marginBottom: 2, opacity: 0.7, color: textColor }}>
                          {isAgent ? 'Agent' : isSystem ? 'System' : 'AI'}
                        </Text>
                      )}
                      <Text style={{ color: textColor, fontSize: 14, lineHeight: 20 }}>{item.content}</Text>
                      {item.senderType === 'ai' && item.metadata?.sources?.length ? (
                        <View style={{ marginTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border, paddingTop: 4 }}>
                          <Text style={{ color: textColor, fontSize: 10, fontWeight: '700', opacity: 0.6 }}>Sources</Text>
                          {item.metadata.sources.slice(0, 3).map((src, i) => (
                            <Text key={i} style={{ color: textColor, fontSize: 10, opacity: 0.75, marginTop: 2 }}>
                              • {src.documentTitle || (src.chunkText || '').slice(0, 60)}
                            </Text>
                          ))}
                        </View>
                      ) : null}
                      <Text style={{ color: textColor, fontSize: 10, opacity: 0.55, marginTop: 4 }}>{formatTime(item.createdAt)}</Text>
                    </View>
                  </View>
                )
              }}
            />
          )}

          {error ? (
            <Text style={{ color: Colors.red, fontSize: 12, textAlign: 'center', paddingVertical: 6, backgroundColor: Colors.redSoft }}>{error}</Text>
          ) : null}

          <View style={styles.inputBar}>
            {!aiMode && (
              <TouchableOpacity onPress={handleSuggestReply} disabled={suggesting} style={styles.suggestBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                {suggesting ? <ActivityIndicator size="small" color={Colors.primary} /> : <Ionicons name="sparkles" size={18} color={Colors.primary} />}
              </TouchableOpacity>
            )}
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Type a reply..."
              placeholderTextColor={Colors.mutedForeground}
              style={styles.input}
              multiline
            />
            <TouchableOpacity onPress={sendMessage} disabled={!input.trim()} style={[styles.sendBtn, { opacity: input.trim() ? 1 : 0.4 }]}>
              <Ionicons name="send" size={18} color={Colors.primaryForeground} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    )
  }

  return (
    <Screen>
      <View style={{ paddingTop: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: Colors.foreground, fontSize: 22, fontWeight: '700', marginBottom: 4 }}>Inbox</Text>
            <Text style={{ color: Colors.mutedForeground, fontSize: 13 }}>
              Live conversations with your visitors
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {activeCount > 0 ? <Badge text={`${activeCount} active`} variant="green" /> : null}
            <TouchableOpacity onPress={startAiConversation} disabled={startingAi} style={styles.aiChatBtn}>
              <Ionicons name="sparkles" size={15} color={Colors.primaryForeground} />
              <Text style={styles.aiChatBtnText}>{startingAi ? 'Starting…' : 'AI Chat'}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search conversations..."
          placeholderTextColor={Colors.mutedForeground}
          style={styles.searchInput}
        />
      </View>

      {loading ? (
        <Spinner label="Loading conversations…" />
      ) : filtered.length === 0 ? (
        <View>
          <EmptyState
            icon={<Ionicons name="chatbubbles-outline" size={40} color={Colors.slate} />}
            title={search ? 'No matches' : 'No conversations'}
            subtitle={search ? 'Try a different search' : 'When a visitor uses the widget on your site, their conversation appears here.'}
          />
          {!search ? (
            <TouchableOpacity onPress={startAiConversation} disabled={startingAi} style={styles.startAiBtn}>
              <Ionicons name="sparkles" size={18} color={Colors.primaryForeground} />
              <Text style={styles.startAiBtnText}>{startingAi ? 'Starting…' : 'Start an AI conversation'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingBottom: 90, gap: 8 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadConversations(true)} tintColor={Colors.primary} />}
          renderItem={({ item }) => (
            <TouchableOpacity activeOpacity={0.8} onPress={() => setSelectedConv(item.id)} style={styles.convRow}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <Text style={{ color: Colors.foreground, fontSize: 14, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                    {item.title || 'Untitled Conversation'}
                  </Text>
                  <Badge text={item.status} variant={statusVariant[item.status] || 'slate'} />
                </View>
                {item.lastMessage ? (
                  <Text style={{ color: Colors.mutedForeground, fontSize: 12, marginTop: 3 }} numberOfLines={1}>
                    {item.lastMessage}
                  </Text>
                ) : null}
                <Text style={{ color: Colors.slate, fontSize: 11, marginTop: 3 }}>
                  {formatDate(item.updatedAt || item.createdAt)} · {formatTime(item.updatedAt || item.createdAt)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.mutedForeground} />
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity
        onPress={startAiConversation}
        disabled={startingAi}
        style={[styles.fab, { opacity: startingAi ? 0.6 : 1 }]}
        activeOpacity={0.85}
      >
        <Ionicons name="chatbubble-ellipses" size={26} color={Colors.primaryForeground} />
      </TouchableOpacity>
    </Screen>
  )
}

const styles = StyleSheet.create({
  searchInput: {
    backgroundColor: Colors.secondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    color: Colors.foreground,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  convRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
  },
  backBtn: { marginRight: 2 },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  headerBtnText: { color: Colors.foreground, fontSize: 11, fontWeight: '600' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  noticeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.blueSoft,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '80%',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    backgroundColor: Colors.card,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.secondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    color: Colors.foreground,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  aiChatBtnText: { color: Colors.primaryForeground, fontSize: 13, fontWeight: '700' },
  startAiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    marginHorizontal: 24,
    marginTop: 4,
  },
  startAiBtnText: { color: Colors.primaryForeground, fontSize: 15, fontWeight: '700' },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.foreground,
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 5,
  },
  typingRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8 },
})
