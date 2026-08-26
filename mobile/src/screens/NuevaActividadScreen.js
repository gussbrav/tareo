/**
 * NuevaActividadScreen — paridad con la web /actividades/nueva.
 * Dos secciones numeradas (badge + título + subtítulo), campos con label,
 * asterisco rojo en required, buscador de trabajadores, contador y
 * "Seleccionar todos". Paleta Azoramind (azul brand + neutros).
 */
import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { actividadesApi, catalogosApi } from '../api/actividades'
import { colors, radius, shadow, spacing, type } from '../theme'
import DateField from '../ui/DateField'
import Icon from '../ui/Icons'
import PickerField from '../ui/PickerField'

// ── Helpers ───────────────────────────────────────────────────────────────
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const initials = (name) => {
  if (!name) return '??'
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

// ── UI subcomponents ──────────────────────────────────────────────────────
function SectionHeader({ step, title, subtitle }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.stepBadge}>
        <Text style={styles.stepBadgeText}>{step}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  )
}

const Label = ({ children, required }) => (
  <Text style={styles.label}>
    {children}
    {required ? <Text style={styles.required}> *</Text> : null}
  </Text>
)

/** Select tipo pastilla: lista vertical con radio; item activo con bg brand-50. */
function SelectList({ items, valueKey, labelKey, selectedId, onSelect, placeholder, disabled }) {
  if (disabled || items.length === 0) {
    return (
      <View style={[styles.selectEmpty, disabled && styles.selectEmptyDisabled]}>
        <Text style={styles.selectEmptyText}>{placeholder}</Text>
      </View>
    )
  }
  return (
    <View style={styles.selectList}>
      {items.map((it, i) => {
        const active = selectedId === it[valueKey]
        return (
          <Pressable
            key={it[valueKey]}
            onPress={() => onSelect(it[valueKey])}
            android_ripple={{ color: colors.surfaceSubtle }}
            style={[
              styles.selectRow,
              i === items.length - 1 && { borderBottomWidth: 0 },
              active && styles.selectRowActive,
            ]}
          >
            <View style={[styles.radio, active && styles.radioActive]}>
              {active ? <View style={styles.radioDot} /> : null}
            </View>
            <Text style={[styles.selectText, active && styles.selectTextActive]} numberOfLines={2}>
              {it[labelKey]}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────
export default function NuevaActividadScreen({ navigation }) {
  const [fecha, setFecha] = useState(today())
  const [proyectos, setProyectos] = useState([])
  const [areas, setAreas] = useState([])
  const [especialidades, setEspecialidades] = useState([])
  const [centrosCosto, setCentrosCosto] = useState([])
  const [trabajadores, setTrabajadores] = useState([])
  const [searchWorker, setSearchWorker] = useState('')

  const [proyectoId, setProyectoId] = useState(null)
  const [areaId, setAreaId] = useState(null)
  const [especialidadId, setEspecialidadId] = useState(null)
  const [centroCostoId, setCentroCostoId] = useState(null)
  const [selectedTrabajadores, setSelectedTrabajadores] = useState([])
  const [desactividad, setDesactividad] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Carga proyectos al inicio
  useEffect(() => {
    catalogosApi
      .proyectos()
      .then((prs) => {
        setProyectos(prs)
        if (prs.length && !proyectoId) setProyectoId(prs[0].id)
      })
      .catch(() => Alert.alert('Error', 'No se pudieron cargar los proyectos'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Áreas del proyecto seleccionado
  useEffect(() => {
    setAreas([])
    setAreaId(null)
    setEspecialidades([])
    setEspecialidadId(null)
    setCentrosCosto([])
    setCentroCostoId(null)
    if (proyectoId) {
      catalogosApi
        .areas(proyectoId)
        .then(setAreas)
        .catch(() => setAreas([]))
    }
  }, [proyectoId])

  useEffect(() => {
    catalogosApi
      .trabajadoresDisponibles(fecha)
      .then(setTrabajadores)
      .catch(() => setTrabajadores([]))
    setSelectedTrabajadores([])
  }, [fecha])

  useEffect(() => {
    setEspecialidades([])
    setEspecialidadId(null)
    setCentrosCosto([])
    setCentroCostoId(null)
    if (areaId) catalogosApi.especialidades(areaId).then(setEspecialidades)
  }, [areaId])

  useEffect(() => {
    setCentrosCosto([])
    setCentroCostoId(null)
    if (especialidadId) {
      catalogosApi.centrosCosto(especialidadId).then((data) => {
        setCentrosCosto(data)
        const mo = data.find((c) =>
          (c.nbrcentrocosto || '').toLowerCase().includes('mano de obra'),
        )
        if (mo) setCentroCostoId(mo.id)
      })
    }
  }, [especialidadId])

  const canSubmit = useMemo(
    () =>
      fecha &&
      proyectoId &&
      areaId &&
      especialidadId &&
      centroCostoId &&
      desactividad.trim() &&
      selectedTrabajadores.length > 0,
    [fecha, proyectoId, areaId, especialidadId, centroCostoId, desactividad, selectedTrabajadores],
  )

  const filteredTrabajadores = useMemo(() => {
    const q = searchWorker.trim().toLowerCase()
    if (!q) return trabajadores
    return trabajadores.filter(
      (t) =>
        (t.nbrcompleto || '').toLowerCase().includes(q) ||
        (t.descategoriatrabajador || '').toLowerCase().includes(q),
    )
  }, [trabajadores, searchWorker])

  const visibleIds = filteredTrabajadores.map((t) => t.id)
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedTrabajadores.includes(id))

  const toggleTrabajador = (id) => {
    setSelectedTrabajadores((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedTrabajadores((prev) => prev.filter((id) => !visibleIds.includes(id)))
    } else {
      setSelectedTrabajadores((prev) => Array.from(new Set([...prev, ...visibleIds])))
    }
  }

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
      Alert.alert('Actividad creada', `Se crearon ${res.created} actividad(es).`, [
        {
          text: 'Volver al tareo',
          onPress: () => {
            if (navigation.canGoBack()) navigation.goBack()
            else navigation.navigate('TareoStack')
          },
        },
        {
          text: 'Crear otra',
          onPress: () => {
            setDesactividad('')
            setSelectedTrabajadores([])
            catalogosApi.trabajadoresDisponibles(fecha).then(setTrabajadores)
          },
        },
      ])
    } catch (e) {
      Alert.alert('Error', e.response?.data?.detail || 'No se pudo crear la actividad')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={colors.brand[600]} />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.pageHint}>
          Registra una tarea y asígnala a uno o más trabajadores.
        </Text>

        {/* ─── Sección 1: Contexto ─────────────────────────────────── */}
        <View style={styles.card}>
          <SectionHeader
            step={1}
            title="Selección de fecha y trabajo"
            subtitle="Elige día, proyecto y estructura contable."
          />

          <View style={styles.field}>
            <DateField label="Fecha de trabajo *" value={fecha} onChange={setFecha} />
          </View>

          <View style={styles.field}>
            <PickerField
              label="Contrato / Proyecto"
              required
              value={proyectoId}
              items={proyectos}
              valueKey="id"
              labelKey="descontratoproyecto"
              onChange={setProyectoId}
              placeholder="Elige un proyecto"
              disabledMessage={proyectos.length === 0 ? 'Sin proyectos activos' : null}
            />
          </View>

          <View style={styles.field}>
            <PickerField
              label="Área"
              required
              value={areaId}
              items={areas}
              valueKey="id"
              labelKey="display_name"
              onChange={setAreaId}
              placeholder="Elige un área"
              disabledMessage={
                !proyectoId
                  ? 'Elige un proyecto primero'
                  : areas.length === 0
                    ? 'Este proyecto no tiene áreas'
                    : null
              }
            />
            {proyectoId && areas.length === 0 && (
              <Text style={styles.hintWarn}>
                Carga las áreas del proyecto desde Configuración → Áreas.
              </Text>
            )}
          </View>

          <View style={styles.field}>
            <PickerField
              label="Especialidad"
              required
              value={especialidadId}
              items={especialidades}
              valueKey="id"
              labelKey="display_name"
              onChange={setEspecialidadId}
              placeholder="Elige una especialidad"
              disabledMessage={!areaId ? 'Elige un área primero' : null}
            />
          </View>

          <View style={styles.field}>
            <PickerField
              label="Centro de costo"
              required
              value={centroCostoId}
              items={centrosCosto}
              valueKey="id"
              labelKey="display_name"
              onChange={setCentroCostoId}
              placeholder="Elige un centro de costo"
              disabledMessage={!especialidadId ? 'Elige una especialidad primero' : null}
            />
          </View>
        </View>

        {/* ─── Sección 2: Actividad + trabajadores ─────────────────── */}
        <View style={styles.card}>
          <SectionHeader
            step={2}
            title="Registro de actividad"
            subtitle="Describe la tarea y elige quiénes la ejecutan."
          />

          <View style={styles.field}>
            <Label required>Descripción del trabajo</Label>
            <TextInput
              style={[styles.input, styles.textarea]}
              multiline
              value={desactividad}
              onChangeText={setDesactividad}
              placeholder="Describe la tarea a realizar…"
              placeholderTextColor={colors.text.muted}
            />
          </View>

          <View style={styles.field}>
            <View style={styles.workersHeader}>
              <View style={styles.workersLabelRow}>
                <Label required>Trabajadores</Label>
                <View style={styles.pill}>
                  <Text style={styles.pillText}>
                    {selectedTrabajadores.length} seleccionado
                    {selectedTrabajadores.length === 1 ? '' : 's'}
                  </Text>
                </View>
              </View>
              {trabajadores.length > 0 && (
                <TouchableOpacity onPress={toggleAllVisible}>
                  <Text style={styles.linkAction}>
                    {allVisibleSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {trabajadores.length === 0 ? (
              <View style={styles.emptyBox}>
                <View style={styles.emptyIcon}>
                  <Icon name="user" size={20} color={colors.text.muted} />
                </View>
                <Text style={styles.emptyText}>No hay trabajadores libres para esta fecha.</Text>
                <Text style={styles.emptyHint}>
                  Ya están asignados a otra actividad ese día.
                </Text>
              </View>
            ) : (
              <>
                <TextInput
                  style={[styles.input, styles.searchInput]}
                  value={searchWorker}
                  onChangeText={setSearchWorker}
                  placeholder="Buscar trabajador…"
                  placeholderTextColor={colors.text.muted}
                />
                <View style={styles.workersList}>
                  {filteredTrabajadores.length === 0 ? (
                    <Text style={styles.noResults}>
                      No hay resultados para "{searchWorker}"
                    </Text>
                  ) : (
                    filteredTrabajadores.map((t, i) => {
                      const checked = selectedTrabajadores.includes(t.id)
                      return (
                        <Pressable
                          key={t.id}
                          onPress={() => toggleTrabajador(t.id)}
                          android_ripple={{ color: colors.surfaceSubtle }}
                          style={[
                            styles.workerRow,
                            i === filteredTrabajadores.length - 1 && { borderBottomWidth: 0 },
                            checked && styles.workerRowChecked,
                          ]}
                        >
                          <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                            {checked ? (
                              <Text style={styles.checkboxTick}>✓</Text>
                            ) : null}
                          </View>
                          <View style={styles.avatar}>
                            <Text style={styles.avatarText}>{initials(t.nbrcompleto)}</Text>
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.workerName} numberOfLines={1}>
                              {t.nbrcompleto}
                            </Text>
                            <Text style={styles.workerCat} numberOfLines={1}>
                              {t.descategoriatrabajador || 'Sin categoría'}
                            </Text>
                          </View>
                        </Pressable>
                      )
                    })
                  )}
                </View>
              </>
            )}
          </View>
        </View>

        {/* Footer con CTAs */}
        <View style={styles.footerBar}>
          <Text style={styles.footerHint}>
            {canSubmit
              ? 'Todo listo para crear la actividad.'
              : 'Completa los campos obligatorios para continuar.'}
          </Text>
          <View style={styles.footerActions}>
            <TouchableOpacity
              style={styles.btnSecondary}
              onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TareoStack'))}
            >
              <Text style={styles.btnSecondaryText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnPrimary, (!canSubmit || saving) && { opacity: 0.5 }]}
              onPress={submit}
              disabled={!canSubmit || saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.text.inverse} />
              ) : (
                <>
                  <Icon name="plus" size={16} color={colors.text.inverse} strokeWidth={2.5} />
                  <Text style={styles.btnPrimaryText}>Crear actividad</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.base, paddingBottom: spacing['4xl'] },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  pageHint: { ...type.body, color: colors.text.secondary, marginBottom: spacing.md },

  // Card + sección
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.base,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingBottom: spacing.md,
    marginBottom: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSubtle,
  },
  stepBadge: {
    width: 28, height: 28, borderRadius: radius.pill,
    backgroundColor: colors.brand[50],
    alignItems: 'center', justifyContent: 'center',
  },
  stepBadgeText: { ...type.label, color: colors.brand[700], fontWeight: '700' },
  sectionTitle: { ...type.bodyStrong, color: colors.text.primary },
  sectionSubtitle: { ...type.caption, color: colors.text.tertiary, marginTop: 2 },

  // Campos
  field: { marginBottom: spacing.base },
  label: { ...type.label, color: colors.text.secondary, marginBottom: 6 },
  required: { color: colors.danger[500] },
  hintWarn: { ...type.caption, color: colors.warning[700], marginTop: 6 },

  // Select list (radio)
  selectList: {
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    overflow: 'hidden',
  },
  selectRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.md, paddingHorizontal: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.surfaceSubtle,
    minHeight: 48,
  },
  selectRowActive: { backgroundColor: colors.brand[50] },
  radio: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: colors.borderStrong,
    alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.md,
  },
  radioActive: { borderColor: colors.brand[600] },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand[600] },
  selectText: { ...type.body, color: colors.text.primary, flex: 1 },
  selectTextActive: { color: colors.brand[700], fontWeight: '600' },
  selectEmpty: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.md, backgroundColor: colors.surface, minHeight: 48,
    justifyContent: 'center',
  },
  selectEmptyDisabled: { backgroundColor: colors.surfaceSubtle },
  selectEmptyText: { ...type.body, color: colors.text.muted },

  // Input
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    ...type.body, color: colors.text.primary, backgroundColor: colors.surface,
    minHeight: 48,
  },
  textarea: { minHeight: 96, textAlignVertical: 'top', paddingTop: spacing.md },

  // Trabajadores
  workersHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: spacing.sm,
  },
  workersLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  pill: {
    paddingHorizontal: spacing.sm, paddingVertical: 3,
    borderRadius: radius.pill, backgroundColor: colors.brand[50],
  },
  pillText: { ...type.overline, color: colors.brand[700], letterSpacing: 0.3 },
  linkAction: { ...type.caption, color: colors.brand[600], fontWeight: '700' },

  searchInput: { marginBottom: spacing.sm },
  workersList: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    maxHeight: 320, overflow: 'hidden',
  },
  workerRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: 10, paddingHorizontal: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.surfaceSubtle,
    minHeight: 52,
  },
  workerRowChecked: { backgroundColor: colors.brand[50] },
  checkbox: {
    width: 20, height: 20, borderRadius: 4,
    borderWidth: 2, borderColor: colors.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.brand[600], borderColor: colors.brand[600] },
  checkboxTick: { color: colors.text.inverse, fontSize: 13, fontWeight: '900', lineHeight: 14 },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { ...type.caption, color: colors.text.secondary, fontWeight: '700' },
  workerName: { ...type.body, color: colors.text.primary },
  workerCat: { ...type.caption, color: colors.text.tertiary, marginTop: 1 },

  emptyBox: {
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
    borderRadius: radius.md, paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 40, height: 40, borderRadius: radius.pill,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
  },
  emptyText: { ...type.body, color: colors.text.secondary },
  emptyHint: { ...type.caption, color: colors.text.muted, marginTop: 2 },
  noResults: { ...type.body, color: colors.text.tertiary, textAlign: 'center', padding: spacing.lg },

  // Footer
  footerBar: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.card,
    marginTop: spacing.sm,
  },
  footerHint: { ...type.caption, color: colors.text.tertiary, marginBottom: spacing.sm },
  footerActions: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' },
  btnSecondary: {
    paddingHorizontal: spacing.base, paddingVertical: 10,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, minHeight: 40, justifyContent: 'center',
  },
  btnSecondaryText: { ...type.label, color: colors.text.secondary },
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing.base, paddingVertical: 10,
    borderRadius: radius.md, backgroundColor: colors.brand[600],
    minHeight: 40, justifyContent: 'center',
  },
  btnPrimaryText: { ...type.label, color: colors.text.inverse, fontWeight: '700' },
})
