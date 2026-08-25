import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { actividadesApi } from '../api/actividades'
import { useAuthStore } from '../store/auth'
import { colors } from '../theme'

const fmtHM = (t) => (t ? String(t).slice(0, 5) : '')

const ESTADOS = [
  { value: 'iniciado', label: 'Iniciado' },
  { value: 'finalizado', label: 'Finalizado' },
]

export default function EditarActividadScreen({ route, navigation }) {
  const { actividadId } = route.params
  const { user } = useAuthStore()
  const canDelete = user?.role === 'admin'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [meta, setMeta] = useState(null)
  const [form, setForm] = useState({
    desactividad: '',
    horinicio: '',
    horfin: '',
    desestadoactividad: 'iniciado',
    desobservaciones: '',
  })

  useEffect(() => {
    actividadesApi
      .detalle(actividadId)
      .then((d) => {
        setMeta(d)
        setForm({
          desactividad: d.desactividad || '',
          horinicio: fmtHM(d.horinicio),
          horfin: fmtHM(d.horfin),
          desestadoactividad: d.desestadoactividad,
          desobservaciones: d.desobservaciones || '',
        })
      })
      .catch(() => Alert.alert('Error', 'No se pudo cargar la actividad'))
      .finally(() => setLoading(false))
  }, [actividadId])

  const submit = async () => {
    if (!form.desactividad.trim()) {
      Alert.alert('Falta', 'La descripción es obligatoria')
      return
    }
    if (form.desestadoactividad === 'finalizado' && !form.horfin) {
      Alert.alert('Falta', 'La hora de fin es obligatoria al finalizar')
      return
    }
    setSaving(true)
    try {
      const payload = {
        desactividad: form.desactividad.trim(),
        desestadoactividad: form.desestadoactividad,
        desobservaciones: form.desobservaciones.trim() || null,
      }
      if (form.horinicio) payload.horinicio = `${form.horinicio}:00`
      if (form.horfin) payload.horfin = `${form.horfin}:00`
      await actividadesApi.editar(actividadId, payload)
      navigation.goBack()
    } catch (e) {
      Alert.alert('Error', e.response?.data?.detail || 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  const del = () => {
    Alert.alert(
      'Confirmar eliminación',
      `¿Eliminar la actividad de ${meta?.trabajador_nombre}? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await actividadesApi.eliminar(actividadId)
              navigation.goBack()
            } catch (e) {
              Alert.alert('Error', e.response?.data?.detail || 'No se pudo eliminar')
            }
          },
        },
      ],
    )
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={colors.brand[600]} />

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 30 }}>
        <View style={styles.metaCard}>
          <Text style={styles.metaLabel}>Trabajador</Text>
          <Text style={styles.metaValue}>{meta?.trabajador_nombre}</Text>
          <Text style={[styles.metaLabel, { marginTop: 8 }]}>Fecha</Text>
          <Text style={styles.metaValue}>{meta?.fecactividad}</Text>
          {meta?.centro_costo_nombre && (
            <>
              <Text style={[styles.metaLabel, { marginTop: 8 }]}>Centro de costo</Text>
              <Text style={styles.metaValueMuted}>{meta.centro_costo_nombre}</Text>
            </>
          )}
        </View>

        <Text style={styles.label}>Estado *</Text>
        <View style={styles.estadoRow}>
          {ESTADOS.map((e) => {
            const active = form.desestadoactividad === e.value
            return (
              <TouchableOpacity
                key={e.value}
                style={[styles.estadoBtn, active && styles.estadoBtnActive]}
                onPress={() => setForm({ ...form, desestadoactividad: e.value })}
              >
                <Text style={[styles.estadoText, active && styles.estadoTextActive]}>{e.label}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Hora inicio</Text>
            <TextInput
              style={styles.input}
              value={form.horinicio}
              onChangeText={(v) => setForm({ ...form, horinicio: v })}
              placeholder="HH:MM"
              maxLength={5}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Hora fin</Text>
            <TextInput
              style={styles.input}
              value={form.horfin}
              onChangeText={(v) => setForm({ ...form, horfin: v })}
              placeholder="HH:MM"
              maxLength={5}
            />
          </View>
        </View>

        <Text style={styles.label}>Descripción *</Text>
        <TextInput
          style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
          multiline
          value={form.desactividad}
          onChangeText={(v) => setForm({ ...form, desactividad: v })}
        />

        <Text style={styles.label}>Observaciones</Text>
        <TextInput
          style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
          multiline
          value={form.desobservaciones}
          onChangeText={(v) => setForm({ ...form, desobservaciones: v })}
          placeholder="Notas o incidencias (opcional)"
        />

        <TouchableOpacity style={[styles.submit, saving && { opacity: 0.5 }]} onPress={submit} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Guardar</Text>}
        </TouchableOpacity>

        {canDelete && (
          <TouchableOpacity style={styles.deleteBtn} onPress={del}>
            <Text style={styles.deleteText}>Eliminar actividad</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.slate[50] },
  metaCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
    marginBottom: 6,
  },
  metaLabel: { fontSize: 11, color: colors.slate[400], textTransform: 'uppercase' },
  metaValue: { fontSize: 15, color: colors.slate[900], fontWeight: '600', marginTop: 2 },
  metaValueMuted: { fontSize: 13, color: colors.slate[700], marginTop: 2 },
  label: { fontSize: 13, fontWeight: '600', color: colors.slate[700], marginTop: 14, marginBottom: 6 },
  row: { flexDirection: 'row', gap: 10 },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: colors.slate[200], borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.slate[900],
  },
  estadoRow: { flexDirection: 'row', gap: 8 },
  estadoBtn: {
    flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.slate[200],
    borderRadius: 10, paddingVertical: 12, alignItems: 'center',
  },
  estadoBtnActive: { backgroundColor: colors.brand[50], borderColor: colors.brand[600] },
  estadoText: { color: colors.slate[700], fontSize: 14, fontWeight: '500' },
  estadoTextActive: { color: colors.brand[700], fontWeight: '700' },
  submit: {
    marginTop: 22, backgroundColor: colors.brand[600], borderRadius: 10,
    paddingVertical: 14, alignItems: 'center',
  },
  submitText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  deleteBtn: {
    marginTop: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.red[500],
    borderRadius: 10, paddingVertical: 12, alignItems: 'center',
  },
  deleteText: { color: colors.red[700], fontWeight: '600', fontSize: 14 },
})
