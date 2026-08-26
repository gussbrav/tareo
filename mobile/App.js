import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import EditarActividadScreen from './src/screens/EditarActividadScreen'
import HomeScreen from './src/screens/HomeScreen'
import LoginScreen from './src/screens/LoginScreen'
import MasScreen from './src/screens/MasScreen'
import NuevaActividadScreen from './src/screens/NuevaActividadScreen'
import ReportesScreen from './src/screens/ReportesScreen'
import TareoScreen from './src/screens/TareoScreen'
import { hydrate, useAuthStore } from './src/store/auth'
import { colors, radius, shadow, spacing, type } from './src/theme'
import Icon from './src/ui/Icons'

const Stack = createNativeStackNavigator()
const Tab = createBottomTabNavigator()
const TareoStack = createNativeStackNavigator()

// ─── Stack anidado para las pantallas que suben modales sobre "Tareo" ─────
function TareoStackNav() {
  return (
    <TareoStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text.primary,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
      }}
    >
      <TareoStack.Screen
        name="Tareo"
        component={TareoScreen}
        options={{ title: 'Actividades' }}
      />
      <TareoStack.Screen
        name="NuevaActividad"
        component={NuevaActividadScreen}
        options={{ title: 'Nueva actividad', presentation: 'modal' }}
      />
      <TareoStack.Screen
        name="EditarActividad"
        component={EditarActividadScreen}
        options={{ title: 'Editar actividad' }}
      />
    </TareoStack.Navigator>
  )
}

// ─── Icono para tab bar (SVG outline, family Lucide-style) ────────────────
const ICON_NAME = {
  Home: 'home',
  TareoStack: 'clipboardCheck',
  Reportes: 'barChart',
  Mas: 'dotsHorizontal',
}

function TabIcon({ name, focused, isFab }) {
  if (isFab) {
    return (
      <View style={styles.fab} accessible accessibilityLabel="Nueva actividad">
        <Icon name="plus" size={26} color={colors.text.inverse} strokeWidth={2.25} />
      </View>
    )
  }
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Icon
        name={ICON_NAME[name]}
        size={22}
        color={focused ? colors.brand[600] : colors.text.muted}
        strokeWidth={focused ? 2 : 1.75}
      />
    </View>
  )
}

// ─── Bottom Tab Navigator ─────────────────────────────────────────────────
function MainTabs() {
  const canCreate =
    useAuthStore((s) => s.user?.role) === 'admin' ||
    useAuthStore((s) => s.user?.role) === 'supervisor'

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: colors.brand[600],
        tabBarInactiveTintColor: colors.text.muted,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabItem,
        tabBarLabelStyle: styles.tabLabel,
        tabBarButtonTestID: 'tab',
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Inicio',
          tabBarIcon: ({ focused }) => <TabIcon name="Home" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="TareoStack"
        component={TareoStackNav}
        options={{
          title: 'Tareo',
          tabBarIcon: ({ focused }) => <TabIcon name="TareoStack" focused={focused} />,
        }}
      />
      {canCreate && (
        <Tab.Screen
          name="Nueva"
          component={NuevaActividadScreen}
          options={{
            title: 'Nueva',
            // Header visible dentro del tab para dar contexto — sin el
            // usuario aterriza en el formulario sin saber dónde está.
            headerShown: true,
            headerTitle: 'Nueva actividad',
            headerTitleStyle: { fontWeight: '700', color: colors.text.primary },
            headerStyle: { backgroundColor: colors.surface },
            headerShadowVisible: false,
            tabBarIcon: ({ focused }) => <TabIcon name="Nueva" focused={focused} isFab />,
          }}
        />
      )}
      <Tab.Screen
        name="Reportes"
        component={ReportesScreen}
        options={{
          title: 'Reportes',
          tabBarIcon: ({ focused }) => <TabIcon name="Reportes" focused={focused} />,
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
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {accessToken ? (
            <Stack.Screen name="Main" component={MainTabs} />
          ) : (
            <Stack.Screen name="Login" component={LoginScreen} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand[600] },
  tabBar: {
    height: 68,
    paddingBottom: 8,
    paddingTop: 6,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadow.tabBar,
  },
  tabItem: { paddingVertical: 4 },
  tabLabel: { ...type.caption, fontSize: 11, fontWeight: '600', marginTop: 2 },
  iconWrap: {
    width: 40, height: 28,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.pill,
  },
  iconWrapActive: {
    backgroundColor: colors.brand[50],
  },
  iconGlyph: { fontSize: 20, fontWeight: '600', lineHeight: 22 },
  fab: {
    width: 52, height: 52,
    borderRadius: 26,
    backgroundColor: colors.brand[600],
    alignItems: 'center', justifyContent: 'center',
    marginTop: -18,
    ...shadow.floating,
  },
  fabIcon: { color: colors.text.inverse, fontSize: 28, fontWeight: '600', lineHeight: 30, marginTop: -2 },
})
