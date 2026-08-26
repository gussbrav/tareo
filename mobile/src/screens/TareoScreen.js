/**
 * TareoScreen — lista de actividades del día.
 * Header con DateField premium (chevron + Hoy + date picker nativo).
 * Sin FAB propio: el "+ Nueva" vive en el tab bar central para evitar
 * duplicar dos botones azules en la misma pantalla.
 */
import { useCallback, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { actividadesApi } from '../api/actividades'
import { useAuthStore } from '../store/auth'
import { colors, radius, shadow, spacing, type } from '../theme'
import DateField from '../ui/DateField'
import Icon from '../ui/Icons'

const today = () => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

const fmtHM = (t) => (t ? String(t).slice(0, 5) : '--:--')

export default function TareoScreen({ navigation }) {
  const { user } = useAuthStore()
  const [fecha, setFecha] = useState(today())
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const canEdit = user?.role === 'admin' || user?.role === 'supervisor'
  const isToday = fecha === today()

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
    const d = new Date(fecha + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    setFecha(`${y}-${m}-${dd}`)
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.dateBar}>
        <Pressable
          onPress={() => changeDay(-1)}
          style={styles.arrowBtn}
          android_ripple={{ color: colors.surfaceSubtle, borderless: true }}
          accessibilityLabel="Día anterior"
        >
          <Icon name="chevronLeft" size={20} color={colors.text.secondary} />
        </Pressable>

        <View style={styles.dateFieldWrap}>
          <DateField value={fecha} onChange={setFecha} />
        </View>

        <Pressable
          onPress={() => changeDay(1)}
          style={styles.arrowBtn}
          android_ripple={{ color: colors.surfaceSubtle, borderless: true }}
          accessibilityLabel="Día siguiente"
        >
          <Icon name="chevronRight" size={20} color={colors.text.secondary} />
        </Pressable>

        <Pressable
          onPress={() => setFecha(today())}
          style={[styles.todayBtn, isToday && styles.todayBtnActive]}
          android_ripple={{ color: colors.brand[500] }}
          accessibilityLabel="Ir a hoy"
        >
          <Text style={[styles.todayText, isToday && styles.todayTextActive]}>Hoy</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading && items.length === 0 ? (
        <ActivityIndicator style={{ marginTop: spacing['3xl'] }} color={colors.brand[600]} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing['4xl'] }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load() }}
              tintColor={colors.brand[600]}
              colors={[colors.brand[600]]}
            />
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.trabajador} numberOfLines={1}>{item.trabajador_nombre}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <Text style={styles.date}>{item.fecdia_display}</Text>
                  {canEdit && (
                    <TouchableOpacity
                      onPress={() => navigation.navigate('EditarActividad', { actividadId: item.id })}
                    >
                      <Text style={styles.editLink}>Editar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              <Text style={styles.desc} numberOfLines={3}>{item.desactividad}</Text>
              <View style={styles.meta}>
                <View style={[styles.badge, item.desestadoactividad === 'iniciado' ? styles.badgeEmerald : styles.badgeSlate]}>
                  <Text style={[styles.badgeText, item.desestadoactividad === 'iniciado' ? { color: colors.success[700] } : { color: colors.text.secondary }]}>
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
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Sin actividades para esta fecha</Text>
              <Text style={styles.emptyHint}>Usa el botón + del centro para crear una nueva.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  dateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  arrowBtn: {
    width: 40, height: 40, borderRadius: radius.pill,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceSubtle,
  },
  dateFieldWrap: { flex: 1 },
  todayBtn: {
    height: 40, paddingHorizontal: spacing.base,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center', justifyContent: 'center',
  },
  todayBtnActive: { backgroundColor: colors.brand[600] },
  todayText: { ...type.label, color: colors.text.secondary, fontWeight: '600' },
  todayTextActive: { color: colors.text.inverse, fontWeight: '700' },
  error: {
    marginHorizontal: spacing.md, marginTop: spacing.md,
    padding: spacing.md, borderRadius: radius.md,
    backgroundColor: colors.danger[50], color: colors.danger[700],
    ...type.body,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.base,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trabajador: { ...type.bodyStrong, color: colors.text.primary, flex: 1, marginRight: spacing.sm },
  date: { ...type.caption, color: colors.text.muted },
  editLink: { ...type.caption, color: colors.brand[600], fontWeight: '700' },
  desc: { ...type.body, color: colors.text.secondary, marginTop: spacing.sm },
  meta: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: spacing.md, gap: spacing.md, flexWrap: 'wrap',
  },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  badgeAmber:   { backgroundColor: colors.warning[100] }, // legacy, no se usa
  badgeEmerald: { backgroundColor: colors.success[100] }, // iniciado (activo)
  badgeSlate:   { backgroundColor: colors.surfaceSubtle }, // finalizado (histórico)
  badgeText: { ...type.overline, letterSpacing: 0.4 },
  hora: { ...type.caption, color: colors.text.tertiary },
  finalize: {
    marginTop: spacing.md, backgroundColor: colors.brand[600],
    borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center',
    minHeight: 44, justifyContent: 'center',
  },
  finalizeText: { ...type.bodyStrong, color: colors.text.inverse },
  empty: { padding: spacing['3xl'], alignItems: 'center' },
  emptyText: { ...type.body, color: colors.text.tertiary },
  emptyHint: { ...type.caption, color: colors.text.muted, marginTop: spacing.xs, textAlign: 'center' },
})
