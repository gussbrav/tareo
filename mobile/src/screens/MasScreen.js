/**
 * MasScreen — menú secundario (perfil, config, salir).
 * Los ítems visibles dependen del rol.
 */
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import WelcomeHeader from '../ui/WelcomeHeader'
import { api } from '../api/client'
import { useAuthStore } from '../store/auth'
import { colors, motion, radius, shadow, spacing, type } from '../theme'

export default function MasScreen({ navigation }) {
  const { user, refreshToken, logout } = useAuthStore()

  const handleLogout = () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Estás seguro de que quieres salir?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: async () => {
            try {
              if (refreshToken) {
                await api.post('/api/auth/logout', { refresh_token: refreshToken })
              }
            } catch {
              /* silencioso */
            }
            await logout()
          },
        },
      ],
    )
  }

  const items = [
    {
      key: 'perfil',
      icon: '👤',
      label: 'Mi cuenta',
      hint: user?.email || '',
      onPress: () => Alert.alert('Mi cuenta', 'Sección disponible pronto.'),
    },
    {
      key: 'ayuda',
      icon: '?',
      label: 'Ayuda y soporte',
      hint: 'gussbrav@gmail.com',
      onPress: () => Alert.alert('Soporte', 'Contacto: gussbrav@gmail.com'),
    },
    {
      key: 'about',
      icon: 'ℹ',
      label: 'Acerca de',
      hint: 'Tareo v0.1.0 · Azoramind',
      onPress: () => Alert.alert('Azoramind Tareo', 'Versión 0.1.0\n\nwww.azoramind.com'),
    },
  ]

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <WelcomeHeader
          name={user?.first_name || user?.email?.split('@')[0]}
          role={user?.role || 'trabajador'}
        />

        <View style={styles.list}>
          {items.map((it, i) => (
            <TouchableOpacity
              key={it.key}
              onPress={it.onPress}
              activeOpacity={motion.press.activeOpacity}
              style={[styles.row, i === items.length - 1 && { borderBottomWidth: 0 }]}
              accessibilityRole="button"
              accessibilityLabel={it.label}
            >
              <View style={styles.rowIcon}><Text style={styles.rowIconText}>{it.icon}</Text></View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{it.label}</Text>
                {it.hint ? <Text style={styles.rowHint} numberOfLines={1}>{it.hint}</Text> : null}
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          onPress={handleLogout}
          style={styles.logoutBtn}
          activeOpacity={motion.press.activeOpacity}
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión"
        >
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>Azoramind Tareo · v0.1.0</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: spacing['4xl'] },
  list: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    ...shadow.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 56,
  },
  rowIcon: {
    width: 40, height: 40, borderRadius: radius.pill,
    backgroundColor: colors.brand[50],
    alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.md,
  },
  rowIconText: { color: colors.brand[600], fontSize: 18, fontWeight: '700' },
  rowText: { flex: 1 },
  rowLabel: { ...type.bodyStrong, color: colors.text.primary },
  rowHint: { ...type.caption, color: colors.text.tertiary, marginTop: 2 },
  chevron: { color: colors.text.muted, fontSize: 24, fontWeight: '300', marginLeft: spacing.sm },
  logoutBtn: {
    marginTop: spacing.xl,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger[100],
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  logoutText: { ...type.bodyStrong, color: colors.danger[600] },
  footer: {
    ...type.caption,
    color: colors.text.muted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
})
