import { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { api } from '../api/client'
import { useAuthStore } from '../store/auth'
import { colors } from '../theme'

export default function LoginScreen() {
  const setTokens = useAuthStore((s) => s.setTokens)
  const [email, setEmail] = useState('admin@azoramind.com')
  const [password, setPassword] = useState('admin123')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/api/auth/login', { email: email.trim(), password })
      await setTokens(data.access_token, data.refresh_token, data.user)
    } catch (e) {
      setError(e.response?.data?.detail || 'No se pudo iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.brand}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>T</Text>
          </View>
          <Text style={styles.title}>Tareo</Text>
          <Text style={styles.subtitle}>Control de actividades · Azoramind</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Correo</Text>
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
            placeholder="tu@correo.com"
            placeholderTextColor={colors.slate[400]}
          />

          <Text style={[styles.label, { marginTop: 12 }]}>Contraseña</Text>
          <TextInput
            style={styles.input}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.slate[400]}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={[styles.btn, loading && { opacity: 0.6 }]} onPress={submit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Iniciar sesión</Text>}
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>© {new Date().getFullYear()} Azoramind</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.slate[50] },
  wrap: { flex: 1, justifyContent: 'center', padding: 20 },
  brand: { alignItems: 'center', marginBottom: 28 },
  logo: {
    width: 60, height: 60, borderRadius: 14, backgroundColor: colors.brand[600],
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 5,
  },
  logoText: { color: '#fff', fontSize: 30, fontWeight: '700' },
  title: { fontSize: 26, fontWeight: '700', color: colors.slate[900], marginTop: 10 },
  subtitle: { fontSize: 13, color: colors.slate[500], marginTop: 2 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  label: { fontSize: 13, color: colors.slate[700], fontWeight: '600', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: colors.slate[200], borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: colors.slate[900], backgroundColor: '#fff',
  },
  btn: {
    marginTop: 18, backgroundColor: colors.brand[600], borderRadius: 10,
    paddingVertical: 14, alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  error: {
    marginTop: 12, backgroundColor: colors.red[100], color: colors.red[700],
    padding: 10, borderRadius: 8, fontSize: 13,
  },
  footer: { textAlign: 'center', color: colors.slate[400], fontSize: 12, marginTop: 24 },
})
