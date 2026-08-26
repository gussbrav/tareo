/**
 * PickerField — dropdown compacto que abre un bottom sheet con buscador.
 * Patrón premium para catálogos con muchos items (áreas, CCs, etc.).
 * Escala bien de 5 a 500 items — el buscador filtra client-side.
 *
 * Uso:
 *   <PickerField
 *     label="Área" required
 *     value={areaId}
 *     items={areas}
 *     valueKey="id" labelKey="display_name"
 *     onChange={setAreaId}
 *     placeholder="Elige un área"
 *     disabledMessage={!proyectoId && 'Elige un proyecto primero'}
 *   />
 */
import { useMemo, useState } from 'react'
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

import Icon from './Icons'
import { colors, radius, spacing, type } from '../theme'

export default function PickerField({
  label,
  required = false,
  value,
  items = [],
  valueKey = 'id',
  labelKey = 'label',
  onChange,
  placeholder = 'Selecciona…',
  disabledMessage,   // string — bloquea el picker si viene truthy
  searchable = true,
  emptyText = 'Sin resultados',
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const disabled = !!disabledMessage
  const selectedItem = useMemo(
    () => items.find((it) => it[valueKey] === value) || null,
    [items, valueKey, value],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((it) => String(it[labelKey] || '').toLowerCase().includes(q))
  }, [items, query, labelKey])

  const displayText = disabled
    ? disabledMessage
    : selectedItem?.[labelKey] || placeholder

  const handleSelect = (item) => {
    onChange?.(item[valueKey])
    setOpen(false)
    setQuery('')
  }

  return (
    <View>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.required}> *</Text> : null}
        </Text>
      ) : null}

      <Pressable
        onPress={() => !disabled && setOpen(true)}
        android_ripple={!disabled ? { color: colors.surfaceSubtle } : null}
        style={[
          styles.field,
          disabled && styles.fieldDisabled,
          selectedItem && !disabled && styles.fieldSelected,
        ]}
        accessibilityRole="button"
        accessibilityLabel={label || placeholder}
        accessibilityState={{ disabled }}
      >
        <Text
          style={[
            styles.value,
            !selectedItem && styles.placeholder,
            disabled && styles.disabledText,
            selectedItem && !disabled && styles.valueSelected,
          ]}
          numberOfLines={1}
        >
          {displayText}
        </Text>
        <Icon
          name="chevronDown"
          size={18}
          color={disabled ? colors.text.muted : colors.text.secondary}
        />
      </Pressable>

      {/* Bottom sheet modal */}
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
              <Text style={styles.sheetTitle} numberOfLines={1}>{label || 'Selecciona'}</Text>
              <Pressable
                onPress={() => setOpen(false)}
                hitSlop={12}
                style={styles.closeBtn}
                accessibilityLabel="Cerrar"
              >
                <Icon name="x" size={20} color={colors.text.secondary} />
              </Pressable>
            </View>

            {searchable && items.length > 8 && (
              <View style={styles.searchWrap}>
                <View style={styles.searchIconLeft}>
                  <Icon name="search" size={16} color={colors.text.tertiary} />
                </View>
                <TextInput
                  style={styles.searchInput}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Buscar…"
                  placeholderTextColor={colors.text.muted}
                  autoFocus
                  returnKeyType="search"
                />
                {query ? (
                  <Pressable onPress={() => setQuery('')} hitSlop={8} style={styles.clearBtn}>
                    <Icon name="x" size={14} color={colors.text.muted} />
                  </Pressable>
                ) : null}
              </View>
            )}

            <FlatList
              data={filtered}
              keyExtractor={(it) => String(it[valueKey])}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.listContent}
              ItemSeparatorComponent={() => <View style={styles.rowDivider} />}
              renderItem={({ item }) => {
                const active = item[valueKey] === value
                return (
                  <Pressable
                    onPress={() => handleSelect(item)}
                    android_ripple={{ color: colors.surfaceSubtle }}
                    style={[styles.row, active && styles.rowActive]}
                  >
                    <View style={[styles.radio, active && styles.radioActive]}>
                      {active ? <View style={styles.radioDot} /> : null}
                    </View>
                    <Text
                      style={[styles.rowText, active && styles.rowTextActive]}
                      numberOfLines={2}
                    >
                      {item[labelKey]}
                    </Text>
                    {active ? (
                      <Icon name="check" size={18} color={colors.brand[600]} />
                    ) : null}
                  </Pressable>
                )
              }}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>{emptyText}</Text>
                </View>
              }
            />
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  // ─── Field (botón que abre el sheet) ───────────────────────────────
  label: { ...type.label, color: colors.text.secondary, marginBottom: 6 },
  required: { color: colors.danger[500] },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  fieldSelected: { backgroundColor: colors.brand[50], borderColor: colors.brand[100] },
  fieldDisabled: { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
  value: { ...type.body, color: colors.text.primary, flex: 1 },
  valueSelected: { color: colors.brand[700], fontWeight: '600' },
  placeholder: { color: colors.text.muted, fontWeight: '400' },
  disabledText: { color: colors.text.muted, fontStyle: 'italic' },

  // ─── Backdrop + sheet ──────────────────────────────────────────────
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  sheetSafe: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    maxHeight: '85%',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: spacing.md,
    maxHeight: '100%',
  },
  handle: {
    alignSelf: 'center',
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: 8, marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSubtle,
  },
  sheetTitle: { ...type.h2, color: colors.text.primary, flex: 1 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center', justifyContent: 'center',
  },

  // ─── Search ─────────────────────────────────────────────────────────
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: spacing.lg, marginTop: spacing.md,
    height: 40,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  searchIconLeft: {},
  searchInput: { flex: 1, ...type.body, color: colors.text.primary, padding: 0 },
  clearBtn: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  // ─── List ───────────────────────────────────────────────────────────
  listContent: { paddingVertical: spacing.sm },
  rowDivider: { height: 1, backgroundColor: colors.surfaceSubtle, marginHorizontal: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
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
  empty: { padding: spacing['2xl'], alignItems: 'center' },
  emptyText: { ...type.body, color: colors.text.tertiary },
})
