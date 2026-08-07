import { Stack, Redirect } from 'expo-router'
import { useAuth } from '@/lib/auth-context'
import { Colors } from '@/lib/theme'

export default function DashboardLayout() {
  const { isAuthenticated, isLoading } = useAuth()
  if (!isLoading && !isAuthenticated) {
    return <Redirect href="/(auth)/login" />
  }
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="analytics" />
      <Stack.Screen name="knowledge" />
      <Stack.Screen name="ask" />
      <Stack.Screen name="summary" />
      <Stack.Screen name="team" />
      <Stack.Screen name="guide" />
      <Stack.Screen name="settings" />
    </Stack>
  )
}
