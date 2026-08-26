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

import { actividadesApi, catalogosApi } from '../api/actividades'
import { colors } from '../theme'

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Selector minimal: lista simple con selección; sirve para 1..N valores. */
function Picker({ items, valueKey, labelKey, selectedIds, onToggle, single, placeholder = 'Selecciona…' }) {
  return (
    <View style={styles.picker}>
      {items.length === 0 && <Text style={styles.pickerEmpty}>{placeholder}</Text>}
      {items.map((it) => {
        const active = selectedIds.includes(it[valueKey])
        return (
          <TouchableOpacity
            key={it[valueKey]}
            style={[styles.pickerRow, active && styles.pickerRowActive]}
            onPress={() => onToggle(it[valueKey], single)}
          >
            <View style={[styles.dot, active && styles.dotActive]} />
            <Text style={[styles.pickerText, active && styles.pickerTextActive]}>{it[labelKey]}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

export default function NuevaActividadScreen({ navigation }) {
  const [fecha, setFecha] = useState(today())
  const [proyectos, setProyectos] = useState([])
  const [areas, setAreas] = useState([])
  const [especialidades, setEspecialidades] = useState([])
  const [centrosCosto, setCentrosCosto] = useState([])
  const [trabajadores, setTrabajadores] = useState([])

  const [proyectoId, setProyectoId] = useState(null)
  const [areaId, setAreaId] = useState(null)
  const [especialidadId, setEspecialidadId] = useState(null)
  const [centroCostoId, setCentroCostoId] = useState(null)
  const [selectedTrabajadores, setSelectedTrabajadores] = useState([])
  const [desactividad, setDesactividad] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([catalogosApi.proyectos(), catalogosApi.areas()])
      .then(([prs, ars]) => {
        setProyectos(prs)
        setAreas(ars)
        if (prs.length) setProyectoId(prs[0].id)
      })
      .catch(() => Alert.alert('Error', 'No se pudieron cargar los catálogos'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    catalogosApi.trabajadoresDisponibles(fecha).then(setTrabajadores).catch(() => setTrabajadores([]))
    setSelectedTrabajadores([])
  }, [fecha])

  useEffect(() => {
    setEspecialidades([]); setEspecialidadId(null)
    setCentrosCosto([]); setCentroCostoId(null)
    if (areaId) catalogosApi.especialidades(areaId).then(setEspecialidades)
  }, [areaId])

  useEffect(() => {
    setCentrosCosto([]); setCentroCostoId(null)
    if (especialidadId) {
      catalogosApi.centrosCosto(especialidadId).then((data) => {
        setCentrosCosto(data)
        const mo = data.find((c) => (c.nbrcentrocosto || '').toLowerCase().includes('mano de obra'))
        if (mo) setCentroCostoId(mo.id)
      })
    }
  }, [especialidadId])

  const toggle = (id, single) => {
    if (single === 'proyecto') setProyectoId(id)
    else if (single === 'area') setAreaId(id)
    else if (single === 'esp') setEspecialidadId(id)
    else if (single === 'cc') setCentroCostoId(id)
    else {
      setSelectedTrabajadores((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
      )
    }
  }

  const canSubmit =
    fecha && proyectoId && areaId && especialidadId && centroCostoId &&
    desactividad.trim() && selectedTrabajadores.length > 0

  const submit = async () => {
    if (!canSubmit) return
    setSaving(true)
    try {
      const res = await actividadesApi.crearBulk({
        fecactividad: fecha,
        proyecto_id: proyectoId,
        centro_costo_id: centroCostoId,
        desactividad: desactividad.trim(),
        trabajador_ids: selectedTrabajadores,
      })
      Alert.alert('OK', `Se crearon ${res.created} actividad(es)`, [
        {
          text: 'Volver',
          onPress: () => {
            // Si se abrió desde el tab bar (sin stack padre) navegamos a Tareo;
            // si vino de un stack (ej. desde el FAB de TareoScreen) hacemos back.
            if (navigation.canGoBack()) navigation.goBack()
            else navigation.navigate('TareoStack', { screen: 'Tareo' })
          },
        },
      ])
    } catch (e) {
      Alert.alert('Error', e.response?.data?.detail || 'No se pudo crear')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={colors.brand[600]} />

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 80 }}>
        <Text style={styles.label}>Fecha</Text>
        <TextInput
          style={styles.input}
          value={fecha}
          onChangeText={setFecha}
          placeholder="YYYY-MM-DD"
        />

        <Text style={styles.label}>Contrato / Proyecto</Text>
        <Picker items={proyectos} valueKey="id" labelKey="descontratoproyecto"
                selectedIds={proyectoId ? [proyectoId] : []} onToggle={(id) => toggle(id, 'proyecto')} single />

        <Text style={styles.label}>Área</Text>
        <Picker items={areas} valueKey="id" labelKey="display_name"
                selectedIds={areaId ? [areaId] : []} onToggle={(id) => toggle(id, 'area')} single />

        <Text style={styles.label}>Especialidad</Text>
        <Picker items={especialidades} valueKey="id" labelKey="display_name"
                selectedIds={especialidadId ? [especialidadId] : []}
                onToggle={(id) => toggle(id, 'esp')} single
                placeholder="Elige un área primero" />

        <Text style={styles.label}>Centro de costo</Text>
        <Picker items={centrosCosto} valueKey="id" labelKey="display_name"
                selectedIds={centroCostoId ? [centroCostoId] : []}
                onToggle={(id) => toggle(id, 'cc')} single
                placeholder="Elige una especialidad primero" />

        <Text style={styles.label}>Descripción del trabajo</Text>
        <TextInput
          style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
          multiline
          value={desactividad}
          onChangeText={setDesactividad}
          placeholder="Describe la tarea…"
        />

        <Text style={styles.label}>Trabajadores ({selectedTrabajadores.length} seleccionados)</Text>
        <Picker items={trabajadores} valueKey="id" labelKey="nbrcompleto"
                selectedIds={selectedTrabajadores} onToggle={(id) => toggle(id)}
                placeholder="No hay trabajadores libres para esta fecha" />

        <TouchableOpacity
          style={[styles.submit, (!canSubmit || saving) && { opacity: 0.5 }]}
          onPress={submit}
          disabled={!canSubmit || saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Iniciar actividad</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.slate[50] },
  label: { fontSize: 13, fontWeight: '600', color: colors.slate[700], marginTop: 14, marginBottom: 6 },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: colors.slate[200], borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.slate[900],
  },
  picker: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: colors.slate[200], borderRadius: 10, overflow: 'hidden',
  },
  pickerEmpty: { padding: 12, color: colors.slate[400], fontSize: 13 },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: colors.slate[100],
  },
  pickerRowActive: { backgroundColor: colors.brand[50] },
  dot: {
    width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: colors.slate[400], marginRight: 10,
  },
  dotActive: { backgroundColor: colors.brand[600], borderColor: colors.brand[600] },
  pickerText: { fontSize: 14, color: colors.slate[700], flex: 1 },
  pickerTextActive: { color: colors.brand[700], fontWeight: '600' },
  submit: {
    marginTop: 22, backgroundColor: colors.brand[600], borderRadius: 10,
    paddingVertical: 14, alignItems: 'center',
  },
  submitText: { color: '#fff', fontWeight: '600', fontSize: 15 },
})
