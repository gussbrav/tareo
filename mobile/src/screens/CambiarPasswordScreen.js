/**
 * CambiarPasswordScreen — self-service de cambio de contraseña.
 * Paridad con AdminSeguridad de la web.
 *
 * Reglas de complejidad (mismas que la web):
 *   - Mínimo 8 caracteres
 *   - Al menos una mayúscula
 *   - Al menos un número
 * Y el backend valida current_password contra el hash real (bcrypt).
 */
import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { authApi } from '../api/auth'
import { colors, radius, shadow, spacing, type } from '../theme'
import Icon from '../ui/Icons'

const MIN_LEN = 8

function validate(pw) {
  if (pw.length < MIN_LEN) return `Mínimo ${MIN_LEN} caracteres.`
  if (!/[A-Z]/.test(pw)) return 'Debe incluir al menos una letra mayúscula.'
  if (!/[0-9]/.test(pw)) return 'Debe incluir al menos un número.'
  return null
}

export default function CambiarPasswordScreen({ navigation }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const complexity = useMemo(() => (next ? validate(next) : null), [next])
  const mismatch = confirm && next !== confirm
  const canSubmit = current && next && confirm && !complexity && !mismatch

  const submit = async () => {
    setError('')
    if (mismatch) {
      setError('La nueva contraseña y su confirmación no coinciden.')
      return
    }
    if (complexity) {
      setError(complexity)
      return
    }
    setSaving(true)
    try {
      await authApi.changePassword(current, next)
      Alert.alert(
        'Contraseña actualizada',
        'Tu contraseña se cambió correctamente.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      )
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo actualizar la contraseña')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Hero header */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Icon name="shield" size={26} color={colors.accent[700]} strokeWidth={1.75} />
          </View>
          <Text style={styles.heroTitle}>Cambiar contraseña</Text>
          <Text style={styles.heroHint}>
            Actualiza la contraseña de tu cuenta. Necesitas la actual para confirmar el cambio.
          </Text>
        </View>

        <View style={styles.card}>
          {/* Contraseña actual */}
          <View style={styles.field}>
            <Text style={styles.label}>Contraseña actual <Text style={styles.required}>*</Text></Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                value={current}
                onChangeText={setCurrent}
                secureTextEntry={!showCurrent}
                autoComplete="current-password"
                textContentType="password"
                placeholder="••••••••"
                placeholderTextColor={colors.text.muted}
              />
              <EyeToggle open={showCurrent} onToggle={() => setShowCurrent((v) => !v)} />
            </View>
          </View>

          {/* Nueva contraseña */}
          <View style={styles.field}>
            <Text style={styles.label}>Nueva contraseña <Text style={styles.required}>*</Text></Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                value={next}
                onChangeText={setNext}
                secureTextEntry={!showNext}
                autoComplete="new-password"
                textContentType="newPassword"
                placeholder="••••••••"
                placeholderTextColor={colors.text.muted}
              />
              <EyeToggle open={showNext} onToggle={() => setShowNext((v) => !v)} />
            </View>
            <Text style={[styles.helpHint, complexity && styles.helpHintErr]}>
              {complexity || `Al menos ${MIN_LEN} caracteres, con una mayúscula y un número.`}
            </Text>
          </View>

          {/* Confirmar nueva */}
          <View style={styles.field}>
            <Text style={styles.label}>Confirmar nueva contraseña <Text style={styles.required}>*</Text></Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry={!showConfirm}
                autoComplete="new-password"
                textContentType="newPassword"
                placeholder="••••••••"
                placeholderTextColor={colors.text.muted}
              />
              <EyeToggle open={showConfirm} onToggle={() => setShowConfirm((v) => !v)} />
            </View>
            {mismatch ? (
              <Text style={[styles.helpHint, styles.helpHintErr]}>
                Las contraseñas no coinciden.
              </Text>
            ) : null}
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={submit}
            disabled={!canSubmit || saving}
            style={[styles.submitBtn, (!canSubmit || saving) && styles.submitBtnDisabled]}
          >
            {saving ? (
              <ActivityIndicator color={colors.text.inverse} />
            ) : (
              <Text style={styles.submitBtnText}>Actualizar contraseña</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function EyeToggle({ open, onToggle }) {
  return (
    <Pressable onPress={onToggle} hitSlop={10} style={styles.eyeBtn}>
      <Text style={styles.eyeText}>{open ? 'Ocultar' : 'Mostrar'}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: spacing['4xl'] },

  hero: {
    alignItems: 'flex-start',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  heroIcon: {
    width: 48, height: 48, borderRadius: radius.pill,
    backgroundColor: colors.accent[50],
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  heroTitle: { ...type.h1, color: colors.text.primary },
  heroHint: { ...type.body, color: colors.text.tertiary, marginTop: 4, maxWidth: 360 },

  card: {
    marginHorizontal: spacing.base,
    marginTop: spacing.base,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.base,
    ...shadow.card,
  },

  field: { marginBottom: spacing.base },
  label: { ...type.label, color: colors.text.secondary, marginBottom: 6 },
  required: { color: colors.danger[500] },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    ...type.body, color: colors.text.primary,
    minHeight: 48,
  },
  eyeBtn: {
    paddingHorizontal: spacing.md, paddingVertical: 10,
    height: '100%', justifyContent: 'center',
  },
  eyeText: { ...type.caption, color: colors.brand[600], fontWeight: '700' },

  helpHint: { ...type.caption, color: colors.text.muted, marginTop: 6 },
  helpHintErr: { color: colors.warning[700] },

  errorBox: {
    backgroundColor: colors.danger[50],
    borderWidth: 1, borderColor: colors.danger[100],
    borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    marginBottom: spacing.base,
  },
  errorText: { ...type.body, color: colors.danger[700] },

  submitBtn: {
    backgroundColor: colors.brand[600],
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
    minHeight: 48,
  },
  submitBtnDisabled: { backgroundColor: colors.text.muted },
  submitBtnText: { ...type.bodyStrong, color: colors.text.inverse, fontSize: 15 },
})
