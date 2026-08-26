import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import AgendaScreen from './src/screens/AgendaScreen'
import CambiarPasswordScreen from './src/screens/CambiarPasswordScreen'
import EditarActividadScreen from './src/screens/EditarActividadScreen'
import HomeScreen from './src/screens/HomeScreen'
import LoginScreen from './src/screens/LoginScreen'
import MasScreen from './src/screens/MasScreen'
import MiCuentaScreen from './src/screens/MiCuentaScreen'
import NuevaActividadScreen from './src/screens/NuevaActividadScreen'
import ReportesScreen from './src/screens/ReportesScreen'
import TareoScreen from './src/screens/TareoScreen'
import { hydrate, useAuthStore } from './src/store/auth'
import { hydrateActiveProject } from './src/store/project'
import { colors, radius, shadow, spacing, type } from './src/theme'
import Icon from './src/ui/Icons'

const Stack = createNativeStackNavigator()
const Tab = createBottomTabNavigator()

// ─── Icono para tab bar ───────────────────────────────────────────────────
// Cada tab tiene 2 variantes: outline (inactivo) + filled (activo).
// Patrón iOS/Instagram/Linear — el peso visual del filled da presencia
// al tab activo sin necesidad de dot/línea indicador debajo.
const ICON_NAME = {
  Home:   { outline: 'home',       filled: 'homeFilled' },
  Tareo:  { outline: 'list',       filled: 'listFilled' },
  Agenda: { outline: 'calendar',   filled: 'calendarFilled' },
  Mas:    { outline: 'layoutGrid', filled: 'layoutGridFilled' },
}

function TabIcon({ name, focused }) {
  const spec = ICON_NAME[name]
  const iconName = focused ? spec.filled : spec.outline
  return (
    <View style={styles.iconCol}>
      <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
        <Icon
          name={iconName}
          size={22}
          color={focused ? colors.brand[600] : colors.text.softMuted}
          strokeWidth={focused ? 1.5 : 1.75}
          filled={focused}
        />
      </View>
      <View style={[styles.activeDot, !focused && styles.activeDotHidden]} />
    </View>
  )
}

/**
 * tabBarButton custom para el tab center — reemplaza al default de
 * React Navigation para poder incluir el FAB elevado con animación de
 * scale. Toma onPress del Tab Navigator (ya conectado a la navegación)
 * y lo dispara al soltar. Ubicar el Pressable ARRIBA de todo evita el
 * problema anterior donde un Pressable interno robaba el evento y el
 * "+" no navegaba.
 */
function FabTabButton({ onPress, accessibilityState, accessibilityLabel }) {
  const scale = useRef(new Animated.Value(1)).current
  const onIn = () => Animated.spring(scale, {
    toValue: 0.92, useNativeDriver: true, stiffness: 320, damping: 14, mass: 0.5,
  }).start()
  const onOut = () => Animated.spring(scale, {
    toValue: 1, useNativeDriver: true, stiffness: 320, damping: 14, mass: 0.5,
  }).start()
  return (
    <Pressable
      onPress={onPress}
      onPressIn={onIn}
      onPressOut={onOut}
      accessibilityState={accessibilityState}
      accessibilityLabel={accessibilityLabel || 'Nueva actividad'}
      accessibilityRole="button"
      style={styles.fabTabButton}
      hitSlop={8}
    >
      <Animated.View style={[styles.fab, { transform: [{ scale }] }]}>
        <Icon name="plus" size={24} color={colors.text.inverse} strokeWidth={2.5} />
      </Animated.View>
      <Text style={styles.fabLabel}>Actividad</Text>
    </Pressable>
  )
}

