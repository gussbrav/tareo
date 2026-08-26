/**
 * AgendaScreen — vista agenda diaria.
 * Header con strip de 7 días (tap para saltar) + navegación semana + Hoy.
 * Debajo: lista de actividades del día seleccionado.
 *
 * Trabajador ve solo sus actividades; admin/supervisor ven todas.
 * Refresh al focus + polling 20s + pull-to-refresh (paridad CRM Palma).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { actividadesApi } from '../api/actividades'
import { useAuthStore } from '../store/auth'
import { colors, radius, shadow, spacing, type } from '../theme'
import Icon from '../ui/Icons'

const DIAS_CORTOS = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

const isoLocal = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}
const todayIso = () => isoLocal(new Date())
const fmtHM = (t) => (t ? String(t).slice(0, 5) : '--:--')

/** Devuelve array de 7 fechas (Date) empezando por el Lunes de la semana de `date`. */
function weekOf(date) {
  const d = new Date(date)
  const dow = d.getDay() // 0=dom
  const diff = dow === 0 ? -6 : 1 - dow // shift hacia lunes
  const monday = new Date(d)
  monday.setDate(d.getDate() + diff)
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday)
    day.setDate(monday.getDate() + i)
    return day
  })
}

/** Extrae YYYY-MM del día. */
const mesOf = (iso) => iso.slice(0, 7)

