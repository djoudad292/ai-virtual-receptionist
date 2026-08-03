import { useState } from 'react'
import { View, Text, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native'
import { Link, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '@/lib/auth-context'
import { Screen, Field, Button, ErrorText } from '@/components/ui'
import { warmUpBackend } from '@/lib/api'
import { Colors } from '@/lib/theme'

export default function LoginScreen() {
  const { login } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')

  const handleSubmit = async () => {
    setError('')
    setLoading(true)
    setStatus('Contacting server…')
    try {
      const reachable = await warmUpBackend(30, 2000, (a, m) => {
        setStatus(`Contacting server… (${a + 1}/${m})`)
      })
      if (!reachable) {
        setStatus('')
        setError('Cannot reach the server. Check your internet connection, then try again.')
        return
      }
      setStatus('Signing in…')
      await login(email.trim(), password)
      router.replace('/(dashboard)/(tabs)')
    } catch (err: any) {
      setError(err?.message || 'Failed to sign in')
    } finally {
      setLoading(false)
      setStatus('')
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: Colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={{ flex: 1 }}>
        <Screen>
          <View style={{ flex: 1, justifyContent: 'center', maxWidth: 400, width: '100%', alignSelf: 'center' }}>
            <View style={{ alignItems: 'center', marginBottom: 28 }}>
              <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                <Text style={{ color: Colors.primaryForeground, fontSize: 22, fontWeight: '800' }}>AI</Text>
              </View>
              <Text style={{ color: Colors.foreground, fontSize: 24, fontWeight: '700' }}>Welcome back</Text>
              <Text style={{ color: Colors.mutedForeground, fontSize: 14, marginTop: 6 }}>Sign in to your account</Text>
            </View>

            <ErrorText message={error} />

            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@company.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              secureTextEntry
            />

            <Button title="Sign In" onPress={handleSubmit} loading={loading} />
            {status ? (
              <Text style={{ color: Colors.mutedForeground, fontSize: 12, textAlign: 'center', marginTop: 10 }}>
                {status}
              </Text>
            ) : null}

            <TouchableOpacity style={{ marginTop: 14, alignItems: 'center' }} onPress={() => router.push('/(auth)/forgot-password')}>
              <Text style={{ color: Colors.primary, fontSize: 14, fontWeight: '500' }}>Forgot your password?</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 28 }}>
              <Text style={{ color: Colors.mutedForeground, fontSize: 14 }}>Don&apos;t have an account? </Text>
              <Link href="/(auth)/register" asChild>
                <TouchableOpacity>
                  <Text style={{ color: Colors.primary, fontSize: 14, fontWeight: '600' }}>Create one</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </Screen>
      </SafeAreaView>
    </KeyboardAvoidingView>
  )
}
