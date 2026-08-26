import { StyleSheet, Text, View } from 'react-native'

import { colors, radius, shadow, spacing, type } from '../theme'

/**
 * KPI card — número grande, label pequeño, delta opcional con flecha.
 * Delta positivo verde (subida buena), negativo rojo. Si el KPI es
 * "inverso" (subir es malo, ej. sobretiempo), pasar `invertDelta`.
 */
export default function KpiCard({
  label,
  value,
  unit,
  delta,          // porcentaje numérico o null
  invertDelta,    // bool — si true, delta+ es malo (rojo)
  accent = 'brand', // brand | success | warning | danger | info
  loading = false,
}) {
  const accentPalette = colors[accent] || colors.brand
  const displayValue = value === null || value === undefined ? '—' : value
  const hasDelta = typeof delta === 'number' && !Number.isNaN(delta)

  let deltaColor = colors.text.tertiary
  let deltaBg = colors.surfaceSubtle
  let arrow = '→'
  if (hasDelta && delta !== 0) {
    const positive = delta > 0
    const good = invertDelta ? !positive : positive
    if (good) {
      deltaColor = colors.success[700]
      deltaBg = colors.success[100]
      arrow = '↑'
    } else {
      deltaColor = colors.danger[700]
      deltaBg = colors.danger[100]
      arrow = '↓'
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.label} numberOfLines={1}>{label}</Text>
        <View style={[styles.accentDot, { backgroundColor: accentPalette[500] || accentPalette[600] }]} />
      </View>
      {loading ? (
        <View style={styles.skeleton} />
      ) : (
        <View style={styles.valueRow}>
          <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
            {displayValue}
          </Text>
          {unit ? <Text style={styles.unit}>{unit}</Text> : null}
        </View>
      )}
      {hasDelta && !loading && (
        <View style={[styles.deltaPill, { backgroundColor: deltaBg }]}>
          <Text style={[styles.deltaText, { color: deltaColor }]}>
            {arrow} {Math.abs(delta).toFixed(1)}%
          </Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.base,
    minHeight: 118,
    justifyContent: 'space-between',
    ...shadow.card,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  label: { ...type.overline, color: colors.text.tertiary, flex: 1 },
  accentDot: { width: 8, height: 8, borderRadius: radius.pill, marginLeft: spacing.sm },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  value: { ...type.kpiNumber, color: colors.text.primary },
  unit: { ...type.label, color: colors.text.tertiary },
  deltaPill: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  deltaText: { ...type.kpiDelta },
  skeleton: {
    height: 30,
    width: '55%',
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSubtle,
    marginVertical: spacing.xs,
  },
})
