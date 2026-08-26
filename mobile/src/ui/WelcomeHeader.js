import { StyleSheet, Text, View } from 'react-native'

import { colors, radius, spacing, type } from '../theme'

const ROLE_LABEL = {
  admin: 'ADMIN',
  supervisor: 'SUPERVISOR',
  trabajador: 'TRABAJADOR',
}

const ROLE_STYLE = {
  admin:      { bg: colors.brand[100],   fg: colors.brand[700] },
  supervisor: { bg: colors.info[100],    fg: colors.info[700] },
  trabajador: { bg: colors.success[100], fg: colors.success[700] },
}

export default function WelcomeHeader({ name, role = 'trabajador', logoUrl }) {
  const initials = (name || 'AD')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')

  const rolePalette = ROLE_STYLE[role] || ROLE_STYLE.trabajador
  const roleLabel = ROLE_LABEL[role] || 'USUARIO'

  return (
    <View style={styles.wrap}>
      <View style={styles.left}>
        <View style={styles.avatar}>
          {logoUrl ? (
            // Si el tenant subió logo, lo usamos como avatar del brand
            // eslint-disable-next-line react-native/no-inline-styles
            <View style={{ flex: 1, borderRadius: radius.pill, overflow: 'hidden' }}>
              <Text style={styles.avatarText}>{initials || 'AD'}</Text>
            </View>
          ) : (
            <Text style={styles.avatarText}>{initials || 'AD'}</Text>
          )}
        </View>
        <View style={styles.textCol}>
          <Text style={styles.greeting}>Bienvenido,</Text>
          <Text style={styles.name} numberOfLines={1}>{name || 'Usuario'}</Text>
        </View>
      </View>

      <View style={[styles.rolePill, { backgroundColor: rolePalette.bg }]}>
        <Text style={[styles.roleText, { color: rolePalette.fg }]}>{roleLabel}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.base,
    paddingBottom: spacing.base,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 },
  avatar: {
    width: 48, height: 48, borderRadius: radius.pill,
    backgroundColor: colors.info[500],
    alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: { ...type.h2, color: colors.text.inverse, textAlignVertical: 'center', textAlign: 'center' },
  textCol: { flex: 1, minWidth: 0 },
  greeting: { ...type.caption, color: colors.text.secondary },
  name: { ...type.h1, color: colors.text.primary, marginTop: 2 },
  rolePill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
    marginLeft: spacing.md,
  },
  roleText: { ...type.overline },
})
