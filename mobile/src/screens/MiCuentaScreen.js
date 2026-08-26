/**
 * MiCuentaScreen — perfil del usuario. Datos read-only + cerrar sesión.
 * La edición de contraseña/perfil se hace en la web (Configuración → Usuarios).
 */
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Constants from 'expo-constants'

import { api } from '../api/client'
import { useAuthStore } from '../store/auth'
import { colors, radius, shadow, spacing, type } from '../theme'
import Icon from '../ui/Icons'

const WEB_BASE =
  Constants.expoConfig?.extra?.apiBaseUrl?.replace(/\/$/, '') ||
  'https://tareo.azoramind.com'

const ROLE_META = {
  admin:      { label: 'Administrador', palette: colors.brand },
  supervisor: { label: 'Supervisor',    palette: colors.info },
  trabajador: { label: 'Trabajador',    palette: colors.success },
}

export default function MiCuentaScreen({ navigation }) {
  const { user, refreshToken, logout } = useAuthStore()
  const isAdmin = user?.role === 'admin'

  const fullName =
    [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() ||
    user?.email?.split('@')[0] ||
    'Usuario'
  const initials = fullName
    .split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()

  const roleMeta = ROLE_META[user?.role] || ROLE_META.trabajador

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
            } catch { /* silencioso */ }
            await logout()
          },
        },
      ],
    )
  }

  const openWebProfile = () => {
    const url = `${WEB_BASE}/configuracion`
    Linking.openURL(url).catch(() =>
      Alert.alert('No se pudo abrir', `Copia esta dirección:\n\n${url}`),
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Hero: avatar grande + nombre + rol */}
        <View style={styles.hero}>
          <View style={[styles.avatar, { backgroundColor: roleMeta.palette[100] }]}>
            <Text style={[styles.avatarText, { color: roleMeta.palette[700] }]}>{initials}</Text>
          </View>
          <Text style={styles.name} numberOfLines={1}>{fullName}</Text>
          {user?.email ? <Text style={styles.emailLine} numberOfLines={1}>{user.email}</Text> : null}
          <View style={[styles.rolePill, { backgroundColor: roleMeta.palette[50] || roleMeta.palette[100] }]}>
            <View style={[styles.roleDot, { backgroundColor: roleMeta.palette[600] }]} />
            <Text style={[styles.roleText, { color: roleMeta.palette[700] }]}>{roleMeta.label}</Text>
          </View>
        </View>

        {/* Datos personales */}
        <Text style={styles.sectionOverline}>Datos de la cuenta</Text>
        <View style={styles.card}>
          <InfoRow icon="mail" label="Correo" value={user?.email || '—'} />
          <Divider />
          <InfoRow icon="user" label="Nombre" value={fullName} />
          <Divider />
          <InfoRow icon="shield" label="Rol" value={roleMeta.label} />
        </View>

        {isAdmin && (
          <>
            <Text style={styles.sectionOverline}>Editar perfil</Text>
            <View style={styles.card}>
              <Pressable
                onPress={openWebProfile}
                android_ripple={{ color: colors.surfaceSubtle }}
                style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
              >
                <View style={styles.actionIcon}>
                  <Icon name="settings" size={18} color={colors.brand[600]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionLabel}>Configurar cuenta y contraseña</Text>
                  <Text style={styles.actionHint}>Se abre en el navegador web</Text>
                </View>
                <Icon name="chevronRight" size={16} color={colors.text.muted} />
              </Pressable>
            </View>
          </>
        )}

        <Pressable
          onPress={handleLogout}
          android_ripple={{ color: colors.danger[100] }}
          style={({ pressed }) => [
            styles.logoutBtn,
            pressed && { backgroundColor: colors.danger[50] },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión"
        >
          <Icon name="logOut" size={18} color={colors.danger[600]} strokeWidth={1.75} />
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Icon name={icon} size={16} color={colors.text.tertiary} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
      </View>
    </View>
  )
}

function Divider() {
  return <View style={styles.divider} />
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: spacing['4xl'] },

  // Hero
  hero: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: { fontSize: 30, fontWeight: '700', letterSpacing: 0.5 },
  name: { ...type.h1, color: colors.text.primary, textAlign: 'center' },
  emailLine: { ...type.caption, color: colors.text.tertiary, marginTop: 4 },
  rolePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: radius.pill,
  },
  roleDot: { width: 6, height: 6, borderRadius: 3 },
  roleText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },

  // Sections
  sectionOverline: {
    ...type.overline,
    color: colors.text.tertiary,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  card: {
    marginHorizontal: spacing.base,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.card,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.base,
    minHeight: 60,
  },
  infoIcon: {
    width: 32, height: 32, borderRadius: radius.pill,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center', justifyContent: 'center',
  },
  infoLabel: { ...type.caption, color: colors.text.tertiary },
  infoValue: { ...type.body, color: colors.text.primary, marginTop: 2, fontWeight: '500' },
  divider: { height: 1, backgroundColor: colors.surfaceSubtle, marginLeft: spacing.base + 32 + spacing.md },

  // Action rows (admin edit)
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.base, minHeight: 60,
  },
  actionRowPressed: { backgroundColor: colors.surfaceSubtle },
  actionIcon: {
    width: 40, height: 40, borderRadius: radius.pill,
    backgroundColor: colors.brand[50],
    alignItems: 'center', justifyContent: 'center',
  },
  actionLabel: { ...type.bodyStrong, color: colors.text.primary },
  actionHint: { ...type.caption, color: colors.text.tertiary, marginTop: 2 },

  // Logout
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    marginHorizontal: spacing.base,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger[100],
    paddingVertical: spacing.md + 2,
    minHeight: 48,
  },
  logoutText: { ...type.bodyStrong, color: colors.danger[600] },
})
