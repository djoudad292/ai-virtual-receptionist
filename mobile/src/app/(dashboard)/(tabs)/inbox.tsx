import { useEffect, useState, useRef, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { useAuth } from '@/lib/auth-context'
import { apiFetch, getSocketUrl, paginate, formatTime } from '@/lib/api'
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

interface Message {
  id: string
  content: string
  senderType: 'user' | 'ai' | 'agent' | 'system'
  senderId?: string
  createdAt: string
}

export default function InboxScreen() {
  const { token } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConv, setSelectedConv] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [socket, setSocket] = useState<Socket | null>(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const listRef = useRef<FlatList<Message>>(null)

  useEffect(() => {
    apiFetch('/conversations')
      .then((data) => setConversations(paginate<Conversation>(data).items))
      .catch((e) => setError(e?.message || 'Failed to load conversations'))
      .finally(() => setLoading(false))
  }, [])

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
    return () => {
      s.disconnect()
    }
  }, [token])

  useEffect(() => {
    if (socket && selectedConv) {
      socket.emit('joinConversation', { conversationId: selectedConv })
    }
  }, [socket, selectedConv])

  const scrollToEnd = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
  }, [])

  const sendMessage = async () => {
    const content = input.trim()
    if (!content || !selectedConv) return
    setInput('')
    try {
      await apiFetch(`/conversations/${selectedConv}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      })
    } catch (e: any) {
      setError(e?.message || 'Failed to send message')
    }
  }

  const handleTakeover = async () => {
    if (!selectedConv) return
    try {
      await apiFetch(`/conversations/${selectedConv}/assign`, { method: 'PATCH' })
      setConversations((prev) => prev.map((c) => (c.id === selectedConv ? { ...c, handledBy: 'you' } : c)))
    } catch (e: any) {
      setError(e?.message || 'Failed to assign conversation')
    }
  }

  const handleResolve = async () => {
    if (!selectedConv) return
    try {
      await apiFetch(`/conversations/${selectedConv}/resolve`, { method: 'PATCH' })
      setConversations((prev) => prev.map((c) => (c.id === selectedConv ? { ...c, status: 'resolved' } : c)))
    } catch (e: any) {
      setError(e?.message || 'Failed to resolve conversation')
    }
  }

  const selectedConvData = conversations.find((c) => c.id === selectedConv)
  const filtered = conversations.filter(
    (c) =>
      (c.title || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.lastMessage || '').toLowerCase().includes(search.toLowerCase()),
  )

  if (selectedConv) {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: Colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <View style={{ flex: 1 }}>
          <View style={styles.chatHeader}>
            <TouchableOpacity onPress={() => setSelectedConv(null)} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="arrow-back" size={22} color={Colors.foreground} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{ color: Colors.foreground, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
                {selectedConvData?.title || 'Conversation'}
              </Text>
              <Text style={{ color: Colors.mutedForeground, fontSize: 12 }}>
                Handled by: {selectedConvData?.handledBy || 'AI'}
              </Text>
            </View>
            <TouchableOpacity onPress={handleTakeover} style={styles.headerAction} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="person-add-outline" size={18} color={Colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleResolve} style={styles.headerAction} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="checkmark-circle-outline" size={19} color={Colors.green} />
            </TouchableOpacity>
          </View>

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
        </View>
      </KeyboardAvoidingView>
    )
  }

  return (
    <Screen>
      <View style={{ paddingTop: 12 }}>
        <Text style={{ color: Colors.foreground, fontSize: 22, fontWeight: '700', marginBottom: 4 }}>Inbox</Text>
        <Text style={{ color: Colors.mutedForeground, fontSize: 13, marginBottom: 12 }}>
          Live conversations with your visitors
        </Text>
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
        <EmptyState
          icon={<Ionicons name="chatbubbles-outline" size={40} color={Colors.slate} />}
          title={search ? 'No matches' : 'No conversations'}
          subtitle={search ? 'Try a different search' : 'When a visitor uses the widget on your site, their conversation appears here.'}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingBottom: 20, gap: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity activeOpacity={0.8} onPress={() => setSelectedConv(item.id)} style={styles.convRow}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <Text style={{ color: Colors.foreground, fontSize: 14, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                    {item.title || 'Untitled Conversation'}
                  </Text>
                  <Badge text={item.status} variant={item.status === 'active' ? 'green' : item.status === 'resolved' ? 'blue' : 'slate'} />
                </View>
                {item.lastMessage ? (
                  <Text style={{ color: Colors.mutedForeground, fontSize: 12, marginTop: 3 }} numberOfLines={1}>
                    {item.lastMessage}
                  </Text>
                ) : null}
                <Text style={{ color: Colors.slate, fontSize: 11, marginTop: 3 }}>{formatTime(item.updatedAt || item.createdAt)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.mutedForeground} />
            </TouchableOpacity>
          )}
        />
      )}
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
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
  },
  backBtn: { marginRight: 2 },
  headerAction: { marginLeft: 6, padding: 4 },
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
    borderTopWidth: 1,
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
})
