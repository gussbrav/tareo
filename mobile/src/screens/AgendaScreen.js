/**
 * AgendaScreen — vista agrupada por actividad (diferencia real con Tareo).
 * En Tareo el eje es el trabajador ("¿quién marcó hoy?").
 * En Agenda el eje es la actividad ("¿qué se hizo hoy?"), agrupando trabajadores.
 *
 * Header: título + subtítulo con día de semana + botón Hoy.
 * Strip semanal: 7 pastillas con navegación ‹/› y dot indicador.
 * Cards: 1 card por descripción única, border-left color-tag pastel
 *        determinístico (misma actividad → mismo color siempre),
 *        chip de horas totales, lista de trabajadores expand/collapse.
 *
 * Refresh al focus + polling 20 s + pull-to-refresh.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { actividadesApi } from '../api/actividades'
import { useAuthStore } from '../store/auth'
import { colors, pastelFor, radius, shadow, spacing, type } from '../theme'
import Icon from '../ui/Icons'

const DIAS_CORTOS = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
const DIAS_LARGOS = [
  'Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado',
]
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

const iniciales = (nombre) => {
  if (!nombre) return '??'
  return nombre.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

const fmtHoras = (min) => {
  if (!min || min <= 0) return '—'
  const h = min / 60
  return h >= 10 ? `${Math.round(h)}h` : `${h.toFixed(1)}h`
}

function weekOf(date) {
  const d = new Date(date)
  const dow = d.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  const monday = new Date(d)
  monday.setDate(d.getDate() + diff)
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday)
    day.setDate(monday.getDate() + i)
    return day
  })
}
const mesOf = (iso) => iso.slice(0, 7)

// ─── Screen ────────────────────────────────────────────────────────────────
export default function AgendaScreen({ navigation }) {
  const { user } = useAuthStore()
  const canEdit = user?.role === 'admin' || user?.role === 'supervisor'

  const [selected, setSelected] = useState(todayIso())
  const [monthActs, setMonthActs] = useState([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState({})

  const currentMes = mesOf(selected)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError('')
    try {
      const res = await actividadesApi.listarMes(currentMes)
      setMonthActs(res.actividades || [])
    } catch {
      if (!silent) setError('No se pudo cargar la agenda')
    } finally {
      if (!silent) setLoading(false)
      setRefreshing(false)
    }
  }, [currentMes])

  useFocusEffect(useCallback(() => { load() }, [load]))

  // Polling 20 s
  useEffect(() => {
    const id = setInterval(() => load(true), 20_000)
    return () => clearInterval(id)
  }, [load])

  // Índice por día
  const actsByDay = useMemo(() => {
    const m = {}
    for (const a of monthActs) {
      if (!a.fecha_dia) continue
      if (!m[a.fecha_dia]) m[a.fecha_dia] = []
      m[a.fecha_dia].push(a)
    }
    return m
  }, [monthActs])

  // Agrupar el día seleccionado por descripción
  const gruposDelDia = useMemo(() => {
    const acts = actsByDay[selected] || []
    const map = new Map()
    for (const a of acts) {
      const key = (a.desactividad || '(Sin descripción)').trim()
      if (!map.has(key)) {
        map.set(key, {
          desc: key,
          ceco: a.centro_costo_nombre || '',
          minutosTotal: 0,
          trabajadores: [],
        })
      }
      const g = map.get(key)
      g.minutosTotal += Number(a.numduracionminuto) || 0
      g.trabajadores.push({
        id: a.id,
        nombre: a.trabajador_nombre,
        horinicio: a.horinicio,
        horfin: a.horfin,
        minutos: Number(a.numduracionminuto) || 0,
        iniciado: a.desestadoactividad === 'iniciado',
      })
    }
    return Array.from(map.values()).sort((a, b) => b.minutosTotal - a.minutosTotal)
  }, [actsByDay, selected])

  const week = useMemo(() => weekOf(new Date(selected + 'T12:00:00')), [selected])
  const selDateObj = useMemo(() => new Date(selected + 'T12:00:00'), [selected])
  const dow = DIAS_LARGOS[selDateObj.getDay()]
  const headerLabel = `${dow} ${selDateObj.getDate()} de ${MESES[selDateObj.getMonth()]}`

  const goToday = () => setSelected(todayIso())
  const shiftWeek = (delta) => {
    const d = new Date(selected + 'T12:00:00')
    d.setDate(d.getDate() + delta * 7)
    setSelected(isoLocal(d))
  }

  const toggleGrupo = (key) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const totalActividadesDia = (actsByDay[selected] || []).length

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Agenda</Text>
          <Text style={styles.subtitle}>{headerLabel}</Text>
        </View>
        <Pressable style={styles.todayBtn} onPress={goToday} android_ripple={{ color: colors.brand[500] }}>
          <Text style={styles.todayText}>Hoy</Text>
        </Pressable>
      </View>

      {/* Strip semanal */}
      <View style={styles.weekBar}>
        <Pressable onPress={() => shiftWeek(-1)} style={styles.arrowBtn} accessibilityLabel="Semana anterior">
          <Icon name="chevronLeft" size={18} color={colors.text.secondary} />
        </Pressable>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekStrip}>
          {week.map((d) => {
            const iso = isoLocal(d)
            const isSel = iso === selected
            const isToday = iso === todayIso()
            const count = actsByDay[iso]?.length || 0
            return (
              <Pressable
                key={iso}
                style={[styles.dayCell, isSel && styles.dayCellSel]}
                onPress={() => setSelected(iso)}
              >
                <Text style={[styles.dayDow, isSel && styles.dayDowSel]}>{DIAS_CORTOS[d.getDay()]}</Text>
                <View style={[styles.dayNumWrap, isToday && !isSel && styles.dayNumWrapToday]}>
                  <Text style={[
                    styles.dayNum,
                    isSel && styles.dayNumSel,
                    isToday && !isSel && styles.dayNumToday,
                  ]}>{d.getDate()}</Text>
                </View>
                {count > 0 && <View style={[styles.dot, isSel && styles.dotSel]} />}
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
          data={gruposDelDia}
          keyExtractor={(g) => g.desc}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load() }}
              tintColor={colors.brand[600]}
              colors={[colors.brand[600]]}
            />
          }
          ListHeaderComponent={
            gruposDelDia.length > 0 ? (
              <Text style={styles.countLine}>
                {gruposDelDia.length}{' '}
                {gruposDelDia.length === 1 ? 'actividad' : 'actividades'}
                {' · '}
                {totalActividadesDia}{' '}
                {totalActividadesDia === 1 ? 'trabajador' : 'trabajadores'}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Icon name="calendar" size={22} color={colors.text.muted} />
              </View>
              <Text style={styles.emptyText}>Sin actividades este día</Text>
              <Text style={styles.emptyHint}>Toca otro día en la semana o crea una nueva.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <GrupoActividad
              grupo={item}
              expanded={!!expanded[item.desc]}
              onToggle={() => toggleGrupo(item.desc)}
              canEdit={canEdit}
              onEdit={(actividadId) => navigation.navigate('EditarActividad', { actividadId })}
            />
          )}
        />
      )}
    </SafeAreaView>
  )
}

