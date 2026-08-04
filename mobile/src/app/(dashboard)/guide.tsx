import { View, Text, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen, Card, Button } from '@/components/ui'
import { StackHeader } from '@/components/stack-header'
import { Colors } from '@/lib/theme'
import { Ionicons } from '@expo/vector-icons'

const sections: { title: string; icon: keyof typeof Ionicons.glyphMap; color: string; steps: string[] }[] = [
  {
    title: 'Getting Started',
    icon: 'rocket-outline',
    color: Colors.green,
    steps: [
      'Create your account (or sign in). Sales, Support and Billing departments are created for you automatically.',
      'Add knowledge base documents so the AI has real facts about your business to answer from.',
      'Copy the widget embed code from Settings and paste it into your website.',
      'Open the chat on your site and send a message to test the AI.',
    ],
  },
  {
    title: 'Inbox',
    icon: 'chatbubbles-outline',
    color: Colors.blue,
    steps: [
      'All conversations with your visitors appear here in real time.',
      'Tap a conversation to read the full history and reply live.',
      'Tap the take-over button to pause the AI and chat with the visitor yourself.',
      'Use resolve to mark a conversation as finished.',
    ],
  },
  {
    title: 'Knowledge Base',
    icon: 'document-text-outline',
    color: Colors.purple,
    steps: [
      "This is the AI's memory. Add documents about your products, prices, hours and policies.",
      'Each document is automatically split into chunks, embedded, and stored in a vector database.',
      'When a visitor asks a question, the AI retrieves the most relevant chunks and answers with citations.',
      'Use re-index after editing a document so the AI picks up the changes.',
    ],
  },
  {
    title: 'Leads',
    icon: 'people-outline',
    color: Colors.orange,
    steps: [
      'When a visitor shares their name, email or phone in chat, the AI saves it as a lead.',
      'Review captured contacts and change their status.',
      'Export or follow up with leads however you like.',
    ],
  },
  {
    title: 'Appointments',
    icon: 'calendar-outline',
    color: Colors.yellow,
    steps: [
      'Visitors can book meetings directly in chat, e.g. "book me tomorrow at 14:00".',
      'The AI parses relative dates and times and saves the appointment.',
      'Review all bookings here and update their status.',
    ],
  },
  {
    title: 'Analytics',
    icon: 'stats-chart-outline',
    color: Colors.cyan,
    steps: [
      'See how your receptionist is performing: total conversations, active chats, unresolved threads.',
      'Track how many conversations were handled by the AI vs by a human.',
      'Monitor leads captured and appointments booked over time.',
    ],
  },
  {
    title: 'Settings',
    icon: 'settings-outline',
    color: Colors.slate,
    steps: [
      'Departments: manage the teams the AI routes conversations to.',
      'Widget embed code: the one-line script to add the chat widget to your website.',
      'Customize the widget title, color and position.',
    ],
  },
  {
    title: 'Tips for better answers',
    icon: 'bulb-outline',
    color: Colors.red,
    steps: [
      'Write clear, complete knowledge base content. The AI can only answer what it knows.',
      'Include prices, hours, contact info and common questions in your documents.',
      'Keep documents focused on one topic each for better retrieval.',
      'Test questions yourself in the widget before launching it to visitors.',
      'Watch the Inbox and take over conversations whenever a human touch is needed.',
    ],
  },
]

export default function GuideScreen() {
  const router = useRouter()
  return (
    <Screen scroll>
      <StackHeader title="Guide" onBack={() => router.back()} />

      <Card>
        <Text style={{ color: Colors.foreground, fontSize: 17, fontWeight: '700' }}>How to use your AI Receptionist</Text>
        <Text style={{ color: Colors.mutedForeground, fontSize: 13, marginTop: 8, lineHeight: 20 }}>
          This platform puts an AI receptionist on your website. It answers visitor questions from your
          knowledge base, captures leads, books appointments and routes conversations to departments.
          Everything the AI does lands in this dashboard, where you can review it and take over any time.
        </Text>
      </Card>

      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <View style={[styles.iconBox, { backgroundColor: `${section.color}22` }]}>
              <Ionicons name={section.icon} size={18} color={section.color} />
            </View>
            <Text style={{ color: Colors.foreground, fontSize: 15, fontWeight: '700', flex: 1 }}>{section.title}</Text>
          </View>
          {section.steps.map((step, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
              <View style={styles.bullet}>
                <Text style={{ color: section.color, fontSize: 11, fontWeight: '800' }}>{i + 1}</Text>
              </View>
              <Text style={{ color: Colors.mutedForeground, fontSize: 13, lineHeight: 19, flex: 1 }}>{step}</Text>
            </View>
          ))}
        </View>
      ))}

      <Card style={{ alignItems: 'stretch' }}>
        <Text style={{ color: Colors.foreground, fontSize: 16, fontWeight: '700', textAlign: 'center' }}>Ready to set it up?</Text>
        <Text style={{ color: Colors.mutedForeground, fontSize: 13, textAlign: 'center', marginTop: 6, marginBottom: 16, lineHeight: 19 }}>
          Add documents to the knowledge base and grab the embed code for your website.
        </Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Button title="Add Documents" onPress={() => router.push('/(dashboard)/knowledge')} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Get Embed Code" onPress={() => router.push('/(dashboard)/settings')} variant="outline" />
          </View>
        </View>
      </Card>
    </Screen>
  )
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  iconBox: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  bullet: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
})
