/**
 * AgendaScreen — 3 vistas (Hoy / Semana / Mes) al patrón CRM Palma.
 *
 * Hoy    → lista agrupada por actividad del día actual (foco máximo).
 * Semana → strip 7 días + lista del día seleccionado.
 * Mes    → grid 6×7 con contador de actividades por día; tap salta a Semana.
 *
 * Cards agrupadas por descripción (el eje "qué se hizo" en vez de
 * "quién marcó") con border-left pastel color-tag determinístico,
 * chip de horas totales y expand/collapse hasta 5 trabajadores.
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

const DIAS_CORTOS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá']
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
const mesOf = (iso) => iso.slice(0, 7)

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

/** Devuelve 42 fechas (6 semanas × 7 días) que cubren todo el mes de `date`. */
function monthGrid(date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1)
  const dow = first.getDay() // 0=dom
  const offset = dow === 0 ? -6 : 1 - dow // arranca en lunes
  const start = new Date(first)
  start.setDate(first.getDate() + offset)
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

// ─── Screen ────────────────────────────────────────────────────────────────
const VIEWS = [
  { key: 'hoy',    label: 'Hoy' },
  { key: 'semana', label: 'Semana' },
  { key: 'mes',    label: 'Mes' },
]

export default function AgendaScreen({ navigation }) {
  const { user } = useAuthStore()
  const canEdit = user?.role === 'admin' || user?.role === 'supervisor'
  const canCreate = canEdit

  const [view, setView] = useState('hoy')
  const [selected, setSelected] = useState(todayIso())
  const [cursor, setCursor] = useState(todayIso())  // controla el mes visible
  const [monthActs, setMonthActs] = useState([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState({})

  const currentMes = mesOf(cursor)

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
  useEffect(() => {
    const id = setInterval(() => load(true), 20_000)
    return () => clearInterval(id)
  }, [load])

  // ── Data derivada ─────────────────────────────────────────────────────
  const actsByDay = useMemo(() => {
    const m = {}
    for (const a of monthActs) {
      if (!a.fecha_dia) continue
      if (!m[a.fecha_dia]) m[a.fecha_dia] = []
      m[a.fecha_dia].push(a)
    }
    return m
  }, [monthActs])

  const focusDay = view === 'hoy' ? todayIso() : selected
  const gruposDelDia = useMemo(() => groupByActividad(actsByDay[focusDay] || []), [actsByDay, focusDay])

  const cursorDate = useMemo(() => new Date(cursor + 'T12:00:00'), [cursor])
  const monthLabel = `${MESES[cursorDate.getMonth()]} ${cursorDate.getFullYear()}`
  const week = useMemo(() => weekOf(new Date(selected + 'T12:00:00')), [selected])
  const grid = useMemo(() => monthGrid(cursorDate), [cursorDate])

  const shiftMonth = (delta) => {
    const d = new Date(cursorDate)
    d.setMonth(d.getMonth() + delta)
    setCursor(isoLocal(d))
  }
  const shiftWeek = (delta) => {
    const d = new Date(selected + 'T12:00:00')
    d.setDate(d.getDate() + delta * 7)
    setSelected(isoLocal(d))
    setCursor(isoLocal(d))
  }

  const goToday = () => {
    const t = todayIso()
    setSelected(t)
    setCursor(t)
  }
  const toggleGrupo = (key) => setExpanded((p) => ({ ...p, [key]: !p[key] }))

  const openNueva = () => navigation.navigate('Nueva')

  const focusLabel = useMemo(() => {
    const d = new Date(focusDay + 'T12:00:00')
    return `${DIAS_LARGOS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`
  }, [focusDay])

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header con selector de mes */}
      <View style={styles.header}>
        <Pressable
          onPress={() => shiftMonth(-1)}
          style={styles.monthArrow}
          android_ripple={{ color: colors.surfaceSubtle, borderless: true }}
          accessibilityLabel="Mes anterior"
        >
          <Icon name="chevronLeft" size={18} color={colors.text.secondary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
        </View>
        <Pressable
          onPress={() => shiftMonth(1)}
          style={styles.monthArrow}
          android_ripple={{ color: colors.surfaceSubtle, borderless: true }}
          accessibilityLabel="Mes siguiente"
        >
          <Icon name="chevronRight" size={18} color={colors.text.secondary} />
        </Pressable>
      </View>

      {/* Segmented control: Hoy | Semana | Mes */}
      <View style={styles.segmentWrap}>
        <View style={styles.segment}>
          {VIEWS.map((v) => {
            const active = view === v.key
            return (
              <Pressable
                key={v.key}
                onPress={() => setView(v.key)}
                style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                android_ripple={{ color: colors.surfaceSubtle }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {v.label}
                </Text>
              </Pressable>
            )
          })}
        </View>
        <Pressable onPress={goToday} style={styles.todayBtn} android_ripple={{ color: colors.brand[500] }}>
          <Text style={styles.todayText}>Hoy</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* Body según vista */}
      {view === 'mes' ? (
        <MesView
          grid={grid}
          cursorMonth={cursorDate.getMonth()}
          actsByDay={actsByDay}
          selected={selected}
          onSelect={(iso) => { setSelected(iso); setView('semana') }}
        />
      ) : (
        <>
          {view === 'semana' && (
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
                      accessibilityLabel={
                        `${DIAS_LARGOS[d.getDay()]} ${d.getDate()}${count > 0 ? `, ${count} ${count === 1 ? 'actividad' : 'actividades'}` : ''}`
                      }
                    >
                      <Text style={[styles.dayDow, isSel && styles.dayDowSel]}>{DIAS_CORTOS[d.getDay()]}</Text>
                      <View style={[styles.dayNumWrap, isToday && !isSel && styles.dayNumWrapToday]}>
                        <Text style={[styles.dayNum, isSel && styles.dayNumSel, isToday && !isSel && styles.dayNumToday]}>
                          {d.getDate()}
                        </Text>
                      </View>
                      {count > 0 ? (
                        <View style={[styles.countBadge, isSel && styles.countBadgeSel]}>
                          <Text style={styles.countBadgeText}>{count > 9 ? '9+' : count}</Text>
                        </View>
                      ) : <View style={styles.countPlaceholder} />}
                    </Pressable>
                  )
                })}
              </ScrollView>
              <Pressable onPress={() => shiftWeek(1)} style={styles.arrowBtn} accessibilityLabel="Semana siguiente">
                <Icon name="chevronRight" size={18} color={colors.text.secondary} />
              </Pressable>
            </View>
          )}

          {loading && monthActs.length === 0 ? (
            <ActivityIndicator style={{ marginTop: spacing['3xl'] }} color={colors.brand[600]} />
          ) : (
            <FlatList
              data={gruposDelDia}
              keyExtractor={(g) => g.desc}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }}
                  tintColor={colors.brand[600]} colors={[colors.brand[600]]} />
              }
              ListHeaderComponent={
                gruposDelDia.length > 0 ? (
                  <Text style={styles.countLine}>
                    {focusLabel} · {gruposDelDia.length}{' '}
                    {gruposDelDia.length === 1 ? 'actividad' : 'actividades'}
                  </Text>
                ) : null
              }
              ListEmptyComponent={
                <EmptyState
                  view={view}
                  canCreate={canCreate}
                  onCreate={openNueva}
                />
              }
              renderItem={({ item }) => (
                <GrupoActividad
                  grupo={item}
                  expanded={!!expanded[item.desc]}
                  onToggle={() => toggleGrupo(item.desc)}
                  canEdit={canEdit}
                  onEdit={(id) => navigation.navigate('EditarActividad', { actividadId: id })}
                />
              )}
            />
          )}
        </>
      )}
    </SafeAreaView>
  )
}