// ─── GrupoActividad card ───────────────────────────────────────────────────
const MAX_PREVIEW = 5

function GrupoActividad({ grupo, expanded, onToggle, canEdit, onEdit }) {
  const pastel = pastelFor(grupo.desc)
  const trabsToShow = expanded ? grupo.trabajadores : grupo.trabajadores.slice(0, MAX_PREVIEW)
  const remaining = grupo.trabajadores.length - trabsToShow.length

  // rotación del chevron 0 → 180
  const spin = useRef(new Animated.Value(expanded ? 1 : 0)).current
  useEffect(() => {
    Animated.timing(spin, {
      toValue: expanded ? 1 : 0,
      duration: 200,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start()
  }, [expanded, spin])
  const chevronRotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] })

  return (
    <View style={[styles.card, { borderLeftColor: pastel.fg }]}>
      <Pressable onPress={onToggle} android_ripple={{ color: colors.surfaceSubtle }}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.cardTitle} numberOfLines={2}>{grupo.desc}</Text>
            <Text style={styles.cardMeta} numberOfLines={1}>
              {grupo.trabajadores.length}{' '}
              {grupo.trabajadores.length === 1 ? 'trabajador' : 'trabajadores'}
              {grupo.ceco ? ` · ${grupo.ceco}` : ''}
            </Text>
          </View>
          <View style={[styles.hoursChip, { backgroundColor: pastel.bg }]}>
            <Text style={[styles.hoursChipText, { color: pastel.fg }]}>
              {fmtHoras(grupo.minutosTotal)}
            </Text>
          </View>
          <Animated.View style={{ marginLeft: spacing.sm, transform: [{ rotate: chevronRotate }] }}>
            <Icon name="chevronDown" size={18} color={colors.text.muted} />
          </Animated.View>
        </View>
      </Pressable>

      {/* Lista de trabajadores */}
      <View style={styles.divider} />
      {trabsToShow.map((t, i) => (
        <Pressable
          key={t.id}
          onPress={canEdit ? () => onEdit(t.id) : undefined}
          android_ripple={canEdit ? { color: colors.surfaceSubtle } : null}
          style={[styles.trabRow, i > 0 && styles.trabRowBorder]}
        >
          <View style={[styles.avatar, { backgroundColor: pastel.bg }]}>
            <Text style={[styles.avatarText, { color: pastel.fg }]}>{iniciales(t.nombre)}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.trabName} numberOfLines={1}>{t.nombre}</Text>
            <Text style={styles.trabTime}>
              {fmtHM(t.horinicio)}{t.horfin ? ` → ${fmtHM(t.horfin)}` : ''}
            </Text>
          </View>
          <View style={styles.trabRight}>
            {t.iniciado ? (
              <View style={styles.pillIniciado}>
                <View style={styles.pillDot} />
                <Text style={styles.pillIniciadoText}>Activo</Text>
              </View>
            ) : (
              <Text style={styles.trabHoras}>{fmtHoras(t.minutos)}</Text>
            )}
          </View>
        </Pressable>
      ))}

      {remaining > 0 && !expanded && (
        <Pressable onPress={onToggle} android_ripple={{ color: colors.surfaceSubtle }} style={styles.moreBtn}>
          <Text style={[styles.moreBtnText, { color: pastel.fg }]}>
            + {remaining} {remaining === 1 ? 'trabajador' : 'trabajadores'}
          </Text>
        </Pressable>
      )}
    </View>
  )
}

