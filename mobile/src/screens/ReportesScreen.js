/**
 * ReportesScreen — resumen de top trabajadores + top centros de costo.
 * Reutiliza /api/reportes/dashboard. Complementa el Home con detalle.
 */
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import PeriodChips from '../ui/PeriodChips'
import SectionTitle from '../ui/SectionTitle'
import { reportesApi } from '../api/reportes'
import { colors, radius, shadow, spacing, type } from '../theme'

const isoDate = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function rangeFromPeriodo(p, now = new Date()) {
  const hoy = new Date(now)
  const start = new Date(now)
  if (p === 'hoy') return { desde: isoDate(hoy), hasta: isoDate(hoy) }
  const offsetDays = { semana: 6, mes: 29, trimestre: 89, anio: 364 }[p] ?? 29
  start.setDate(hoy.getDate() - offsetDays)
  return { desde: isoDate(start), hasta: isoDate(hoy) }
}

const fmtHoras = (h) => (h != null ? h.toFixed(1) : '—')

export default function ReportesScreen() {
  const [periodo, setPeriodo] = useState('mes')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    const { desde, hasta } = rangeFromPeriodo(periodo)
    try {
      const d = await reportesApi.dashboard(desde, hasta)
      setData(d)
    } catch {
      setError('No se pudo cargar')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [periodo])

  useEffect(() => { setLoading(true); load() }, [load])

  const top = data?.top_trabajadores || []
  const cc  = data?.por_centro_costo || []
  const maxHorasTop = top[0]?.horas || 1
  const maxHorasCc  = cc[0]?.horas || 1

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.subtitle}>Ranking de horas trabajadas</Text>
      </View>

      <PeriodChips value={periodo} onChange={setPeriodo} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing['4xl'] }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load() }}
            tintColor={colors.brand[600]}
            colors={[colors.brand[600]]}
          />
        }
      >
        {loading ? (
          <View style={styles.loading}><ActivityIndicator color={colors.brand[600]} /></View>
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <>
            <SectionTitle>Top trabajadores</SectionTitle>
            <View style={styles.card}>
              {top.length === 0 ? (
                <Text style={styles.empty}>Sin datos en este período</Text>
              ) : top.map((t, i) => (
                <BarRow
                  key={t.trabajador + i}
                  label={t.trabajador}
                  sub={t.categoria}
                  value={t.horas}
                  suffix="h"
                  max={maxHorasTop}
                  color={colors.brand[500]}
                />
              ))}
            </View>

            <SectionTitle>Top centros de costo</SectionTitle>
            <View style={styles.card}>
              {cc.length === 0 ? (
                <Text style={styles.empty}>Sin datos en este período</Text>
              ) : cc.map((c, i) => (
                <BarRow
                  key={c.centro_costo + i}
                  label={c.centro_costo}
                  sub={c.codigo}
                  value={c.horas}
                  suffix="h"
                  max={maxHorasCc}
                  color={colors.info[500]}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function BarRow({ label, sub, value, suffix, max, color }) {
  const pct = max > 0 ? Math.max(0.02, Math.min(1, value / max)) : 0
  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <View style={styles.rowLabelCol}>
          <Text style={styles.rowLabel} numberOfLines={1}>{label}</Text>
          {sub ? <Text style={styles.rowSub} numberOfLines={1}>{sub}</Text> : null}
        </View>
        <Text style={styles.rowValue}>{fmtHoras(value)}{suffix ? ` ${suffix}` : ''}</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.base,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { ...type.h1, color: colors.text.primary },
  subtitle: { ...type.caption, color: colors.text.tertiary, marginTop: 2 },
  loading: { paddingVertical: spacing['3xl'], alignItems: 'center' },
  error: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.danger[50],
    color: colors.danger[700],
    ...type.body,
  },
  empty: { ...type.body, color: colors.text.tertiary, textAlign: 'center', paddingVertical: spacing.xl },
  card: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.base,
    ...shadow.card,
  },
  row: { paddingVertical: spacing.md },
  rowTop: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 6 },
  rowLabelCol: { flex: 1, marginRight: spacing.md },
  rowLabel: { ...type.bodyStrong, color: colors.text.primary },
  rowSub: { ...type.caption, color: colors.text.tertiary, marginTop: 1 },
  rowValue: { ...type.kpiDelta, fontSize: 15, color: colors.text.primary },
  barTrack: {
    height: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceSubtle, overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: radius.pill },
})
