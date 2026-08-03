import { Redirect } from 'expo-router'
import { useAuth } from '@/lib/auth-context'
import { View, ActivityIndicator } from 'react-native'
import { Colors } from '@/lib/theme'

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }
  return <Redirect href={isAuthenticated ? '/(dashboard)/(tabs)' : '/(auth)/login'} />
}
