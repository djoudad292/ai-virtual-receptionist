import { useState, useCallback } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Tabs, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '@/lib/theme'
import { Ionicons } from '@expo/vector-icons'
import { apiFetch, paginate } from '@/lib/api'

const icon: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  index: ['grid-outline', 'grid'],
  inbox: ['chatbubbles-outline', 'chatbubbles'],
  leads: ['people-outline', 'people'],
  appointments: ['calendar-outline', 'calendar'],
  more: ['ellipsis-horizontal-circle-outline', 'ellipsis-horizontal-circle'],
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets()
  const [activeCount, setActiveCount] = useState(0)

  useFocusEffect(
    useCallback(() => {
      let mounted = true
      apiFetch('/conversations')
        .then((data) => {
          if (!mounted) return
          setActiveCount(paginate<{ id: string; status: string }>(data).items.filter((c) => c.status === 'active').length)
        })
        .catch(() => {})
      return () => {
        mounted = false
      }
    }, []),
  )

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.mutedForeground,
        tabBarStyle: {
          backgroundColor: Colors.card,
          borderTopColor: Colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 58 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 6),
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      {(Object.keys(icon) as (keyof typeof icon)[]).map((name) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            tabBarIcon: ({ color, size, focused }) => (
              <View>
                <Ionicons name={icon[name][focused ? 1 : 0]} size={size} color={color} />
                {name === 'inbox' && activeCount > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{activeCount > 99 ? '99+' : activeCount}</Text>
                  </View>
                ) : null}
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  )
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: Colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
})
