import { useState } from 'react'
import { View, Text, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Screen, Field, Button, ErrorText } from '@/components/ui'
import { apiFetch } from '@/lib/api'
import { Colors } from '@/lib/theme'

export default function ResetPasswordScreen() {
  const router = useRouter()
  const { token } = useLocalSearchParams<{ token?: string }>()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async () => {
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token: token || '', newPassword: password }),
      })
      setDone(true)
      setTimeout(() => router.replace('/(auth)/login'), 1800)
    } catch (err: any) {
      setError(err?.message || 'Failed to reset password')
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
              <Text style={{ color: Colors.foreground, fontSize: 24, fontWeight: '700' }}>Set a new password</Text>
              <Text style={{ color: Colors.mutedForeground, fontSize: 14, marginTop: 6 }}>Choose a strong password</Text>
            </View>

            <ErrorText message={error} />

            {done ? (
              <View style={{ backgroundColor: Colors.greenSoft, borderRadius: 12, padding: 16 }}>
                <Text style={{ color: Colors.green, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
                  Password updated. Taking you to sign in…
                </Text>
              </View>
            ) : !token ? (
              <View style={{ backgroundColor: Colors.redSoft, borderRadius: 12, padding: 16 }}>
                <Text style={{ color: Colors.red, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
                  This password reset link is missing or invalid.
                </Text>
              </View>
            ) : (
              <>
                <Field label="New Password" value={password} onChangeText={setPassword} placeholder="At least 8 characters" secureTextEntry />
                <Field label="Confirm Password" value={confirm} onChangeText={setConfirm} placeholder="Repeat your password" secureTextEntry />
                <Button title="Reset Password" onPress={handleSubmit} loading={loading} />
              </>
            )}

            <Text
              onPress={() => router.replace('/(auth)/login')}
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
