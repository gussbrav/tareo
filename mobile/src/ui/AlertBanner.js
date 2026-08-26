import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { colors, motion, radius, spacing, type } from '../theme'

const VARIANTS = {
  danger: {
    bg: colors.danger[50], border: colors.danger[500],
    title: colors.danger[700], body: colors.danger[700], icon: '⚠',
  },
  warning: {
    bg: colors.warning[50], border: colors.warning[500],
    title: colors.warning[700], body: colors.warning[700], icon: '!',
  },
  info: {
    bg: colors.info[50], border: colors.info[500],
    title: colors.info[700], body: colors.info[700], icon: 'ⓘ',
  },
}

/**
 * Banner de alerta con jerarquía: icono + título + preview items + CTA.
 * items: [{ label, meta }]  — se muestran los primeros 2 y "+N más →".
 */
export default function AlertBanner({
  variant = 'danger',
  title,
  items = [],
  onPress,
  ctaLabel = 'Ver detalle →',
}) {
  const v = VARIANTS[variant] || VARIANTS.danger
  const previewItems = items.slice(0, 2)
  const remainingCount = items.length - previewItems.length

  return (
    <TouchableOpacity
      activeOpacity={motion.press.activeOpacity}
      onPress={onPress}
      style={[styles.wrap, { backgroundColor: v.bg, borderLeftColor: v.border }]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.icon, { color: v.title }]}>{v.icon}</Text>
        <Text style={[styles.title, { color: v.title }]} numberOfLines={2}>{title}</Text>
      </View>

      {previewItems.length > 0 && (
        <View style={styles.itemsCol}>
          {previewItems.map((it, i) => (
            <Text key={i} style={styles.itemText} numberOfLines={1}>
              {it.label}
              {it.meta ? <Text style={styles.itemMeta}>  ·  {it.meta}</Text> : null}
            </Text>
          ))}
          {remainingCount > 0 && (
            <Text style={[styles.cta, { color: v.title }]}>
              +{remainingCount} más  →
            </Text>
          )}
        </View>
      )}

      {previewItems.length === 0 && onPress && (
        <Text style={[styles.cta, { color: v.title, marginTop: spacing.sm }]}>{ctaLabel}</Text>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.lg,
    borderLeftWidth: 3,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.base,
    marginHorizontal: spacing.lg,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  icon: { fontSize: 18, lineHeight: 22, fontWeight: '700', width: 18, textAlign: 'center' },
  title: { ...type.bodyStrong, flex: 1 },
  itemsCol: { marginTop: spacing.sm, marginLeft: spacing.md + 18 + spacing.md },
  itemText: { ...type.body, color: colors.text.primary, marginTop: 2 },
  itemMeta: { color: colors.text.tertiary, ...type.caption },
  cta: { ...type.label, marginTop: spacing.sm, fontWeight: '700' },
})