export default function AgendaScreen({ navigation }) {
  const { user } = useAuthStore()
  const canEdit = user?.role === 'admin' || user?.role === 'supervisor'

  const [selected, setSelected] = useState(todayIso())
  const [monthActs, setMonthActs] = useState([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const currentMes = mesOf(selected)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError('')
    try {
      const res = await actividadesApi.listarMes(currentMes)
      setMonthActs(res.actividades || [])
    } catch (e) {
      if (!silent) setError('No se pudo cargar la agenda')
    } finally {
      if (!silent) setLoading(false)
      setRefreshing(false)
    }
  }, [currentMes])

  useFocusEffect(useCallback(() => { load() }, [load]))

  // Polling 20s (paridad con web/CRM)
  useEffect(() => {
    const id = setInterval(() => load(true), 20_000)
    return () => clearInterval(id)
  }, [load])

  // Índice de actividades por día
  const actsByDay = useMemo(() => {
    const m = {}
    for (const a of monthActs) {
      if (!a.fecha_dia) continue
      if (!m[a.fecha_dia]) m[a.fecha_dia] = []
      m[a.fecha_dia].push(a)
    }
    return m
  }, [monthActs])

  const week = useMemo(() => weekOf(new Date(selected + 'T12:00:00')), [selected])
  const selectedActs = actsByDay[selected] || []
  const [selY, selM, selD] = selected.split('-').map(Number)
  const headerLabel = `${selD} de ${MESES[selM - 1]}`

  const goToday = () => setSelected(todayIso())
  const shiftWeek = (delta) => {
    const d = new Date(selected + 'T12:00:00')
    d.setDate(d.getDate() + delta * 7)
    setSelected(isoLocal(d))
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Header: título + navegación */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Agenda</Text>
          <Text style={styles.subtitle}>{headerLabel}</Text>
        </View>
        <Pressable style={styles.todayBtn} onPress={goToday}>
          <Text style={styles.todayText}>Hoy</Text>
        </Pressable>
      </View>

      {/* Strip semanal */}
      <View style={styles.weekBar}>
        <Pressable onPress={() => shiftWeek(-1)} style={styles.arrowBtn} accessibilityLabel="Semana anterior">
          <Icon name="chevronLeft" size={18} color={colors.text.secondary} />
        </Pressable>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.weekStrip}
        >
          {week.map((d) => {
            const iso = isoLocal(d)
            const isSel = iso === selected
            const isToday = iso === todayIso()
            const count = actsByDay[iso]?.length || 0
            return (
              <Pressable
                key={iso}
                style={[
                  styles.dayCell,
                  isSel && styles.dayCellSel,
                ]}
                onPress={() => setSelected(iso)}
              >
                <Text style={[styles.dayDow, isSel && styles.dayDowSel]}>
                  {DIAS_CORTOS[d.getDay()]}
                </Text>
                <View style={[styles.dayNumWrap, isToday && !isSel && styles.dayNumWrapToday]}>
                  <Text style={[
                    styles.dayNum,
                    isSel && styles.dayNumSel,
                    isToday && !isSel && styles.dayNumToday,
                  ]}>
                    {d.getDate()}
                  </Text>
                </View>
                {count > 0 && (
                  <View style={[styles.dot, isSel && styles.dotSel]} />
                )}
              </Pressable>
            )
          })}
        </ScrollView>
        <Pressable onPress={() => shiftWeek(1)} style={styles.arrowBtn} accessibilityLabel="Semana siguiente">
          <Icon name="chevronRight" size={18} color={colors.text.secondary} />
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading && monthActs.length === 0 ? (
        <ActivityIndicator style={{ marginTop: spacing['3xl'] }} color={colors.brand[600]} />
      ) : (
        <FlatList
          data={selectedActs}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing['4xl'] }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load() }}
              tintColor={colors.brand[600]}
              colors={[colors.brand[600]]}
            />
          }
          ListHeaderComponent={
            selectedActs.length > 0 ? (
              <Text style={styles.countLine}>
                {selectedActs.length} {selectedActs.length === 1 ? 'actividad' : 'actividades'}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Icon name="calendar" size={22} color={colors.text.muted} />
              </View>
              <Text style={styles.emptyText}>Sin actividades este día</Text>
              <Text style={styles.emptyHint}>Tocá otro día en la semana o creá una nueva.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const iniciado = item.desestadoactividad === 'iniciado'
            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.75}
                onPress={() => canEdit && navigation.navigate('EditarActividad', { actividadId: item.id })}
              >
                <View style={styles.rowBetween}>
                  <View style={[styles.badge, iniciado ? styles.badgeAmber : styles.badgeEmerald]}>
                    <View style={[styles.badgeDot, iniciado ? styles.dotAmber : styles.dotEmerald]} />
                    <Text style={[styles.badgeText, iniciado ? { color: colors.warning[700] } : { color: colors.success[700] }]}>
                      {item.desestadoactividad}
                    </Text>
                  </View>
                  <Text style={styles.hora}>
                    {fmtHM(item.horinicio)}{item.horfin ? ` → ${fmtHM(item.horfin)}` : ''}
                  </Text>
                </View>

                <Text style={styles.trabajador} numberOfLines={1}>{item.trabajador_nombre}</Text>
                {item.desactividad ? (
                  <Text style={styles.desc} numberOfLines={2}>{item.desactividad}</Text>
                ) : null}
                {item.centro_costo_nombre ? (
                  <Text style={styles.meta} numberOfLines={1}>
                    <Text style={{ color: colors.text.muted }}>CC:</Text> {item.centro_costo_nombre}
                  </Text>
                ) : null}
              </TouchableOpacity>
            )
          }}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    paddingHorizontal: spacing.base, paddingTop: spacing.base, paddingBottom: spacing.sm,
  },
  title: { ...type.h1, color: colors.text.primary },
  subtitle: { ...type.caption, color: colors.text.tertiary, marginTop: 2, textTransform: 'capitalize' },

  todayBtn: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill, backgroundColor: colors.brand[600],
  },
  todayText: { color: colors.text.inverse, fontSize: 12, fontWeight: '700' },

  weekBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  arrowBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
  weekStrip: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  dayCell: {
    flex: 1, minWidth: 42, paddingVertical: spacing.xs + 2,
    borderRadius: radius.md, alignItems: 'center', gap: 4,
  },
  dayCellSel: { backgroundColor: colors.brand[50] },
  dayDow: { ...type.overline, color: colors.text.muted, fontSize: 10 },
  dayDowSel: { color: colors.brand[600] },
  dayNumWrap: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  dayNumWrapToday: { backgroundColor: colors.brand[600] },
  dayNum: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
  dayNumSel: { color: colors.brand[700], fontWeight: '700' },
  dayNumToday: { color: colors.text.inverse },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.brand[500] },
  dotSel: { backgroundColor: colors.brand[700] },

  error: {
    color: colors.danger[700], backgroundColor: colors.danger[50],
    padding: spacing.md, marginHorizontal: spacing.base, marginTop: spacing.sm,
    borderRadius: radius.md, ...type.caption,
  },

  countLine: {
    ...type.caption, color: colors.text.tertiary,
    paddingHorizontal: spacing.xs, paddingBottom: spacing.sm,
  },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.base, marginBottom: spacing.sm, gap: spacing.xs + 2,
    ...shadow?.card,
  },
  rowBetween: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm,
  },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill,
  },
  badgeAmber:   { backgroundColor: colors.warning[50] },
  badgeEmerald: { backgroundColor: colors.success[50] },
  badgeDot:     { width: 6, height: 6, borderRadius: 3 },
  dotAmber:     { backgroundColor: colors.warning[500] },
  dotEmerald:   { backgroundColor: colors.success[500] },
  badgeText:    { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  hora:         { fontSize: 12, color: colors.text.tertiary, fontVariant: ['tabular-nums'] },

  trabajador: { ...type.bodyStrong, color: colors.text.primary },
  desc:       { ...type.body, color: colors.text.secondary },
  meta:       { ...type.caption, color: colors.text.tertiary },

  empty: {
    alignItems: 'center', paddingVertical: spacing['3xl'],
  },
  emptyIcon: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceSubtle, marginBottom: spacing.sm,
  },
  emptyText: { ...type.body, color: colors.text.secondary },
  emptyHint: { ...type.caption, color: colors.text.muted, marginTop: 2 },
})
