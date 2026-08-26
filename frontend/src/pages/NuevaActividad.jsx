import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { actividadesApi } from '../api/actividades'
import { catalogosApi } from '../api/catalogos'
import DateField from '../components/admin/DateField.jsx'
import { Icon } from '../components/admin/Icons.jsx'
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
  const [especialidades, setEspecialidades] = useState([])
  const [centrosCosto, setCentrosCosto] = useState([])
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

  useEffect(() => {
    Promise.all([catalogosApi.proyectos(), catalogosApi.areas()])
      .then(([prs, ars]) => {
        setProyectos(prs)
        setAreas(ars)
        if (prs.length && !proyectoId) setProyectoId(prs[0].id)
      })
      .catch(() => setError('No se pudieron cargar los catálogos'))
  }, []) // eslint-disable-line

  useEffect(() => {
    catalogosApi.trabajadoresDisponibles(fecha).then(setTrabajadores).catch(() => setTrabajadores([]))
    setSelectedTrabajadores(new Set())
  }, [fecha])

  useEffect(() => {
    setEspecialidades([])
    setEspecialidadId('')
    setCentrosCosto([])
    setCentroCostoId('')
    if (areaId) catalogosApi.especialidades(areaId).then(setEspecialidades)
  }, [areaId])

  useEffect(() => {
    setCentrosCosto([])
    setCentroCostoId('')
    if (especialidadId) {
      catalogosApi.centrosCosto(especialidadId).then((data) => {
        setCentrosCosto(data)
        const manoDeObra = data.find((c) => (c.nbrcentrocosto || '').toLowerCase().includes('mano de obra'))
        if (manoDeObra) setCentroCostoId(manoDeObra.id)
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
      const nuevos = await catalogosApi.trabajadoresDisponibles(fecha)
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
            Registrá una tarea y asignala a uno o más trabajadores.
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
            subtitle="Elegí día, proyecto y estructura contable."
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Fecha de trabajo <Req /></label>
              <DateField value={fecha} onChange={(e) => setFecha(e.target.value)} required />
            </div>
            <div>
              <label className="label">Contrato / Proyecto <Req /></label>
              <select className="input" value={proyectoId} onChange={(e) => setProyectoId(e.target.value)} required>
                <option value="">Selecciona…</option>
                {proyectos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.descontratoproyecto || p.nbrproyecto}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Área <Req /></label>
              <select className="input" value={areaId} onChange={(e) => setAreaId(e.target.value)} required>
                <option value="">Selecciona…</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.display_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Especialidad <Req /></label>
              <select
                className="input"
                value={especialidadId}
                onChange={(e) => setEspecialidadId(e.target.value)}
                required
                disabled={!areaId}
              >
                <option value="">{areaId ? 'Selecciona…' : 'Elegí un área primero'}</option>
                {especialidades.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.display_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Centro de costo <Req /></label>
              <select
                className="input"
                value={centroCostoId}
                onChange={(e) => setCentroCostoId(e.target.value)}
                required
                disabled={!especialidadId}
              >
                <option value="">{especialidadId ? 'Selecciona…' : 'Elegí una especialidad primero'}</option>
                {centrosCosto.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.display_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ── Sección 2: Actividad + trabajadores ────────────────────── */}
        <div className="card">
          <SectionHeader
            step={2}
            title="Registro de actividad"
            subtitle="Describí la tarea y elegí quiénes la ejecutan."
          />

          <div>
            <label className="label">Descripción del trabajo <Req /></label>
            <textarea
              className="input min-h-[96px] resize-y"
              value={desactividad}
              onChange={(e) => setDesactividad(e.target.value)}
              placeholder="Describí la tarea a realizar…"
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
              : 'Completá los campos obligatorios para continuar.'}
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