// ─── Bottom Tab Navigator ─────────────────────────────────────────────────
function MainTabs() {
  const role = useAuthStore((s) => s.user?.role)
  const canCreate = role === 'admin' || role === 'supervisor'

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: colors.brand[700],
        tabBarInactiveTintColor: colors.text.softMuted,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabItem,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Inicio',
          tabBarLabelStyle: styles.tabLabel,
          tabBarIcon: ({ focused }) => <TabIcon name="Home" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Tareo"
        component={TareoScreen}
        options={{
          title: 'Tareo',
          tabBarIcon: ({ focused }) => <TabIcon name="Tareo" focused={focused} />,
        }}
      />
      {canCreate && (
        <Tab.Screen
          name="Nueva"
          component={NuevaActividadScreen}
          options={{
            title: 'Actividad',
            headerShown: true,
            headerTitle: 'Nueva actividad',
            headerTitleStyle: { fontWeight: '700', color: colors.text.primary },
            headerStyle: { backgroundColor: colors.surface },
            headerShadowVisible: false,
            // tabBarButton custom en vez de tabBarIcon: garantiza que el
            // onPress del navigator llegue al FAB (bug anterior: un
            // Pressable interno robaba el evento).
            // El FabTabButton maneja su propio label "Actividad" debajo
            // del cuadrado azul — desactivamos el label del navigator.
            tabBarButton: (props) => <FabTabButton {...props} />,
            tabBarLabel: () => null,
            tabBarLabelPosition: 'below-icon',
          }}
        />
      )}
      <Tab.Screen
        name="Agenda"
        component={AgendaScreen}
        options={{
          title: 'Agenda',
          tabBarIcon: ({ focused }) => <TabIcon name="Agenda" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Mas"
        component={MasScreen}
        options={{
          title: 'Más',
          tabBarIcon: ({ focused }) => <TabIcon name="Mas" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────
export default function App() {
  const { accessToken } = useAuthStore()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Rehidratación en paralelo (auth + proyecto activo persistido)
    Promise.all([hydrate(), hydrateActiveProject()]).finally(() => setReady(true))
  }, [])

  if (!ready) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color="#fff" />
      </View>
    )
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.text.primary,
            headerTitleStyle: { fontWeight: '700' },
            headerShadowVisible: false,
          }}
        >
          {accessToken ? (
            <>
              <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
              <Stack.Screen
                name="EditarActividad"
                component={EditarActividadScreen}
                options={{ title: 'Editar actividad' }}
              />
              <Stack.Screen
                name="Reportes"
                component={ReportesScreen}
                options={{ title: 'Reportes' }}
              />
              <Stack.Screen
                name="MiCuenta"
                component={MiCuentaScreen}
                options={{ title: 'Mi cuenta' }}
              />
              <Stack.Screen
                name="CambiarPassword"
                component={CambiarPasswordScreen}
                options={{ title: 'Seguridad' }}
              />
            </>
          ) : (
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand[600] },

  // Tab bar hairline top (más elegante que shadow arriba)
  tabBar: {
    height: 72,
    paddingBottom: 10,
    paddingTop: 8,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    // sin shadow — la hairline sola da look Apple/Linear
    elevation: 0,
    shadowOpacity: 0,
  },
  tabItem: { paddingVertical: 2 },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
    letterSpacing: 0.1,
  },

  iconCol: { alignItems: 'center', justifyContent: 'center' },
  iconWrap: {
    width: 44, height: 28,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.pill,
  },
  iconWrapActive: {
    backgroundColor: colors.brand[50],
  },
  activeDot: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: colors.brand[600],
    marginTop: 3,
  },
  activeDotHidden: { backgroundColor: 'transparent' },

  fabTabButton: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingTop: 4,
  },
  fab: {
    width: 52, height: 40,
    borderRadius: 12,          // cuadro rounded en vez de círculo
    backgroundColor: colors.brand[600],
    alignItems: 'center', justifyContent: 'center',
    marginTop: -6,
    ...shadow.floating,
  },
  fabLabel: {
    fontSize: 11, fontWeight: '700',
    color: colors.brand[600],
    marginTop: 5, letterSpacing: 0.1,
  },
})