// ─── Group helper ──────────────────────────────────────────────────────────
function groupByActividad(acts) {
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
}

// ─── MesView (grid mensual 6x7) ────────────────────────────────────────────
function MesView({ grid, cursorMonth, actsByDay, selected, onSelect }) {
  const weeks = useMemo(() => {
    const rows = []
    for (let i = 0; i < 6; i++) rows.push(grid.slice(i * 7, i * 7 + 7))
    return rows
  }, [grid])

  return (
    <ScrollView contentContainerStyle={styles.mesScroll}>
      {/* Header de días */}
      <View style={styles.mesHeader}>
        {DIAS_CORTOS.slice(1).concat(DIAS_CORTOS[0]).map((lbl) => (
          <View key={lbl} style={styles.mesHeaderCell}>
            <Text style={styles.mesHeaderText}>{lbl}</Text>
          </View>
        ))}
      </View>

      {weeks.map((wk, wi) => (
        <View key={wi} style={styles.mesRow}>
          {wk.map((d) => {
            const iso = isoLocal(d)
            const inMonth = d.getMonth() === cursorMonth
            const isToday = iso === todayIso()
            const isSel = iso === selected
            const count = actsByDay[iso]?.length || 0
            return (
              <Pressable
                key={iso}
                style={[
                  styles.mesCell,
                  isSel && styles.mesCellSel,
                ]}
                onPress={() => onSelect(iso)}
                android_ripple={{ color: colors.surfaceSubtle }}
                accessibilityLabel={`${d.getDate()} ${MESES[d.getMonth()]}${count > 0 ? `, ${count} actividades` : ''}`}
              >
                <View style={[
                  styles.mesNumWrap,
                  isToday && styles.mesNumWrapToday,
                ]}>
                  <Text style={[
                    styles.mesNum,
                    !inMonth && styles.mesNumOut,
                    isToday && styles.mesNumToday,
                    isSel && !isToday && styles.mesNumSel,
                  ]}>{d.getDate()}</Text>
                </View>
                {count > 0 && (
                  <View style={styles.mesDot} />
                )}
                {count > 0 && (
                  <Text style={styles.mesCount}>{count}</Text>
                )}
              </Pressable>
            )
          })}
        </View>
      ))}
    </ScrollView>
  )
}

