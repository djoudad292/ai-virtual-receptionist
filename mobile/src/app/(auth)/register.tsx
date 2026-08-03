import { useState } from 'react'
import { View, Text, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native'
import { Link, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '@/lib/auth-context'
import { Screen, Field, Button, ErrorText } from '@/components/ui'
import { warmUpBackend } from '@/lib/api'
import { Colors } from '@/lib/theme'

export default function RegisterScreen() {
  const { register } = useAuth()
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')

  const handleSubmit = async () => {
    setError('')
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
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
      setStatus('Creating account…')
      await register(name.trim(), email.trim(), password, companyName.trim())
      router.replace('/(dashboard)/(tabs)')
    } catch (err: any) {
      setError(err?.message || 'Failed to create account')
    } finally {
      setLoading(false)
      setStatus('')
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: Colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={{ flex: 1 }}>
        <Screen scroll>
          <View style={{ flex: 1, justifyContent: 'center', maxWidth: 400, width: '100%', alignSelf: 'center' }}>
            <View style={{ alignItems: 'center', marginBottom: 24 }}>
              <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                <Text style={{ color: Colors.primaryForeground, fontSize: 22, fontWeight: '800' }}>AI</Text>
              </View>
              <Text style={{ color: Colors.foreground, fontSize: 24, fontWeight: '700' }}>Create your account</Text>
              <Text style={{ color: Colors.mutedForeground, fontSize: 14, marginTop: 6 }}>Get your AI receptionist running</Text>
            </View>

            <ErrorText message={error} />

            <Field label="Your name" value={name} onChangeText={setName} placeholder="Jane Doe" autoCapitalize="words" />
            <Field label="Company name" value={companyName} onChangeText={setCompanyName} placeholder="Acme Inc." autoCapitalize="words" />
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@company.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Field label="Password" value={password} onChangeText={setPassword} placeholder="At least 6 characters" secureTextEntry />

            <Button title="Create Account" onPress={handleSubmit} loading={loading} />
            {status ? (
              <Text style={{ color: Colors.mutedForeground, fontSize: 12, textAlign: 'center', marginTop: 10 }}>
                {status}
              </Text>
            ) : null}

            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 24 }}>
              <Text style={{ color: Colors.mutedForeground, fontSize: 14 }}>Already have an account? </Text>
              <Link href="/(auth)/login" asChild>
                <TouchableOpacity>
                  <Text style={{ color: Colors.primary, fontSize: 14, fontWeight: '600' }}>Sign in</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </Screen>
      </SafeAreaView>
    </KeyboardAvoidingView>
  )
}
