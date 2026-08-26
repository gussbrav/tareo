/**
 * ActiveProjectChip — chip compacto que muestra el "Proyecto activo"
 * y abre un bottom sheet para cambiarlo.
 *
 * Paridad con ActiveProjectPicker del topbar web. En mobile va en el
 * page header de las 3 pantallas de listado (Home / Tareo / Agenda).
 *
 * Visibilidad: solo si el user tiene ≥ 2 proyectos accesibles.
 * Con 0 o 1 no aporta al UX (mismo criterio que la web).
 */
import { useEffect, useMemo, useState } from 'react'
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { catalogosApi } from '../api/actividades'
import { useActiveProjectStore } from '../store/project'
import { colors, radius, spacing, type } from '../theme'
import Icon from './Icons'

const labelOf = (p) =>
  p?.descontratoproyecto || p?.nbrproyecto || (p ? `Código ${p.codproyecto}` : '')

export default function ActiveProjectChip() {
  const [proyectos, setProyectos] = useState([])
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const { activeProjectId, setActiveProjectId } = useActiveProjectStore()

  useEffect(() => {
    catalogosApi.proyectos().then(setProyectos).catch(() => setProyectos([]))
  }, [])

  // Auto-limpieza defensiva: si el user perdió acceso al proyecto activo
  // (permisos revocados), reseteamos para no mostrar un nombre viejo.
  useEffect(() => {
    if (activeProjectId && proyectos.length > 0) {
      const stillAccessible = proyectos.some((p) => p.id === activeProjectId)
      if (!stillAccessible) setActiveProjectId(null)
    }
  }, [proyectos, activeProjectId, setActiveProjectId])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return proyectos
    return proyectos.filter((p) => labelOf(p).toLowerCase().includes(q))
  }, [proyectos, query])

  // Oculto si solo hay 0 o 1 proyecto — no aporta al UX.
  if (proyectos.length < 2) return null

  const active = proyectos.find((p) => p.id === activeProjectId) || null
  const chipLabel = active ? labelOf(active) : 'Todos los proyectos'

  const handleSelect = (id) => {
    setActiveProjectId(id)
    setOpen(false)
    setQuery('')
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        android_ripple={{ color: colors.brand[100] }}
        style={styles.chip}
        accessibilityLabel={`Proyecto activo: ${chipLabel}. Toca para cambiar.`}
        accessibilityRole="button"
      >
        <Icon name="clipboardCheck" size={13} color={colors.brand[600]} strokeWidth={1.75} />
        <Text style={styles.chipText} numberOfLines={1}>{chipLabel}</Text>
        <Icon name="chevronDown" size={14} color={colors.brand[600]} />
      </Pressable>

      <Modal
        transparent
        visible={open}
        animationType="slide"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <SafeAreaView style={styles.sheetSafe} edges={['bottom']}>
          <View style={styles.sheet}>
            <View style={styles.handle} />

            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Proyecto activo</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={12} style={styles.closeBtn}>
                <Icon name="x" size={18} color={colors.text.secondary} />
              </Pressable>
            </View>

            {proyectos.length > 6 && (
              <View style={styles.searchWrap}>
                <Icon name="search" size={16} color={colors.text.tertiary} />
                <TextInput
                  style={styles.searchInput}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Buscar proyecto…"
                  placeholderTextColor={colors.text.muted}
                  autoFocus
                />
              </View>
            )}

            <FlatList
              data={[{ id: '__all__', __label: 'Todos los proyectos' }, ...filtered]}
              keyExtractor={(it) => it.id || '__all__'}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingVertical: spacing.sm }}
              ItemSeparatorComponent={() => <View style={styles.rowDivider} />}
              renderItem={({ item }) => {
                const isAllRow = item.id === '__all__'
                const idForSelect = isAllRow ? null : item.id
                const label = isAllRow ? item.__label : labelOf(item)
                const isActive = isAllRow ? activeProjectId === null : item.id === activeProjectId
                return (
                  <Pressable
                    onPress={() => handleSelect(idForSelect)}
                    android_ripple={{ color: colors.surfaceSubtle }}
                    style={[styles.row, isActive && styles.rowActive]}
                  >
                    <View style={[styles.radio, isActive && styles.radioActive]}>
                      {isActive ? <View style={styles.radioDot} /> : null}
                    </View>
                    <Text style={[styles.rowText, isActive && styles.rowTextActive]} numberOfLines={2}>
                      {label}
                    </Text>
                    {isActive ? <Icon name="check" size={18} color={colors.brand[600]} /> : null}
                  </Pressable>
                )
              }}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  // Chip compacto para el header
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.brand[50],
    borderWidth: 1, borderColor: colors.brand[100],
    maxWidth: 220,
  },
  chipText: {
    ...type.caption, fontSize: 12, fontWeight: '700',
    color: colors.brand[700], flexShrink: 1,
  },

  // Sheet
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.45)' },
  sheetSafe: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '85%' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: spacing.md, maxHeight: '100%',
  },
  handle: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: 8, marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.surfaceSubtle,
  },
  sheetTitle: { ...type.h2, color: colors.text.primary },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center', justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginHorizontal: spacing.lg, marginTop: spacing.md,
    height: 40,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  searchInput: { flex: 1, ...type.body, color: colors.text.primary, padding: 0 },
  rowDivider: { height: 1, backgroundColor: colors.surfaceSubtle, marginHorizontal: spacing.lg },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: 14,
    minHeight: 52,
  },
  rowActive: { backgroundColor: colors.brand[50] },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: colors.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: colors.brand[600] },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand[600] },
  rowText: { ...type.body, color: colors.text.primary, flex: 1 },
  rowTextActive: { color: colors.brand[700], fontWeight: '600' },
})
