/**
 * TareoScreen — lista del día con búsqueda, filtro de estado y bulk
 * finalize al patrón Appsmith Grecia (barra top permanente):
 *
 * Header sticky:
 *   - Date bar (chevrons + DateField + Hoy)
 *   - Search bar (debounce 250 ms, insensible a acentos)
 *   - Chips segmented: Todas · Iniciadas · Finalizadas (con contadores)
 *   - Bulk bar (checkbox "Seleccionar todos" + botón "Finalizar (N)"
 *     SIEMPRE visible cuando hay ≥1 iniciada visible, disabled si N=0.
 *     Patrón Appsmith explícito solicitado por el cliente.)
 *
 * Cards: checkbox 24×24 a la izquierda para iniciadas, checkmark verde
 * para finalizadas. Card seleccionada: border brand-600 + tint brand-50.
 * Confirmación con Alert antes de POST /api/actividades/finalizar-batch.
 * Feedback: toast bottom 2.5 s (success/error).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { actividadesApi } from '../api/actividades'
import { useAuthStore } from '../store/auth'
import { useActiveProjectStore } from '../store/project'
import { colors, pastelFor, radius, shadow, spacing, type } from '../theme'
import ActiveProjectChip from '../ui/ActiveProjectChip'
import DateField from '../ui/DateField'
import Icon from '../ui/Icons'

// ─── helpers ───────────────────────────────────────────────────────────────
const today = () => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}
const fmtHM = (t) => (t ? String(t).slice(0, 5) : '--:--')

const MESES_CORTOS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
const fmtDateShort = (iso) => {
  if (!iso) return ''
  try {
    const d = new Date(iso + 'T12:00:00')
    if (isNaN(d.getTime())) return ''
    return `${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`
  } catch { return '' }
}

const iniciales = (nombre) => {
  if (!nombre) return '??'
  return nombre.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

/** Normaliza tildes y baja a minúsculas para búsqueda insensible a acentos. */
const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

function useDebounced(value, delay = 250) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return v
}

const ESTADO_FILTERS = [
  { key: 'todas',       label: 'Todas' },
  { key: 'iniciadas',   label: 'Iniciadas' },
  { key: 'finalizadas', label: 'Finalizadas' },
]

