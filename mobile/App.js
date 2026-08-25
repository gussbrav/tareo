import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import EditarActividadScreen from './src/screens/EditarActividadScreen'
import LoginScreen from './src/screens/LoginScreen'
import NuevaActividadScreen from './src/screens/NuevaActividadScreen'
import TareoScreen from './src/screens/TareoScreen'
import { hydrate, useAuthStore } from './src/store/auth'
import { colors } from './src/theme'

const Stack = createNativeStackNavigator()

export default function App() {
  const { accessToken } = useAuthStore()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    hydrate().finally(() => setReady(true))
  }, [])

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand[600] }}>
        <ActivityIndicator color="#fff" />
      </View>
    )
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: colors.brand[600] },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: '600' },
          }}
        >
          {accessToken ? (
            <>
              <Stack.Screen name="Tareo" component={TareoScreen} options={{ title: 'Tareo' }} />
              <Stack.Screen name="NuevaActividad" component={NuevaActividadScreen} options={{ title: 'Nueva actividad' }} />
              <Stack.Screen name="EditarActividad" component={EditarActividadScreen} options={{ title: 'Mantenimiento' }} />
            </>
          ) : (
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  )
}