// ─── Empty state según vista ───────────────────────────────────────────────
function EmptyState({ view, canCreate, onCreate }) {
  const texts = {
    hoy: {
      title: 'Sin actividades hoy',
      hint: 'Todavía no hay tareas registradas para el día de hoy.',
    },
    semana: {
      title: 'Sin actividades este día',
      hint: 'Toca otro día en la semana o crea una nueva actividad.',
    },
  }
  const t = texts[view] || texts.semana

  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconBig}>
        <Icon name="calendar" size={32} color={colors.brand[600]} />
      </View>
      <Text style={styles.emptyTitle}>{t.title}</Text>
      <Text style={styles.emptyHint}>{t.hint}</Text>
      {canCreate && (
        <Pressable
          onPress={onCreate}
          style={styles.emptyCta}
          android_ripple={{ color: colors.brand[500] }}
        >
          <Icon name="plus" size={16} color={colors.text.inverse} strokeWidth={2.25} />
          <Text style={styles.emptyCtaText}>Crear actividad</Text>
        </Pressable>
      )}
    </View>
  )
}

// ─── GrupoActividad card ───────────────────────────────────────────────────
const MAX_PREVIEW = 5

function GrupoActividad({ grupo, expanded, onToggle, canEdit, onEdit }) {
  const pastel = pastelFor(grupo.desc)
  const trabsToShow = expanded ? grupo.trabajadores : grupo.trabajadores.slice(0, MAX_PREVIEW)
  const remaining = grupo.trabajadores.length - trabsToShow.length

  const spin = useRef(new Animated.Value(expanded ? 1 : 0)).current
  useEffect(() => {
    Animated.timing(spin, {
      toValue: expanded ? 1 : 0, duration: 200,
      easing: Easing.inOut(Easing.ease), useNativeDriver: true,
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
            <Text style={[styles.hoursChipText, { color: pastel.fg }]}>{fmtHoras(grupo.minutosTotal)}</Text>
          </View>
          <Animated.View style={{ marginLeft: spacing.sm, transform: [{ rotate: chevronRotate }] }}>
            <Icon name="chevronDown" size={18} color={colors.text.muted} />
          </Animated.View>
        </View>
      </Pressable>

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
            <Text style={styles.trabTime}>{fmtHM(t.horinicio)}{t.horfin ? ` → ${fmtHM(t.horfin)}` : ''}</Text>
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

  // Header con selector de mes
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },
  monthArrow: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceSubtle,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  monthLabel: { ...type.h2, color: colors.text.primary, textTransform: 'capitalize' },

  // Segmented control
  segmentWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  segment: {
    flex: 1, flexDirection: 'row',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.md, padding: 3,
  },
  segmentBtn: {
    flex: 1, height: 34, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  segmentBtnActive: {
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  segmentText: { ...type.label, color: colors.text.tertiary, fontWeight: '600' },
  segmentTextActive: { color: colors.brand[700], fontWeight: '700' },

  todayBtn: {
    paddingHorizontal: spacing.md, height: 34,
    borderRadius: radius.md, backgroundColor: colors.brand[600],
    alignItems: 'center', justifyContent: 'center',
  },
  todayText: { color: colors.text.inverse, fontSize: 13, fontWeight: '700' },

  // Week strip
  weekBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  arrowBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  weekStrip: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  dayCell: {
    flex: 1, minWidth: 46, paddingVertical: spacing.xs + 2,
    borderRadius: radius.md, alignItems: 'center', gap: 3,
  },
  dayCellSel: { backgroundColor: colors.brand[50] },
  dayDow: { ...type.overline, color: colors.text.muted, fontSize: 10, letterSpacing: 0.2 },
  dayDowSel: { color: colors.brand[600] },
  dayNumWrap: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dayNumWrapToday: { backgroundColor: colors.brand[600] },
  dayNum: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
  dayNumSel: { color: colors.brand[700], fontWeight: '700' },
  dayNumToday: { color: colors.text.inverse },
  countBadge: {
    minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4,
    backgroundColor: colors.brand[600],
    alignItems: 'center', justifyContent: 'center',
  },
  countBadgeSel: { backgroundColor: colors.brand[700] },
  countBadgeText: { fontSize: 10, fontWeight: '700', color: colors.text.inverse, lineHeight: 12, fontVariant: ['tabular-nums'] },
  countPlaceholder: { height: 16 },

  error: {
    color: colors.danger[700], backgroundColor: colors.danger[50],
    padding: spacing.md, marginHorizontal: spacing.base, marginTop: spacing.sm,
    borderRadius: radius.md, ...type.caption,
  },

  listContent: { padding: spacing.md, paddingBottom: spacing['4xl'] },
  countLine: {
    ...type.caption, color: colors.text.tertiary,
    paddingHorizontal: spacing.xs, paddingBottom: spacing.md,
    textTransform: 'capitalize',
  },

  // Vista Mes
  mesScroll: { padding: spacing.md, paddingBottom: spacing['4xl'] },
  mesHeader: { flexDirection: 'row', marginBottom: spacing.sm },
  mesHeaderCell: { flex: 1, alignItems: 'center' },
  mesHeaderText: { ...type.overline, color: colors.text.muted, fontSize: 10 },
  mesRow: { flexDirection: 'row', gap: 2, marginBottom: 2 },
  mesCell: {
    flex: 1, minHeight: 64,
    borderRadius: radius.sm, backgroundColor: colors.surface,
    padding: 6, alignItems: 'center',
    borderWidth: 1, borderColor: 'transparent',
  },
  mesCellSel: { borderColor: colors.brand[600], backgroundColor: colors.brand[50] },
  mesNumWrap: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  mesNumWrapToday: { backgroundColor: colors.brand[600] },
  mesNum: { fontSize: 13, fontWeight: '600', color: colors.text.primary },
  mesNumOut: { color: colors.text.softMuted },
  mesNumToday: { color: colors.text.inverse },
  mesNumSel: { color: colors.brand[700], fontWeight: '700' },
  mesDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.brand[500], marginTop: 4 },
  mesCount: { fontSize: 10, fontWeight: '700', color: colors.text.tertiary, marginTop: 2, fontVariant: ['tabular-nums'] },

  // Card grupo
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, borderLeftWidth: 3,
    paddingVertical: spacing.md, marginBottom: spacing.md, ...shadow.card,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.base, gap: spacing.md },
  cardTitle: { ...type.bodyStrong, fontSize: 15, color: colors.text.primary, lineHeight: 20 },
  cardMeta: { ...type.caption, color: colors.text.tertiary, marginTop: 3 },
  hoursChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  hoursChipText: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  divider: { height: 1, backgroundColor: colors.surfaceSubtle, marginTop: spacing.md },

  trabRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.base, paddingVertical: spacing.sm + 2,
    minHeight: 44,
  },
  trabRowBorder: { borderTopWidth: 1, borderTopColor: colors.surfaceSubtle },
  avatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  trabName: { ...type.body, fontSize: 14, color: colors.text.primary },
  trabTime: { ...type.caption, color: colors.text.tertiary, marginTop: 1, fontVariant: ['tabular-nums'] },
  trabRight: { minWidth: 60, alignItems: 'flex-end' },
  trabHoras: { fontSize: 13, fontWeight: '600', color: colors.text.primary, fontVariant: ['tabular-nums'] },
  pillIniciado: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.pill, backgroundColor: colors.success[50],
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

  // Empty state
  emptyWrap: {
    alignItems: 'center', paddingVertical: spacing['4xl'], paddingHorizontal: spacing.lg,
  },
  emptyIconBig: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.brand[50],
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: { ...type.h2, color: colors.text.primary, textAlign: 'center' },
  emptyHint: {
    ...type.body, color: colors.text.tertiary, textAlign: 'center',
    marginTop: spacing.xs, marginBottom: spacing.lg,
    maxWidth: 300,
  },
  emptyCta: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.brand[600],
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderRadius: radius.md, minHeight: 44,
  },
  emptyCtaText: { color: colors.text.inverse, fontSize: 14, fontWeight: '700' },
})
