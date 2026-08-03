import { useState } from 'react'
import { View, Text, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Screen, Field, Button, ErrorText } from '@/components/ui'
import { apiFetch } from '@/lib/api'
import { Colors } from '@/lib/theme'

export default function ForgotPasswordScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async () => {
    setError('')
    setLoading(true)
    try {
      await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      })
      setSent(true)
    } catch (err: any) {
      setError(err?.message || 'Failed to send reset email')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: Colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={{ flex: 1 }}>
        <Screen>
          <View style={{ flex: 1, justifyContent: 'center', maxWidth: 400, width: '100%', alignSelf: 'center' }}>
            <View style={{ alignItems: 'center', marginBottom: 24 }}>
              <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                <Text style={{ color: Colors.primaryForeground, fontSize: 22, fontWeight: '800' }}>AI</Text>
              </View>
              <Text style={{ color: Colors.foreground, fontSize: 24, fontWeight: '700' }}>Reset your password</Text>
              <Text style={{ color: Colors.mutedForeground, fontSize: 14, marginTop: 6, textAlign: 'center' }}>
                We&apos;ll email you a reset link
              </Text>
            </View>

            <ErrorText message={error} />

            {sent ? (
              <View style={{ backgroundColor: Colors.greenSoft, borderRadius: 12, padding: 16 }}>
                <Text style={{ color: Colors.green, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
                  If that email has an account, a reset link is on its way. Check your inbox.
                </Text>
              </View>
            ) : (
              <>
                <Field
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@company.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Button title="Send Reset Link" onPress={handleSubmit} loading={loading} />
              </>
            )}

            <Text
              onPress={() => router.back()}
              style={{ color: Colors.primary, fontSize: 14, fontWeight: '500', textAlign: 'center', marginTop: 20 }}
            >
              Back to sign in
            </Text>
          </View>
        </Screen>
      </SafeAreaView>
    </KeyboardAvoidingView>
  )
}