// ─── Styles ────────────────────────────────────────────────────────────────
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
  dayNumWrap: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
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

  listContent: { padding: spacing.md, paddingBottom: spacing['4xl'] },
  countLine: {
    ...type.caption, color: colors.text.tertiary,
    paddingHorizontal: spacing.xs, paddingBottom: spacing.md,
  },

  // ── Grupo card
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderLeftWidth: 3,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.base,
    gap: spacing.md,
  },
  cardTitle: { ...type.bodyStrong, fontSize: 15, color: colors.text.primary, lineHeight: 20 },
  cardMeta: { ...type.caption, color: colors.text.tertiary, marginTop: 3 },
  hoursChip: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.pill,
  },
  hoursChipText: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  divider: { height: 1, backgroundColor: colors.surfaceSubtle, marginTop: spacing.md },

  trabRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.base, paddingVertical: spacing.sm + 2,
    minHeight: 44,
  },
  trabRowBorder: { borderTopWidth: 1, borderTopColor: colors.surfaceSubtle },
  avatar: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  trabName: { ...type.body, fontSize: 14, color: colors.text.primary },
  trabTime: { ...type.caption, color: colors.text.tertiary, marginTop: 1, fontVariant: ['tabular-nums'] },
  trabRight: { minWidth: 60, alignItems: 'flex-end' },
  trabHoras: { fontSize: 13, fontWeight: '600', color: colors.text.primary, fontVariant: ['tabular-nums'] },
  pillIniciado: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.success[50],
  },
  pillDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success[500] },
  pillIniciadoText: { fontSize: 11, fontWeight: '700', color: colors.success[700] },

  moreBtn: {
    marginTop: 4, marginHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.surfaceSubtle,
    alignItems: 'center',
  },
  moreBtnText: { fontSize: 13, fontWeight: '700' },

  empty: { alignItems: 'center', paddingVertical: spacing['3xl'] },
  emptyIcon: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceSubtle, marginBottom: spacing.sm,
  },
  emptyText: { ...type.body, color: colors.text.secondary },
  emptyHint: { ...type.caption, color: colors.text.muted, marginTop: 2 },
})
