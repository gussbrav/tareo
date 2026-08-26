/**
 * DateField — input tipo botón que abre el date picker nativo de Android.
 * Muestra la fecha formateada en es-PE ("vie, 25 ago 2026"). El valor
 * externo es siempre YYYY-MM-DD para simplificar el flujo con el backend.
 */
import { useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'

import Icon from './Icons'
import { colors, radius, spacing, type } from '../theme'

const fmt = (iso) => {
  if (!iso) return ''
  try {
    const d = new Date(iso + 'T12:00:00')
    if (isNaN(d.getTime())) return iso
    const s = new Intl.DateTimeFormat('es-PE', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d)
    return s.replace(/\./g, '')
  } catch {
    return iso
  }
}

const toIso = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export default function DateField({
  label,
  value,
  onChange,
  placeholder = 'Selecciona fecha',
}) {
  const [open, setOpen] = useState(false)

  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        onPress={() => setOpen(true)}
        android_ripple={{ color: colors.border }}
        style={styles.field}
        accessibilityRole="button"
        accessibilityLabel={label || 'Fecha'}
      >
        <Icon name="calendar" size={20} color={colors.text.secondary} />
        <Text style={[styles.value, !value && styles.placeholder]}>
          {value ? fmt(value) : placeholder}
        </Text>
      </Pressable>

      {open && (
        <DateTimePicker
          value={value ? new Date(value + 'T12:00:00') : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(evt, d) => {
            setOpen(false)
            if (evt?.type === 'set' && d) onChange(toIso(d))
          }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  label: { ...type.label, color: colors.text.secondary, marginBottom: 6 },
  field: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  value: { ...type.body, fontWeight: '500', color: colors.text.primary, flex: 1 },
  placeholder: { color: colors.text.muted, fontWeight: '400' },
})
