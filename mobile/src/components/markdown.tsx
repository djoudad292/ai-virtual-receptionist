import Markdown from 'react-native-markdown-display'
import { Colors } from '@/lib/theme'

export const markdownStyles = {
  body: { color: Colors.foreground, fontSize: 14, lineHeight: 22 },
  paragraph: { marginBottom: 8 },
  heading1: { color: Colors.foreground, fontSize: 18, fontWeight: '700', marginTop: 12, marginBottom: 6 },
  heading2: { color: Colors.foreground, fontSize: 16, fontWeight: '700', marginTop: 12, marginBottom: 6 },
  heading3: { color: Colors.foreground, fontSize: 15, fontWeight: '700', marginTop: 10, marginBottom: 6 },
  strong: { color: Colors.foreground, fontWeight: '700' },
  em: { fontStyle: 'italic' },
  s: { textDecorationLine: 'line-through' },
  bullet_list: { marginBottom: 8 },
  bullet_list_icon: { color: Colors.primary },
  ordered_list: { marginBottom: 8 },
  list_item: { marginBottom: 4 },
  hr: { backgroundColor: Colors.border, height: 1, marginVertical: 10 },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
    paddingLeft: 10,
    marginBottom: 8,
    fontStyle: 'italic',
    color: Colors.mutedForeground,
  },
  code_inline: { backgroundColor: Colors.secondary, borderRadius: 4, fontFamily: 'monospace', fontSize: 12, color: Colors.primary },
  fence: { backgroundColor: Colors.secondary, borderRadius: 8, padding: 10, fontFamily: 'monospace', fontSize: 12, color: Colors.foreground },
  table: { marginBottom: 8 },
  th: { borderBottomWidth: 1, borderBottomColor: Colors.border, padding: 4 },
  td: { padding: 4 },
} as const

export function MarkdownText({ children }: { children: string }) {
  return <Markdown style={markdownStyles as any}>{children}</Markdown>
}
