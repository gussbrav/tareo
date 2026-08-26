import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native'

import { colors, motion, radius, spacing, type } from '../theme'

/**
 * Chips horizontales scroll para elegir rango temporal.
 * Uso: <PeriodChips value={periodo} onChange={setPeriodo} />
 */
const OPTIONS = [
  { key: 'hoy',     label: 'Hoy' },
  { key: 'semana',  label: '7 días' },
  { key: 'mes',     label: '30 días' },
  { key: 'trimestre', label: 'Trimestre' },
  { key: 'anio',    label: 'Año' },
]

export default function PeriodChips({ value, onChange, options = OPTIONS }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {options.map((opt) => {
        const active = value === opt.key
        return (
          <TouchableOpacity
            key={opt.key}
            activeOpacity={motion.press.activeOpacity}
            onPress={() => onChange(opt.key)}
            style={[styles.chip, active && styles.chipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Rango ${opt.label}`}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  chip: {
    height: 36,
    minWidth: 64,
    paddingHorizontal: spacing.base,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: colors.brand[600],
    borderColor: colors.brand[600],
  },
  chipText: { ...type.label, color: colors.text.secondary },
  chipTextActive: { color: colors.text.inverse, fontWeight: '700' },
})
