/**
 * TareoScreen — lista del día con búsqueda y finalización masiva.
 *
 * Header sticky: date bar + search bar (siempre visible) + select-all bar
 * (aparece cuando hay ≥2 iniciadas en el resultado filtrado).
 *
 * Cards: checkbox 24×24 a la izquierda para iniciadas, checkmark verde para
 * finalizadas. Card seleccionada con borde brand + tint brand-50.
 *
 * Batch action bar sticky bottom: aparece slide-up cuando hay N seleccionadas
 * con "Cancelar · N seleccionadas · Finalizar (N)". Confirma con Alert.
 * Feedback: Toast bottom 2.5 s en éxito / error.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

import { actividadesApi } from '../api/actividades'
import { useAuthStore } from '../store/auth'
import { colors, radius, shadow, spacing, type } from '../theme'
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

/** Normaliza tildes y baja a minúsculas para búsqueda insensible a acentos. */
const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

// Hook de debounce simple — evita re-render por cada tecla al buscar.
function useDebounced(value, delay = 250) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return v
}

// ─── Screen ────────────────────────────────────────────────────────────────
export default function TareoScreen({ navigation }) {
  const { user } = useAuthStore()
  const insets = useSafeAreaInsets()
  const [fecha, setFecha] = useState(today())
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  // Search
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounced(query, 250)
  const [searchFocused, setSearchFocused] = useState(false)

  // Selección múltiple (solo iniciadas)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [finalizing, setFinalizing] = useState(false)

  // Toast
  const [toast, setToast] = useState(null) // { msg, kind: 'ok'|'err' }

  const canEdit = user?.role === 'admin' || user?.role === 'supervisor'
  const canFinalize = canEdit
  const isToday = fecha === today()

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const data = await actividadesApi.listar(fecha)
      setItems(data)
      setSelectedIds(new Set())
    } catch {
      setError('No se pudo cargar')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [fecha])

  useFocusEffect(useCallback(() => { load() }, [load]))

  // ── Filtrado por búsqueda ────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = norm(debouncedQuery.trim())
    if (!q) return items
    return items.filter((it) =>
      norm(it.trabajador_nombre).includes(q) ||
      norm(it.desactividad).includes(q) ||
      norm(it.centro_costo_codigo).includes(q) ||
      norm(it.centro_costo_nombre).includes(q),
    )
  }, [items, debouncedQuery])

  const iniciadasVisibles = useMemo(
    () => filtered.filter((it) => it.desestadoactividad === 'iniciado'),
    [filtered],
  )
  const iniciadasIds = useMemo(
    () => iniciadasVisibles.map((it) => it.id),
    [iniciadasVisibles],
  )
  const allSelected =
    iniciadasVisibles.length > 0 &&
    iniciadasVisibles.every((it) => selectedIds.has(it.id))

  // ── Selección handlers ──────────────────────────────────────────────────
  const toggleOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const toggleAll = () => {
    if (allSelected) {
      // Deselecciona solo las visibles (mantiene otras del set)
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
  const clearSelection = () => setSelectedIds(new Set())

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

  const finalizeOne = async (id) => {
    try {
      await actividadesApi.finalizarUna(id)
      showToast('Actividad finalizada', 'ok')
      load()
    } catch {
      showToast('No pudimos finalizar. Intenta de nuevo.', 'err')
    }
  }

  const changeDay = (delta) => {
    const d = new Date(fecha + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    setFecha(`${y}-${m}-${dd}`)
  }

  // Empty state selector
  const emptyKind = useMemo(() => {
    if (items.length === 0) return 'no-day'
    if (filtered.length === 0 && debouncedQuery.trim()) return 'no-search'
    return null
  }, [items, filtered, debouncedQuery])

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
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

      {/* Select-all bar — solo si hay ≥2 iniciadas visibles */}
      {canFinalize && iniciadasVisibles.length >= 2 && (
        <Pressable
          onPress={toggleAll}
          style={styles.selectAllBar}
          android_ripple={{ color: colors.surfaceSubtle }}
          accessibilityLabel={allSelected ? 'Deseleccionar todas' : 'Seleccionar todas las iniciadas'}
        >
          <View style={[styles.checkbox, allSelected && styles.checkboxOn]}>
            {allSelected ? <Text style={styles.checkboxTick}>✓</Text> : null}
          </View>
          <Text style={styles.selectAllText}>
            {allSelected ? 'Deseleccionar todas' : 'Seleccionar todas'} ({iniciadasVisibles.length})
          </Text>
        </Pressable>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* Lista */}
      {loading && items.length === 0 ? (
        <ActivityIndicator style={{ marginTop: spacing['3xl'] }} color={colors.brand[600]} />
      ) : emptyKind === 'no-day' ? (
        <EmptyDay canCreate={canEdit} onCreate={() => navigation.navigate('Nueva')} />
      ) : emptyKind === 'no-search' ? (
        <EmptySearch query={debouncedQuery} onClear={() => setQuery('')} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{
            padding: spacing.md,
            paddingBottom: selectedIds.size > 0 ? 120 : spacing['4xl'],
          }}
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
            return (
              <Pressable
                onPress={() => iniciada && canFinalize && toggleOne(item.id)}
                android_ripple={iniciada && canFinalize ? { color: colors.surfaceSubtle } : null}
                style={[styles.card, selected && styles.cardSelected]}
              >
                <View style={styles.cardBody}>
                  {/* Checkbox / check final */}
                  {canFinalize && iniciada ? (
                    <View style={[styles.checkbox, selected && styles.checkboxOn]}>
                      {selected ? <Text style={styles.checkboxTick}>✓</Text> : null}
                    </View>
                  ) : !iniciada ? (
                    <View style={styles.doneMark}>
                      <Text style={styles.doneMarkText}>✓</Text>
                    </View>
                  ) : null}

                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.trabajador} numberOfLines={1}>
                        {item.trabajador_nombre}
                      </Text>
                      {canEdit && (
                        <TouchableOpacity
                          hitSlop={8}
                          onPress={() => navigation.navigate('EditarActividad', { actividadId: item.id })}
                        >
                          <Text style={styles.editLink}>Editar</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <Text style={styles.desc} numberOfLines={3}>{item.desactividad}</Text>
                    <View style={styles.meta}>
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
                      <Text style={styles.hora}>
                        {fmtHM(item.horinicio)}{item.horfin ? ` → ${fmtHM(item.horfin)}` : ''}
                      </Text>
                    </View>

                    {/* Finalizar single — solo si hay 0 selected y es iniciada */}
                    {iniciada && canFinalize && selectedIds.size === 0 && (
                      <TouchableOpacity style={styles.finalizeBtn} onPress={() => finalizeOne(item.id)}>
                        <Text style={styles.finalizeBtnText}>Finalizar</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </Pressable>
            )
          }}
        />
      )}

      {/* Batch action bar sticky bottom */}
      {selectedIds.size > 0 && (
        <BatchBar
          count={selectedIds.size}
          onCancel={clearSelection}
          onConfirm={finalizarBatch}
          finalizing={finalizing}
          insetsBottom={insets.bottom}
        />
      )}

      {/* Toast */}
      {toast && <Toast msg={toast.msg} kind={toast.kind} />}
    </SafeAreaView>
  )
}

// ─── BatchBar ──────────────────────────────────────────────────────────────
function BatchBar({ count, onCancel, onConfirm, finalizing, insetsBottom }) {
  const slide = useRef(new Animated.Value(80)).current
  useEffect(() => {
    Animated.timing(slide, {
      toValue: 0, duration: 200, easing: Easing.out(Easing.ease), useNativeDriver: true,
    }).start()
  }, [slide])

  return (
    <Animated.View
      style={[
        styles.batchBar,
        {
          paddingBottom: 12 + insetsBottom,
          transform: [{ translateY: slide }],
        },
      ]}
    >
      <TouchableOpacity onPress={onCancel} disabled={finalizing} hitSlop={8}>
        <Text style={styles.batchCancel}>Cancelar</Text>
      </TouchableOpacity>
      <Text style={styles.batchCount}>
        {count} {count === 1 ? 'seleccionada' : 'seleccionadas'}
      </Text>
      <TouchableOpacity
        onPress={onConfirm}
        style={[styles.batchConfirm, finalizing && { opacity: 0.6 }]}
        disabled={finalizing}
      >
        {finalizing ? (
          <ActivityIndicator color={colors.text.inverse} />
        ) : (
          <Text style={styles.batchConfirmText}>Finalizar ({count})</Text>
        )}
      </TouchableOpacity>
    </Animated.View>
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

// ─── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  // ── Date bar
  dateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
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

  // ── Search
  searchWrap: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
  },
  searchBar: {
    height: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1, borderColor: colors.border,
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
  },
  searchBarFocused: {
    backgroundColor: colors.surface,
    borderColor: colors.brand[600],
  },
  searchInput: {
    flex: 1, ...type.body,
    color: colors.text.primary, padding: 0,
  },
  clearBtn: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Select-all bar
  selectAllBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.base + 4,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  selectAllText: { ...type.label, color: colors.text.secondary, fontWeight: '600' },

  error: {
    marginHorizontal: spacing.md, marginTop: spacing.md,
    padding: spacing.md, borderRadius: radius.md,
    backgroundColor: colors.danger[50], color: colors.danger[700],
    ...type.body,
  },

  // ── Card
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    borderWidth: 1.5, borderColor: 'transparent',
    ...shadow.card,
  },
  cardSelected: {
    borderColor: colors.brand[600],
    backgroundColor: colors.brand[50],
  },
  cardBody: {
    flexDirection: 'row',
    padding: spacing.base,
    gap: spacing.md,
  },

  // ── Checkbox (iniciada) / check (finalizada)
  checkbox: {
    width: 24, height: 24, borderRadius: 6,
    borderWidth: 1.5, borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  checkboxOn: {
    backgroundColor: colors.brand[600],
    borderColor: colors.brand[600],
  },
  checkboxTick: { color: colors.text.inverse, fontSize: 14, fontWeight: '900', lineHeight: 14 },
  doneMark: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.success[50],
    alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  doneMarkText: { color: colors.success[600], fontSize: 14, fontWeight: '900', lineHeight: 14 },

  rowBetween: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    gap: spacing.sm,
  },
  trabajador: { ...type.bodyStrong, color: colors.text.primary, flex: 1 },
  editLink: { ...type.caption, color: colors.brand[600], fontWeight: '700' },
  desc: { ...type.body, color: colors.text.secondary, marginTop: spacing.xs + 2 },
  meta: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: spacing.md, gap: spacing.md, flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.pill,
  },
  badgeIniciada: { backgroundColor: colors.success[50] },
  badgeFinalizada: { backgroundColor: colors.surfaceSubtle },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeDotIniciada: { backgroundColor: colors.success[500] },
  badgeDotFinalizada: { backgroundColor: colors.text.muted },
  badgeText: { fontSize: 11, fontWeight: '700' },
  hora: { ...type.caption, color: colors.text.tertiary, fontVariant: ['tabular-nums'] },

  finalizeBtn: {
    marginTop: spacing.md, backgroundColor: colors.brand[600],
    borderRadius: radius.md, paddingVertical: 10, alignItems: 'center',
    minHeight: 40, justifyContent: 'center',
  },
  finalizeBtnText: { ...type.label, color: colors.text.inverse, fontWeight: '700' },

  // ── Batch bar
  batchBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: spacing.base, paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 12,
  },
  batchCancel: { ...type.body, color: colors.text.secondary, paddingVertical: 8, paddingHorizontal: 4 },
  batchCount: { ...type.caption, color: colors.text.secondary, fontWeight: '600' },
  batchConfirm: {
    backgroundColor: colors.brand[600],
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderRadius: radius.md, minHeight: 44, minWidth: 140,
    alignItems: 'center', justifyContent: 'center',
  },
  batchConfirmText: { ...type.body, color: colors.text.inverse, fontWeight: '700' },

  // ── Toast
  toast: {
    position: 'absolute', bottom: 100, left: spacing.base, right: spacing.base,
    paddingVertical: 12, paddingHorizontal: 16,
    borderRadius: radius.md,
    alignItems: 'center',
    ...shadow.floating,
  },
  toastText: { color: colors.text.inverse, ...type.body, fontWeight: '600' },

  // ── Empty states
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
  emptyCtaText: { color: colors.text.inverse, ...type.body, fontWeight: '700' },
  linkAction: { ...type.body, color: colors.brand[600], fontWeight: '700', marginTop: spacing.sm },
})
