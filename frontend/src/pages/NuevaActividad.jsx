import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { actividadesApi } from '../api/actividades'
import { catalogosApi } from '../api/catalogos'
import DateField from '../components/admin/DateField.jsx'
import { Icon } from '../components/admin/Icons.jsx'
import SearchableSelect from '../components/admin/SearchableSelect.jsx'
import { today } from '../lib/format'

function initials(name) {
  if (!name) return '??'
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export default function NuevaActividad() {
  const navigate = useNavigate()
  const [fecha, setFecha] = useState(today())
  const [proyectos, setProyectos] = useState([])
  const [areas, setAreas] = useState([])
  const [loadingAreas, setLoadingAreas] = useState(false)
  const [especialidades, setEspecialidades] = useState([])
  const [loadingEspecialidades, setLoadingEspecialidades] = useState(false)
  const [centrosCosto, setCentrosCosto] = useState([])
  const [loadingCC, setLoadingCC] = useState(false)
  const [trabajadores, setTrabajadores] = useState([])
  const [searchWorker, setSearchWorker] = useState('')

  const [proyectoId, setProyectoId] = useState('')
  const [areaId, setAreaId] = useState('')
  const [especialidadId, setEspecialidadId] = useState('')
  const [centroCostoId, setCentroCostoId] = useState('')
  const [selectedTrabajadores, setSelectedTrabajadores] = useState(() => new Set())
  const [desactividad, setDesactividad] = useState('')

  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [saving, setSaving] = useState(false)

  // Carga proyectos al inicio
  useEffect(() => {
    catalogosApi.proyectos()
      .then((prs) => {
        setProyectos(prs)
        if (prs.length && !proyectoId) setProyectoId(prs[0].id)
      })
      .catch(() => setError('No se pudieron cargar los proyectos'))
  }, []) // eslint-disable-line

  // Áreas del proyecto seleccionado — se recargan si cambia el proyecto,
  // se limpian los hijos (área, especialidad, CC) para evitar inconsistencias.
  useEffect(() => {
    setAreas([])
    setAreaId('')
    setEspecialidades([])
    setEspecialidadId('')
    setCentrosCosto([])
    setCentroCostoId('')
    if (proyectoId) {
      setLoadingAreas(true)
      catalogosApi.areas(proyectoId)
        .then(setAreas)
        .catch(() => setError('No se pudieron cargar las áreas del proyecto'))
        .finally(() => setLoadingAreas(false))
    }
  }, [proyectoId])

  // Los trabajadores dependen del proyecto (scoping) Y de la fecha (ocupación).
  // Sin proyecto no hay a quién listar → lista vacía y aviso via UI.
  useEffect(() => {
    setSelectedTrabajadores(new Set())
    if (!proyectoId || !fecha) {
      setTrabajadores([])
      return
    }
    catalogosApi.trabajadoresDisponibles(fecha, proyectoId)
      .then(setTrabajadores)
      .catch(() => setTrabajadores([]))
  }, [fecha, proyectoId])

  useEffect(() => {
    setEspecialidades([])
    setEspecialidadId('')
    setCentrosCosto([])
    setCentroCostoId('')
    if (areaId) {
      setLoadingEspecialidades(true)
      catalogosApi.especialidades(areaId)
        .then(setEspecialidades)
        .finally(() => setLoadingEspecialidades(false))
    }
  }, [areaId])

  useEffect(() => {
    setCentrosCosto([])
    setCentroCostoId('')
    if (especialidadId) {
      setLoadingCC(true)
      catalogosApi.centrosCosto(especialidadId)
        .then((data) => {
          setCentrosCosto(data)
          const manoDeObra = data.find((c) => (c.nbrcentrocosto || '').toLowerCase().includes('mano de obra'))
          if (manoDeObra) setCentroCostoId(manoDeObra.id)
        })
        .finally(() => setLoadingCC(false))
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
      selectedTrabajadores.size > 0,
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

  const toggleTrabajador = (id) => {
    setSelectedTrabajadores((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAllVisible = () => {
    const visibleIds = filteredTrabajadores.map((t) => t.id)
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedTrabajadores.has(id))
    setSelectedTrabajadores((prev) => {
      const next = new Set(prev)
      if (allSelected) visibleIds.forEach((id) => next.delete(id))
      else visibleIds.forEach((id) => next.add(id))
      return next
    })
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setOk('')
    setSaving(true)
    try {
      const res = await actividadesApi.crearBulk({
        fecactividad: fecha,
        proyecto_id: proyectoId,
        centro_costo_id: centroCostoId,
        desactividad: desactividad.trim(),
        trabajador_ids: Array.from(selectedTrabajadores),
      })
      setOk(`Se crearon ${res.created} actividad(es).`)
      setDesactividad('')
      setSelectedTrabajadores(new Set())
      const nuevos = await catalogosApi.trabajadoresDisponibles(fecha, proyectoId)
      setTrabajadores(nuevos)
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo crear la actividad')
    } finally {
      setSaving(false)
    }
  }

  const visibleIds = filteredTrabajadores.map((t) => t.id)
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedTrabajadores.has(id))

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Nueva actividad</h1>
          <p className="text-slate-500 text-sm mt-1">
            Registra una tarea y asígnala a uno o más trabajadores.
          </p>
        </div>
        <button className="btn-ghost btn-sm" onClick={() => navigate('/tareo')}>
          <Icon.ArrowUp className="w-4 h-4 rotate-[-90deg]" />
          Volver al tareo
        </button>
      </div>

      <form onSubmit={submit} className="space-y-4">
        {/* ── Sección 1: Contexto ────────────────────────────────────── */}
        <div className="card">
          <SectionHeader
            step={1}
            title="Selección de fecha y trabajo"
            subtitle="Elige día, proyecto y estructura contable."
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Fecha de trabajo <Req /></label>
              <DateField value={fecha} onChange={(e) => setFecha(e.target.value)} required />
            </div>
            <div>
              <label className="label">Contrato / Proyecto <Req /></label>
              <SearchableSelect
                value={proyectoId}
                onChange={setProyectoId}
                options={proyectos}
                getLabel={(p) => p.descontratoproyecto || p.nbrproyecto}
                placeholder="Selecciona…"
                emptyText="No hay proyectos activos"
                required
              />
            </div>
            <div>
              <label className="label inline-flex items-center gap-1.5">
                Área <Req />
                {/* Tooltip solo cuando la API confirmó que no hay áreas —
                    permite guiar al admin hacia Configuración. */}
                {proyectoId && !loadingAreas && areas.length === 0 && (
                  <InfoTooltip>
                    Carga las áreas de este proyecto desde <strong>Configuración → Áreas</strong>
                    {' '}(o impórtalas del Excel).
                  </InfoTooltip>
                )}
              </label>
              <SearchableSelect
                value={areaId}
                onChange={setAreaId}
                options={areas}
                placeholder="Selecciona…"
                disabled={!proyectoId || loadingAreas || areas.length === 0}
                disabledText={!proyectoId ? 'Elige un proyecto primero' : undefined}
                loading={loadingAreas}
                emptyText="Este proyecto no tiene áreas"
                required
              />
            </div>
            <div>
              <label className="label">Especialidad <Req /></label>
              <SearchableSelect
                value={especialidadId}
                onChange={setEspecialidadId}
                options={especialidades}
                placeholder="Selecciona…"
                disabled={!areaId || loadingEspecialidades || especialidades.length === 0}
                disabledText={!areaId ? 'Elige un área primero' : undefined}
                loading={loadingEspecialidades}
                emptyText="Esta área no tiene especialidades"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Centro de costo <Req /></label>
              <SearchableSelect
                value={centroCostoId}
                onChange={setCentroCostoId}
                options={centrosCosto}
                placeholder="Selecciona…"
                disabled={!especialidadId || loadingCC || centrosCosto.length === 0}
                disabledText={!especialidadId ? 'Elige una especialidad primero' : undefined}
                loading={loadingCC}
                emptyText="Esta especialidad no tiene centros de costo"
                required
              />
            </div>
          </div>
        </div>

        {/* ── Sección 2: Actividad + trabajadores ────────────────────── */}
        <div className="card">
          <SectionHeader
            step={2}
            title="Registro de actividad"
            subtitle="Describe la tarea y elige quiénes la ejecutan."
          />

          <div>
            <label className="label">Descripción del trabajo <Req /></label>
            <textarea
              className="input min-h-[96px] resize-y"
              value={desactividad}
              onChange={(e) => setDesactividad(e.target.value)}
              placeholder="Describe la tarea a realizar…"
              required
            />
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0 flex items-center gap-2">
                Trabajadores <Req />
                <span className="pill-brand !py-0 !px-2">
                  {selectedTrabajadores.size} seleccionado{selectedTrabajadores.size === 1 ? '' : 's'}
                </span>
              </label>
              {trabajadores.length > 0 && (
                <button
                  type="button"
                  onClick={toggleAllVisible}
                  className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                >
                  {allVisibleSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
                </button>
              )}
            </div>

            {trabajadores.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 py-8 text-center">
                <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                  <Icon.Users className="w-5 h-5" />
                </div>
                <p className="text-sm text-slate-600">No hay trabajadores libres para esta fecha.</p>
                <p className="text-xs text-slate-400 mt-1">Ya están asignados a otra actividad ese día.</p>
              </div>
            ) : (
              <>
                <div className="relative mb-2">
                  <Icon.Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="search"
                    className="input input-sm pl-8"
                    placeholder="Buscar trabajador…"
                    value={searchWorker}
                    onChange={(e) => setSearchWorker(e.target.value)}
                  />
                </div>
                <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                  {filteredTrabajadores.length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-500">
                      No hay resultados para "{searchWorker}"
                    </p>
                  ) : (
                    filteredTrabajadores.map((t) => {
                      const checked = selectedTrabajadores.has(t.id)
                      return (
                        <label
                          key={t.id}
                          className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                            checked ? 'bg-brand-50/60' : 'hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="rounded border-slate-300 text-brand-600 focus:ring-brand-500/30"
                            checked={checked}
                            onChange={() => toggleTrabajador(t.id)}
                          />
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold shrink-0">
                            {initials(t.nbrcompleto)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-slate-900 truncate">{t.nbrcompleto}</div>
                            <div className="text-xs text-slate-500 truncate">
                              {t.descategoriatrabajador || 'Sin categoría'}
                            </div>
                          </div>
                        </label>
                      )
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>
        )}
        {ok && (
          <div className="rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-3 py-2">{ok}</div>
        )}

        {/* Sticky footer con CTAs */}
        <div className="sticky bottom-4 flex items-center justify-between gap-3 bg-white/95 backdrop-blur border border-slate-200 rounded-xl px-4 py-3 shadow-elevated">
          <p className="text-xs text-slate-500 hidden sm:block">
            {canSubmit
              ? 'Todo listo para crear la actividad.'
              : 'Completa los campos obligatorios para continuar.'}
          </p>
          <div className="flex gap-2 ml-auto">
            <button type="button" className="btn-secondary btn-sm" onClick={() => navigate('/tareo')}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary btn-sm" disabled={!canSubmit || saving}>
              {saving ? 'Creando…' : (
                <>
                  <Icon.Plus className="w-4 h-4" />
                  Crear actividad
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

function SectionHeader({ step, title, subtitle }) {
  return (
    <div className="flex items-start gap-3 mb-4 pb-3 border-b border-slate-100">
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-brand-50 text-brand-700 text-xs font-semibold shrink-0">
        {step}
      </span>
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

function Req() {
  return <span className="text-red-500">*</span>
}

/**
 * Tooltip discreto sobre un ícono ⓘ. Se abre al hover Y al focus (a11y).
 * Reemplaza el banner naranja que causaba layout shift + intermitencia
 * durante la carga async del catálogo. Ver comentario en el consumer.
 */
function InfoTooltip({ children }) {
  return (
    <span className="relative inline-flex items-center group">
      <button
        type="button"
        tabIndex={0}
        aria-label="Más información"
        className="text-amber-500 hover:text-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40 rounded-full"
      >
        <Icon.Info className="w-3.5 h-3.5" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 transition-opacity absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 bg-slate-900 text-white text-xs font-normal leading-relaxed rounded-md px-3 py-2 shadow-lg z-30"
      >
        {children}
        <span className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-900" />
      </span>
    </span>
  )
}
