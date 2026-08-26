/**
 * MasScreen — menú secundario. Cards estilo Gmail: iconos circulares en
 * bg blue-50, títulos bold, subtítulos muted, chevron ligero, divider
 * alineado al texto (no full-bleed).
 *
 * Sección "Administración" visible solo para admin, con paridad al panel
 * Configuración de la web (link al navegador — el CRUD complejo vive allá).
 */
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Constants from 'expo-constants'

import WelcomeHeader from '../ui/WelcomeHeader'
import Icon from '../ui/Icons'
import SectionTitle from '../ui/SectionTitle'
import { api } from '../api/client'
import { useAuthStore } from '../store/auth'
import { colors, radius, shadow, spacing, type } from '../theme'

const APP_VERSION = '0.6.0'
const WEB_BASE =
  Constants.expoConfig?.extra?.apiBaseUrl?.replace(/\/$/, '') ||
  'https://tareo.azoramind.com'

export default function MasScreen({ navigation }) {
  const { user, refreshToken, logout } = useAuthStore()
  const isAdmin = user?.role === 'admin'

  const openInBrowser = (path) => {
    const url = `${WEB_BASE}${path}`
    Linking.openURL(url).catch(() =>
      Alert.alert('No se pudo abrir', `Copia esta dirección en tu navegador:\n\n${url}`),
    )
  }

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

  const openSupportEmail = () => {
    const subject = encodeURIComponent(`Tareo v${APP_VERSION} — Soporte`)
    Linking.openURL(`mailto:soporte@azoramind.com?subject=${subject}`).catch(() => {
      Alert.alert('Contactar soporte', 'Escríbenos a soporte@azoramind.com')
    })
  }

  const generalItems = [
    {
      key: 'reportes',
      icon: 'barChart',
      label: 'Reportes',
      hint: 'Ranking de horas y trabajadores',
      onPress: () => navigation.navigate('Reportes'),
    },
    {
      key: 'perfil',
      icon: 'user',
      label: 'Mi cuenta',
      hint: user?.email || 'Datos de tu perfil',
      onPress: () => Alert.alert('Mi cuenta', 'Sección disponible pronto.'),
    },
    {
      key: 'ayuda',
      icon: 'helpCircle',
      label: 'Ayuda y soporte',
      hint: 'Te respondemos en 24 h hábiles',
      onPress: openSupportEmail,
    },
    {
      key: 'about',
      icon: 'info',
      label: 'Acerca de',
      hint: `Tareo v${APP_VERSION} · Azoramind`,
      onPress: () =>
        Alert.alert(
          'Azoramind Tareo',
          `Versión ${APP_VERSION}\n\nControl de horas hombre y actividades.\n\nwww.azoramind.com`,
        ),
    },
  ]

  // Paridad con /configuracion de la web. El CRUD masivo vive en la web
  // (mejor experiencia con teclado); aquí damos accesos rápidos con
  // deep-link al panel.
  const adminItems = [
    {
      key: 'cfg-general',
      icon: 'info',
      label: 'Estado del sistema',
      hint: 'Servicios y versión',
      onPress: () => openInBrowser('/configuracion'),
    },
    {
      key: 'cfg-marca',
      icon: 'helpCircle',
      label: 'Marca y configuración',
      hint: 'Logo, colores, empresa',
      onPress: () => openInBrowser('/configuracion'),
    },
    {
      key: 'cfg-equipo',
      icon: 'user',
      label: 'Trabajadores y usuarios',
      hint: 'Equipo, roles y permisos',
      onPress: () => openInBrowser('/configuracion'),
    },
    {
      key: 'cfg-catalogos',
      icon: 'clipboardCheck',
      label: 'Catálogos maestros',
      hint: 'Áreas, especialidades, CC, proyectos',
      onPress: () => openInBrowser('/configuracion'),
    },
  ]

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <WelcomeHeader
          name={user?.first_name || user?.email?.split('@')[0]}
          role={user?.role || 'trabajador'}
        />

        <SectionTitle>General</SectionTitle>
        <MenuCard items={generalItems} />

        {isAdmin && (
          <>
            <SectionTitle hint="Se abrirán en el navegador web">Administración</SectionTitle>
            <MenuCard items={adminItems} />
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

        <Text style={styles.footer}>Azoramind Tareo · v{APP_VERSION}</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

function MenuCard({ items }) {
  return (
    <View style={styles.card}>
      {items.map((it, i) => (
        <Pressable
          key={it.key}
          onPress={it.onPress}
          android_ripple={{ color: colors.surfaceSubtle }}
          style={({ pressed }) => [
            styles.row,
            i === items.length - 1 && styles.rowLast,
            pressed && { backgroundColor: colors.surfaceSubtle },
          ]}
          accessibilityRole="button"
          accessibilityLabel={it.label}
        >
          <View style={styles.iconCircle}>
            <Icon name={it.icon} size={20} color={colors.brand[600]} strokeWidth={1.75} />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>{it.label}</Text>
            {it.hint ? <Text style={styles.rowHint} numberOfLines={1}>{it.hint}</Text> : null}
          </View>
          <Icon name="chevronRight" size={16} color={colors.text.muted} strokeWidth={1.5} />
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: spacing['4xl'] },
  card: {
    marginHorizontal: spacing.base,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    minHeight: 64,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSubtle,
    marginLeft: 0,
    // divider empieza en el inicio del texto (patrón Gmail/iOS Settings)
    // se logra con un ::after simulado abajo — RN no tiene ::after, se
    // deja divider full pero muy suave (surfaceSubtle en vez de border).
  },
  rowLast: { borderBottomWidth: 0 },
  iconCircle: {
    width: 40, height: 40, borderRadius: radius.pill,
    backgroundColor: colors.brand[50],
    alignItems: 'center', justifyContent: 'center',
    marginRight: 14,
  },
  rowText: { flex: 1 },
  rowLabel: { ...type.bodyStrong, color: colors.text.primary },
  rowHint: { ...type.caption, color: colors.text.secondary, marginTop: 2 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
  footer: {
    ...type.caption,
    color: colors.text.muted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
})
