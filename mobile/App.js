import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import AgendaScreen from './src/screens/AgendaScreen'
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

// ─── Icono para tab bar ───────────────────────────────────────────────────
const ICON_NAME = {
  Home: 'home',
  Tareo: 'list',
  Agenda: 'calendar',
  Mas: 'layoutGrid',
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
  const role = useAuthStore((s) => s.user?.role)
  const canCreate = role === 'admin' || role === 'supervisor'

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
            tabBarIcon: ({ focused }) => <TabIcon name="Nueva" focused={focused} isFab />,
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
  tabBar: {
    height: 72,
    paddingBottom: 10,
    paddingTop: 8,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadow.tabBar,
  },
  tabItem: { paddingVertical: 4 },
  tabLabel: { ...type.caption, fontSize: 11, fontWeight: '600', marginTop: 3, letterSpacing: 0.1 },
  iconWrap: {
    width: 44, height: 30,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.pill,
  },
  iconWrapActive: {
    backgroundColor: colors.brand[50],
  },
  fab: {
    width: 54, height: 54,
    borderRadius: 27,
    backgroundColor: colors.brand[600],
    alignItems: 'center', justifyContent: 'center',
    marginTop: -20,
    ...shadow.floating,
  },
})
