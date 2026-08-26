/**
 * HomeScreen — pantalla de inicio "clase mundial".
 * Saludo + rol + chips de rango + banner alertas + grid 2x2 KPIs +
 * comparación vs período anterior. Consume /api/reportes/dashboard.
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

import AlertBanner from '../ui/AlertBanner'
import KpiCard from '../ui/KpiCard'
import PeriodChips from '../ui/PeriodChips'
import SectionTitle from '../ui/SectionTitle'
import WelcomeHeader from '../ui/WelcomeHeader'
import { configApi } from '../api/config'
import { reportesApi } from '../api/reportes'
import { useAuthStore } from '../store/auth'
import { colors, spacing, type } from '../theme'

// ── helpers ────────────────────────────────────────────────────────────────
const isoDate = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function rangeFromPeriodo(p, now = new Date()) {
  const hoy = new Date(now)
  const start = new Date(now)
  if (p === 'hoy') {
    return { desde: isoDate(hoy), hasta: isoDate(hoy) }
  }
  if (p === 'semana') {
    start.setDate(hoy.getDate() - 6)
    return { desde: isoDate(start), hasta: isoDate(hoy) }
  }
  if (p === 'mes') {
    start.setDate(hoy.getDate() - 29)
    return { desde: isoDate(start), hasta: isoDate(hoy) }
  }
  if (p === 'trimestre') {
    start.setDate(hoy.getDate() - 89)
    return { desde: isoDate(start), hasta: isoDate(hoy) }
  }
  if (p === 'anio') {
    start.setDate(hoy.getDate() - 364)
    return { desde: isoDate(start), hasta: isoDate(hoy) }
  }
  return { desde: isoDate(hoy), hasta: isoDate(hoy) }
}

function pctDelta(cur, prev) {
  if (!prev || prev === 0) return null
  return ((cur - prev) / prev) * 100
}

function fmtNumber(n) {
  if (n === null || n === undefined) return '—'
  return new Intl.NumberFormat('es-PE').format(Math.round(n))
}

function fmtHM(minutos) {
  if (!minutos) return '0'
  return fmtNumber(minutos / 60)
}

const RANGO_LABEL_LARGO = (desde, hasta) => {
  try {
    const d = new Date(desde)
    const h = new Date(hasta)
    const fmt = (x) =>
      x.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })
    return desde === hasta ? fmt(d) : `${fmt(d)} — ${fmt(h)}`
  } catch {
    return `${desde} — ${hasta}`
  }
}

// ── screen ────────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const user = useAuthStore((s) => s.user)
  const [periodo, setPeriodo] = useState('semana')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [dashboard, setDashboard] = useState(null)
  const [brand, setBrand] = useState({ company_name: 'Azoramind', logo_url: '' })
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    const { desde, hasta } = rangeFromPeriodo(periodo)
    try {
      const data = await reportesApi.dashboard(desde, hasta)
      setDashboard(data)
    } catch (e) {
      setError('No se pudo cargar el dashboard')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [periodo])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  useEffect(() => {
    configApi.publicSettings().then((b) => setBrand(b || {})).catch(() => {})
  }, [])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    load()
  }, [load])

  const kpis = dashboard?.kpis || {}
  const prev = dashboard?.kpis_prev || {}
  const rango = dashboard?.rango || {}
  const alertas = dashboard?.alertas || []

  const horasTotales   = kpis.minutos_totales != null ? kpis.minutos_totales / 60 : null
  const horasPrev      = prev.minutos_totales != null ? prev.minutos_totales / 60 : null
  const deltaHoras     = pctDelta(horasTotales, horasPrev)
  const deltaFinaliz   = pctDelta(kpis.finalizadas, prev.finalizadas)
  const deltaActivos   = pctDelta(kpis.trabajadores_activos, prev.trabajadores_activos)
  const deltaTasa      = pctDelta(kpis.tasa_finalizacion, prev.tasa_finalizacion)

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand[600]}
            colors={[colors.brand[600]]}
          />
        }
      >
        <WelcomeHeader
          name={user?.first_name || user?.email?.split('@')[0]}
          role={user?.role || 'trabajador'}
          logoUrl={brand.logo_url}
        />

        <PeriodChips value={periodo} onChange={setPeriodo} />

        <View style={styles.rangeRow}>
          <Text style={styles.rangeText}>
            {rango.desde && rango.hasta ? RANGO_LABEL_LARGO(rango.desde, rango.hasta) : ' '}
          </Text>
        </View>

        {alertas.length > 0 && (
          <View style={styles.alertWrap}>
            <AlertBanner
              variant="danger"
              title={`${alertas.length} actividades sin finalizar +${alertas[0].dias_pendiente}d`}
              items={alertas.map((a) => ({
                label: a.trabajador,
                meta: `${a.dias_pendiente}d`,
              }))}
              onPress={() => navigation.navigate('TareoStack', { screen: 'Tareo' })}
            />
          </View>
        )}

        <SectionTitle>Resumen general</SectionTitle>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.brand[600]} />
          </View>
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <View style={styles.grid}>
            <View style={styles.gridRow}>
              <KpiCard
                label="Horas trabajadas"
                value={fmtHM(kpis.minutos_totales)}
                unit="h"
                delta={deltaHoras}
                accent="brand"
              />
              <KpiCard
                label="Actividades OK"
                value={fmtNumber(kpis.finalizadas)}
                delta={deltaFinaliz}
                accent="success"
              />
            </View>
            <View style={styles.gridRow}>
              <KpiCard
                label="Trabajadores"
                value={fmtNumber(kpis.trabajadores_activos)}
                delta={deltaActivos}
                accent="info"
              />
              <KpiCard
                label="Tasa finalización"
                value={
                  kpis.tasa_finalizacion != null
                    ? kpis.tasa_finalizacion.toFixed(1)
                    : '—'
                }
                unit="%"
                delta={deltaTasa}
                accent="accent"
              />
            </View>
          </View>
        )}

        {!loading && !error && (
          <View style={styles.footerCard}>
            <Text style={styles.footerLabel}>Promedio del período</Text>
            <Text style={styles.footerValue}>
              {kpis.horas_por_dia_promedio != null
                ? `${kpis.horas_por_dia_promedio.toFixed(1)} h/día`
                : '—'}
              <Text style={styles.footerSub}>
                {kpis.dias_con_actividad ? `  ·  ${kpis.dias_con_actividad} días con actividad` : ''}
              </Text>
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: spacing['4xl'] },
  rangeRow: { paddingHorizontal: spacing.lg, marginTop: -spacing.xs, marginBottom: spacing.xs },
  rangeText: { ...type.caption, color: colors.text.tertiary },
  alertWrap: { marginTop: spacing.md },
  loadingWrap: { paddingVertical: spacing['3xl'], alignItems: 'center' },
  error: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.danger[50],
    color: colors.danger[700],
    ...type.body,
  },
  grid: { paddingHorizontal: spacing.lg, gap: spacing.md },
  gridRow: { flexDirection: 'row', gap: spacing.md },
  footerCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.base,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  footerLabel: { ...type.overline, color: colors.text.tertiary, marginBottom: 4 },
  footerValue: { ...type.h2, color: colors.text.primary },
  footerSub: { ...type.body, color: colors.text.tertiary, fontWeight: '400' },
})
