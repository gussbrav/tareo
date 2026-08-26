import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Animated, Pressable, StyleSheet, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import AgendaScreen from './src/screens/AgendaScreen'
import EditarActividadScreen from './src/screens/EditarActividadScreen'
import HomeScreen from './src/screens/HomeScreen'
import LoginScreen from './src/screens/LoginScreen'
import MasScreen from './src/screens/MasScreen'
import MiCuentaScreen from './src/screens/MiCuentaScreen'
import NuevaActividadScreen from './src/screens/NuevaActividadScreen'
import ReportesScreen from './src/screens/ReportesScreen'
import TareoScreen from './src/screens/TareoScreen'
import { hydrate, useAuthStore } from './src/store/auth'
import { colors, radius, shadow, spacing, type } from './src/theme'
import Icon from './src/ui/Icons'

const Stack = createNativeStackNavigator()
const Tab = createBottomTabNavigator()

// ─── Icono para tab bar ───────────────────────────────────────────────────
const ICON_NAME = {
  Home: 'home',
  Tareo: 'list',
  Agenda: 'calendar',
  Mas: 'layoutGrid',
}

function TabIcon({ name, focused }) {
  return (
    <View style={styles.iconCol}>
      <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
        <Icon
          name={ICON_NAME[name]}
          size={22}
          color={focused ? colors.brand[600] : colors.text.softMuted}
          strokeWidth={focused ? 2.25 : 1.75}
        />
      </View>
      {/* Dot indicador debajo del pill activo — patrón iOS/Material 3 */}
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
        <Icon name="plus" size={26} color={colors.text.inverse} strokeWidth={2.25} />
      </Animated.View>
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
            tabBarButton: (props) => <FabTabButton {...props} />,
            tabBarLabel: () => null,
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
    hydrate().finally(() => setReady(true))
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
    // ancho similar a los otros tab items; el FAB "sobresale" arriba
    // por marginTop negativo del hijo animated.
  },
  fab: {
    width: 56, height: 56,
    borderRadius: 28,
    backgroundColor: colors.brand[600],
    alignItems: 'center', justifyContent: 'center',
    marginTop: -22,
    ...shadow.floating,
  },
})