// ─── Screen ────────────────────────────────────────────────────────────────
export default function TareoScreen({ navigation }) {
  const { user } = useAuthStore()
  const activeProjectId = useActiveProjectStore((s) => s.activeProjectId)
  const [fecha, setFecha] = useState(today())
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounced(query, 250)
  const [searchFocused, setSearchFocused] = useState(false)

  const [estadoFilter, setEstadoFilter] = useState('todas')

  const [selectedIds, setSelectedIds] = useState(new Set())
  const [finalizing, setFinalizing] = useState(false)

  const [toast, setToast] = useState(null)

  const canEdit = user?.role === 'admin' || user?.role === 'supervisor'
  const canFinalize = canEdit
  const isToday = fecha === today()

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const data = await actividadesApi.listar(fecha, { proyectoId: activeProjectId })
      setItems(data)
      setSelectedIds(new Set())
    } catch {
      setError('No se pudo cargar')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [fecha, activeProjectId])

  useFocusEffect(useCallback(() => { load() }, [load]))

  // ── Filtrado por query + estado ─────────────────────────────────────────
  const bySearch = useMemo(() => {
    const q = norm(debouncedQuery.trim())
    if (!q) return items
    return items.filter((it) =>
      norm(it.trabajador_nombre).includes(q) ||
      norm(it.desactividad).includes(q) ||
      norm(it.centro_costo_codigo).includes(q) ||
      norm(it.centro_costo_nombre).includes(q),
    )
  }, [items, debouncedQuery])

  const totalIniciadas = useMemo(
    () => bySearch.filter((it) => it.desestadoactividad === 'iniciado').length,
    [bySearch],
  )
  const totalFinalizadas = bySearch.length - totalIniciadas

  const filtered = useMemo(() => {
    if (estadoFilter === 'iniciadas') return bySearch.filter((it) => it.desestadoactividad === 'iniciado')
    if (estadoFilter === 'finalizadas') return bySearch.filter((it) => it.desestadoactividad !== 'iniciado')
    return bySearch
  }, [bySearch, estadoFilter])

  const iniciadasVisibles = useMemo(
    () => filtered.filter((it) => it.desestadoactividad === 'iniciado'),
    [filtered],
  )
  const iniciadasIds = useMemo(() => iniciadasVisibles.map((it) => it.id), [iniciadasVisibles])
  const allSelected =
    iniciadasVisibles.length > 0 &&
    iniciadasVisibles.every((it) => selectedIds.has(it.id))

  // ── Selección handlers ──────────────────────────────────────────────────
  const toggleOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        iniciadasIds.forEach((id) => next.delete(id))
        return next
      })
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        iniciadasIds.forEach((id) => next.add(id))
        return next
      })
    }
  }

  const showToast = (msg, kind = 'ok') => {
    setToast({ msg, kind })
    setTimeout(() => setToast(null), 2500)
  }

  const finalizarBatch = () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    Alert.alert(
      `Finalizar ${ids.length} ${ids.length === 1 ? 'actividad' : 'actividades'}`,
      '¿Confirmas que estas actividades ya terminaron? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, finalizar',
          style: 'destructive',
          onPress: async () => {
            setFinalizing(true)
            try {
              const res = await actividadesApi.finalizarBatch(ids)
              const n = res?.updated ?? ids.length
              showToast(`${n} ${n === 1 ? 'actividad finalizada' : 'actividades finalizadas'}`, 'ok')
              await load()
            } catch {
              showToast('No pudimos finalizar. Intenta de nuevo.', 'err')
            } finally {
              setFinalizing(false)
            }
          },
        },
      ],
    )
  }

  const changeDay = (delta) => {
    const d = new Date(fecha + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    setFecha(`${y}-${m}-${dd}`)
  }

  const emptyKind = useMemo(() => {
    if (items.length === 0) return 'no-day'
    if (bySearch.length === 0 && debouncedQuery.trim()) return 'no-search'
    if (filtered.length === 0 && estadoFilter !== 'todas') return 'no-estado'
    return null
  }, [items, bySearch, filtered, debouncedQuery, estadoFilter])

  // Cantidad de iniciadas visibles según el filtro activo
  // (se usa para habilitar/deshabilitar el botón Finalizar del bulk bar)
  const nSelected = selectedIds.size
  const bulkVisible = canFinalize && (iniciadasVisibles.length > 0 || nSelected > 0)

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Page header — título + chip de proyecto activo + count */}
      <View style={styles.pageHeader}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.pageTitle}>Registro de tareo</Text>
          <View style={styles.pageMetaRow}>
            <ActiveProjectChip />
            {items.length > 0 ? (
              <Text style={styles.pageSubtitle}>
                {items.length} {items.length === 1 ? 'actividad' : 'actividades'}
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      {/* Date bar */}
      <View style={styles.dateBar}>
        <Pressable
          onPress={() => changeDay(-1)}
          style={styles.arrowBtn}
          android_ripple={{ color: colors.surfaceSubtle, borderless: true }}
          accessibilityLabel="Día anterior"
        >
          <Icon name="chevronLeft" size={20} color={colors.text.secondary} />
        </Pressable>
        <View style={styles.dateFieldWrap}>
          <DateField value={fecha} onChange={setFecha} />
        </View>
        <Pressable
          onPress={() => changeDay(1)}
          style={styles.arrowBtn}
          android_ripple={{ color: colors.surfaceSubtle, borderless: true }}
          accessibilityLabel="Día siguiente"
        >
          <Icon name="chevronRight" size={20} color={colors.text.secondary} />
        </Pressable>
        <Pressable
          onPress={() => setFecha(today())}
          style={[styles.todayBtn, isToday && styles.todayBtnActive]}
          android_ripple={{ color: colors.brand[500] }}
        >
          <Text style={[styles.todayText, isToday && styles.todayTextActive]}>Hoy</Text>
        </Pressable>
      </View>

      {/* Search bar */}
      <View style={styles.searchWrap}>
        <View style={[styles.searchBar, searchFocused && styles.searchBarFocused]}>
          <Icon name="search" size={18} color={colors.text.tertiary} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar por trabajador, tarea o CC"
            placeholderTextColor={colors.text.muted}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            returnKeyType="search"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={12} style={styles.clearBtn}>
              <Icon name="x" size={14} color={colors.text.muted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Chips estado con contadores */}
      <View style={styles.chipsWrap}>
        {ESTADO_FILTERS.map((f) => {
          const active = estadoFilter === f.key
          const count = f.key === 'iniciadas'
            ? totalIniciadas
            : f.key === 'finalizadas'
              ? totalFinalizadas
              : bySearch.length
          return (
            <Pressable
              key={f.key}
              onPress={() => setEstadoFilter(f.key)}
              style={[styles.chip, active && styles.chipActive]}
              android_ripple={{ color: colors.surfaceSubtle }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
              <View style={[styles.chipCount, active && styles.chipCountActive]}>
                <Text style={[styles.chipCountText, active && styles.chipCountTextActive]}>{count}</Text>
              </View>
            </Pressable>
          )
        })}
      </View>

      {/* Bulk bar (patrón Appsmith): siempre visible cuando hay iniciadas */}
      {bulkVisible && (
        <View style={styles.bulkBar}>
          <Pressable
            onPress={toggleAll}
            style={styles.selectAllInline}
            android_ripple={{ color: colors.surfaceSubtle }}
            accessibilityLabel={allSelected ? 'Deseleccionar todas' : 'Seleccionar todas las iniciadas'}
            disabled={iniciadasVisibles.length === 0}
          >
            <View style={[
              styles.checkbox,
              allSelected && styles.checkboxOn,
              iniciadasVisibles.length === 0 && styles.checkboxDisabled,
            ]}>
              {allSelected ? <Text style={styles.checkboxTick}>✓</Text> : null}
            </View>
            <Text style={[
              styles.selectAllInlineText,
              iniciadasVisibles.length === 0 && { color: colors.text.muted },
            ]}>
              Seleccionar iniciadas
            </Text>
          </Pressable>

          <TouchableOpacity
            onPress={finalizarBatch}
            disabled={nSelected === 0 || finalizing}
            style={[
              styles.finalizeBulkBtn,
              (nSelected === 0 || finalizing) && styles.finalizeBulkBtnDisabled,
            ]}
          >
            {finalizing ? (
              <ActivityIndicator color={colors.text.inverse} />
            ) : (
              <>
                <Icon
                  name="check"
                  size={16}
                  color={nSelected === 0 ? colors.text.muted : colors.text.inverse}
                  strokeWidth={2.5}
                />
                <Text style={[
                  styles.finalizeBulkText,
                  nSelected === 0 && styles.finalizeBulkTextDisabled,
                ]}>
                  Finalizar {nSelected > 0 ? `(${nSelected})` : 'actividad'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* Lista */}
      {loading && items.length === 0 ? (
        <ActivityIndicator style={{ marginTop: spacing['3xl'] }} color={colors.brand[600]} />
      ) : emptyKind === 'no-day' ? (
        <EmptyDay canCreate={canEdit} onCreate={() => navigation.navigate('Nueva')} />
      ) : emptyKind === 'no-search' ? (
        <EmptySearch query={debouncedQuery} onClear={() => setQuery('')} />
      ) : emptyKind === 'no-estado' ? (
        <EmptyEstado filter={estadoFilter} onReset={() => setEstadoFilter('todas')} />
      ) : (
        <FlatList
          data={filtered}
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
          renderItem={({ item }) => {
            const iniciada = item.desestadoactividad === 'iniciado'
            const selected = selectedIds.has(item.id)
            const pastel = pastelFor(item.trabajador_nombre)
            const fechaCorta = fmtDateShort(item.fecactividad || fecha)
            return (
              <Pressable
                onPress={() => iniciada && canFinalize && toggleOne(item.id)}
                android_ripple={iniciada && canFinalize ? { color: colors.surfaceSubtle } : null}
                style={[styles.card, selected && styles.cardSelected]}
              >
                {/* Row 1: avatar + nombre + fecha (top-right, Gmail) */}
                <View style={styles.cardRow}>
                  <View style={styles.avatarWrap}>
                    <View style={[styles.avatar, { backgroundColor: pastel.bg }]}>
                      <Text style={[styles.avatarText, { color: pastel.fg }]}>
                        {iniciales(item.trabajador_nombre)}
                      </Text>
                    </View>
                    {selected && (
                      <View style={styles.avatarCheck}>
                        <Text style={styles.avatarCheckText}>✓</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.cardMain}>
                    <View style={styles.cardTopRow}>
                      <Text style={styles.trabajador} numberOfLines={1}>
                        {item.trabajador_nombre}
                      </Text>
                      <Text style={styles.dateTop}>{fechaCorta}</Text>
                    </View>

                    <Text style={styles.desc} numberOfLines={2}>{item.desactividad}</Text>

                    {/* Row 2: estado + hora + editar (bottom-right, Gmail) */}
                    <View style={styles.cardBottomRow}>
                      <View style={[
                        styles.badge,
                        iniciada ? styles.badgeIniciada : styles.badgeFinalizada,
                      ]}>
                        <View style={[
                          styles.badgeDot,
                          iniciada ? styles.badgeDotIniciada : styles.badgeDotFinalizada,
                        ]} />
                        <Text style={[
                          styles.badgeText,
                          iniciada ? { color: colors.success[700] } : { color: colors.text.secondary },
                        ]}>
                          {iniciada ? 'Iniciada' : 'Finalizada'}
                        </Text>
                      </View>
                      <Text style={styles.hora} numberOfLines={1}>
                        {fmtHM(item.horinicio)}{item.horfin ? ` → ${fmtHM(item.horfin)}` : ''}
                      </Text>
                      <View style={{ flex: 1 }} />
                      {canEdit && (
                        <TouchableOpacity
                          hitSlop={8}
                          onPress={() => navigation.navigate('EditarActividad', { actividadId: item.id })}
                        >
                          <Text style={styles.editLink}>Editar</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              </Pressable>
            )
          }}
        />
      )}

      {toast && <Toast msg={toast.msg} kind={toast.kind} />}
    </SafeAreaView>
  )
}

// ─── Toast ─────────────────────────────────────────────────────────────────
function Toast({ msg, kind }) {
  const opacity = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start()
  }, [opacity])
  const bg = kind === 'err' ? colors.danger[600] : colors.success[600]
  return (
    <Animated.View pointerEvents="none" style={[styles.toast, { backgroundColor: bg, opacity }]}>
      <Text style={styles.toastText}>{msg}</Text>
    </Animated.View>
  )
}

// ─── Empty states ──────────────────────────────────────────────────────────
function EmptyDay({ canCreate, onCreate }) {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconBig}>
        <Icon name="calendar" size={32} color={colors.brand[600]} />
      </View>
      <Text style={styles.emptyTitle}>Sin actividades este día</Text>
      <Text style={styles.emptyHint}>
        Nadie registró trabajo hoy. Prueba con otra fecha o crea una actividad nueva.
      </Text>
      {canCreate && (
        <TouchableOpacity onPress={onCreate} style={styles.emptyCta}>
          <Icon name="plus" size={16} color={colors.text.inverse} strokeWidth={2.25} />
          <Text style={styles.emptyCtaText}>Nueva actividad</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

function EmptySearch({ query, onClear }) {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconBig}>
        <Icon name="search" size={30} color={colors.text.tertiary} />
      </View>
      <Text style={styles.emptyTitle}>Sin resultados para "{query}"</Text>
      <Text style={styles.emptyHint}>
        Revisa cómo escribiste el nombre o prueba buscar por descripción del trabajo.
      </Text>
      <TouchableOpacity onPress={onClear}>
        <Text style={styles.linkAction}>Limpiar búsqueda</Text>
      </TouchableOpacity>
    </View>
  )
}

function EmptyEstado({ filter, onReset }) {
  const label = filter === 'iniciadas' ? 'iniciadas' : 'finalizadas'
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconBig}>
        <Icon name="list" size={30} color={colors.text.tertiary} />
      </View>
      <Text style={styles.emptyTitle}>No hay actividades {label}</Text>
      <Text style={styles.emptyHint}>Cambia el filtro para ver otras actividades.</Text>
      <TouchableOpacity onPress={onReset}>
        <Text style={styles.linkAction}>Ver todas</Text>
      </TouchableOpacity>
    </View>
  )
}

// ─── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  // Page header (título de la vista)
  pageHeader: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  pageTitle: { ...type.h1, color: colors.text.primary },
  pageMetaRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    marginTop: 6, flexWrap: 'wrap',
  },
  pageSubtitle: { ...type.caption, color: colors.text.tertiary, fontWeight: '600' },

  // Date bar
  dateBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface,
    paddingVertical: spacing.md, paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  arrowBtn: {
    width: 40, height: 40, borderRadius: radius.pill,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceSubtle,
  },
  dateFieldWrap: { flex: 1 },
  todayBtn: {
    height: 40, paddingHorizontal: spacing.base,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center', justifyContent: 'center',
  },
  todayBtnActive: { backgroundColor: colors.brand[600] },
  todayText: { ...type.label, color: colors.text.secondary, fontWeight: '600' },
  todayTextActive: { color: colors.text.inverse, fontWeight: '700' },

  // Search
  searchWrap: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
  },
  searchBar: {
    height: 44, paddingHorizontal: spacing.md,
    borderRadius: radius.md, backgroundColor: colors.surfaceSubtle,
    borderWidth: 1, borderColor: colors.border,
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
  },
  searchBarFocused: { backgroundColor: colors.surface, borderColor: colors.brand[600] },
  searchInput: { flex: 1, ...type.body, color: colors.text.primary, padding: 0 },
  clearBtn: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  // Chips estado
  chipsWrap: {
    flexDirection: 'row', gap: spacing.sm,
    paddingHorizontal: spacing.base, paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    height: 32, paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.brand[600], borderColor: colors.brand[600] },
  chipText: { ...type.caption, color: colors.text.secondary, fontWeight: '600' },
  chipTextActive: { color: colors.text.inverse, fontWeight: '700' },
  chipCount: {
    minWidth: 20, paddingHorizontal: 5, paddingVertical: 1,
    borderRadius: radius.pill, backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
  },
  chipCountActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  chipCountText: { fontSize: 10, fontWeight: '700', color: colors.text.tertiary, fontVariant: ['tabular-nums'] },
  chipCountTextActive: { color: colors.text.inverse },

  // Bulk bar (patrón Appsmith)
  bulkBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  selectAllInline: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: 6, paddingRight: spacing.md,
  },
  selectAllInlineText: { ...type.label, color: colors.text.secondary, fontWeight: '600' },
  finalizeBulkBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    height: 40, paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.brand[600],
    justifyContent: 'center', minWidth: 140,
  },
  finalizeBulkBtnDisabled: {
    backgroundColor: colors.surfaceSubtle,
  },
  finalizeBulkText: {
    ...type.label, color: colors.text.inverse, fontWeight: '700',
  },
  finalizeBulkTextDisabled: { color: colors.text.muted, fontWeight: '600' },

  error: {
    marginHorizontal: spacing.md, marginTop: spacing.md,
    padding: spacing.md, borderRadius: radius.md,
    backgroundColor: colors.danger[50], color: colors.danger[700],
    ...type.body,
  },

  // Card compacta Gmail-style
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1.5, borderColor: 'transparent',
    ...shadow.card,
  },
  cardSelected: {
    borderColor: colors.brand[600],
    backgroundColor: colors.brand[50],
  },
  cardRow: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  cardMain: { flex: 1, minWidth: 0 },

  // Avatar iniciales — reemplaza el checkbox/tick anterior
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },
  avatarCheck: {
    position: 'absolute', right: -2, bottom: -2,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.brand[600],
    borderWidth: 2, borderColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarCheckText: { color: colors.text.inverse, fontSize: 10, fontWeight: '900', lineHeight: 10 },

  // Bulk checkbox (barra top) — legacy, sigue usándose en Seleccionar todos
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1.5, borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.brand[600], borderColor: colors.brand[600] },
  checkboxDisabled: { borderColor: colors.border, backgroundColor: colors.surfaceSubtle },
  checkboxTick: { color: colors.text.inverse, fontSize: 13, fontWeight: '900', lineHeight: 13 },

  cardTopRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing.sm,
  },
  trabajador: { ...type.bodyStrong, fontSize: 14, color: colors.text.primary, flex: 1 },
  dateTop: {
    ...type.caption, fontSize: 11, color: colors.text.muted,
    fontWeight: '500', fontVariant: ['tabular-nums'],
  },

  desc: {
    ...type.body, fontSize: 13, lineHeight: 18,
    color: colors.text.secondary, marginTop: 2,
  },

  cardBottomRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginTop: spacing.sm,
  },
  editLink: { ...type.caption, color: colors.brand[600], fontWeight: '700', paddingVertical: 2 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: radius.pill,
  },
  badgeIniciada: { backgroundColor: colors.success[50] },
  badgeFinalizada: { backgroundColor: colors.surfaceSubtle },
  badgeDot: { width: 5, height: 5, borderRadius: 3 },
  badgeDotIniciada: { backgroundColor: colors.success[500] },
  badgeDotFinalizada: { backgroundColor: colors.text.muted },
  badgeText: { fontSize: 10, fontWeight: '700' },
  hora: { fontSize: 11, color: colors.text.tertiary, fontVariant: ['tabular-nums'] },

  toast: {
    position: 'absolute', bottom: 24, left: spacing.base, right: spacing.base,
    paddingVertical: 12, paddingHorizontal: 16,
    borderRadius: radius.md, alignItems: 'center',
    ...shadow.floating,
  },
  toastText: { color: colors.text.inverse, ...type.body, fontWeight: '600' },

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
    marginTop: spacing.xs, marginBottom: spacing.lg, maxWidth: 300,
  },
  emptyCta: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.brand[600],
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderRadius: radius.md, minHeight: 44,
  },
  emptyCtaText: { color: colors.text.inverse, ...type.body, fontWeight: '700' },
  linkAction: { ...type.body, color: colors.brand[600], fontWeight: '700', marginTop: spacing.sm },
})
