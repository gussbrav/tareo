import { useCallback, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { actividadesApi } from '../api/actividades'
import { useAuthStore } from '../store/auth'
import { colors } from '../theme'

const today = () => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

const fmtHM = (t) => (t ? String(t).slice(0, 5) : '--:--')

export default function TareoScreen({ navigation }) {
  const { user, logout } = useAuthStore()
  const [fecha, setFecha] = useState(today())
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const canCreate = user?.role === 'admin' || user?.role === 'supervisor'

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const data = await actividadesApi.listar(fecha)
      setItems(data)
    } catch (e) {
      setError('No se pudo cargar')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [fecha])

  useFocusEffect(useCallback(() => { load() }, [load]))

  const finalize = async (id) => {
    try {
      await actividadesApi.finalizarUna(id)
      load()
    } catch {
      setError('No se pudo finalizar')
    }
  }

  const changeDay = (delta) => {
    const d = new Date(fecha)
    d.setDate(d.getDate() + delta)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    setFecha(`${y}-${m}-${dd}`)
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.dateBar}>
        <TouchableOpacity onPress={() => changeDay(-1)} style={styles.dateBtn}>
          <Text style={styles.dateBtnText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.dateBox}>
          <Text style={styles.dateLabel}>Fecha</Text>
          <Text style={styles.dateText}>{fecha}</Text>
        </View>
        <TouchableOpacity onPress={() => changeDay(1)} style={styles.dateBtn}>
          <Text style={styles.dateBtnText}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setFecha(today())} style={styles.todayBtn}>
          <Text style={styles.todayText}>Hoy</Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading && items.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.brand[600]} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.trabajador}>{item.trabajador_nombre}</Text>
                <Text style={styles.date}>{item.fecdia_display}</Text>
              </View>
              <Text style={styles.desc} numberOfLines={3}>{item.desactividad}</Text>
              <View style={styles.meta}>
                <View style={[styles.badge, item.desestadoactividad === 'iniciado' ? styles.badgeAmber : styles.badgeEmerald]}>
                  <Text style={[styles.badgeText, item.desestadoactividad === 'iniciado' ? { color: colors.amber[700] } : { color: colors.emerald[700] }]}>
                    {item.desestadoactividad}
                  </Text>
                </View>
                <Text style={styles.hora}>Inicio {fmtHM(item.horinicio)} · Fin {fmtHM(item.horfin)}</Text>
              </View>
              {item.desestadoactividad === 'iniciado' && (
                <TouchableOpacity style={styles.finalize} onPress={() => finalize(item.id)}>
                  <Text style={styles.finalizeText}>Finalizar</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          ListEmptyComponent={
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Text style={{ color: colors.slate[500] }}>Sin actividades para esta fecha</Text>
            </View>
          }
        />
      )}

      {canCreate && (
        <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('NuevaActividad')}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Salir</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.slate[50] },
  dateBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: colors.slate[100], padding: 10, gap: 8,
  },
  dateBtn: {
    width: 40, height: 40, borderRadius: 10, backgroundColor: colors.slate[100],
    alignItems: 'center', justifyContent: 'center',
  },
  dateBtnText: { fontSize: 24, color: colors.slate[700], fontWeight: '600', marginTop: -3 },
  dateBox: { flex: 1, alignItems: 'center' },
  dateLabel: { fontSize: 11, color: colors.slate[400], textTransform: 'uppercase' },
  dateText: { fontSize: 16, color: colors.slate[900], fontWeight: '600' },
  todayBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.brand[600], borderRadius: 8 },
  todayText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  error: {
    marginHorizontal: 12, marginTop: 12, padding: 10, backgroundColor: colors.red[100],
    color: colors.red[700], borderRadius: 8, fontSize: 13,
  },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trabajador: { fontSize: 15, fontWeight: '600', color: colors.slate[900], flex: 1 },
  date: { fontSize: 12, color: colors.slate[400] },
  desc: { fontSize: 14, color: colors.slate[700], marginTop: 6 },
  meta: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 10, flexWrap: 'wrap' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  badgeAmber: { backgroundColor: colors.amber[100], borderColor: colors.amber[100] },
  badgeEmerald: { backgroundColor: colors.emerald[100], borderColor: colors.emerald[100] },
  badgeText: { fontSize: 11, fontWeight: '600', textTransform: 'lowercase' },
  hora: { fontSize: 12, color: colors.slate[500] },
  finalize: {
    marginTop: 10, backgroundColor: colors.brand[600], borderRadius: 8, paddingVertical: 10, alignItems: 'center',
  },
  finalizeText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  fab: {
    position: 'absolute', bottom: 24, right: 20, width: 58, height: 58, borderRadius: 29,
    backgroundColor: colors.brand[600], alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 6,
  },
  fabText: { color: '#fff', fontSize: 32, fontWeight: '300', marginTop: Platform.OS === 'android' ? -4 : 0 },
  logoutBtn: { position: 'absolute', bottom: 24, left: 20, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.slate[200] },
  logoutText: { color: colors.slate[700], fontSize: 13, fontWeight: '600' },
})
