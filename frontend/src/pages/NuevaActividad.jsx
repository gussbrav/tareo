import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { actividadesApi } from '../api/actividades'
import { catalogosApi } from '../api/catalogos'
import { today } from '../lib/format'

export default function NuevaActividad() {
  const navigate = useNavigate()
  const [fecha, setFecha] = useState(today())
  const [proyectos, setProyectos] = useState([])
  const [areas, setAreas] = useState([])
  const [especialidades, setEspecialidades] = useState([])
  const [centrosCosto, setCentrosCosto] = useState([])
  const [trabajadores, setTrabajadores] = useState([])

  const [proyectoId, setProyectoId] = useState('')
  const [areaId, setAreaId] = useState('')
  const [especialidadId, setEspecialidadId] = useState('')
  const [centroCostoId, setCentroCostoId] = useState('')
  const [selectedTrabajadores, setSelectedTrabajadores] = useState(() => new Set())
  const [desactividad, setDesactividad] = useState('')

  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [saving, setSaving] = useState(false)

  // Carga inicial: proyectos + áreas + trabajadores del día.
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

  const toggleTrabajador = (id) => {
    setSelectedTrabajadores((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
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
      // refrescar trabajadores disponibles (los recién asignados desaparecen)
      const nuevos = await catalogosApi.trabajadoresDisponibles(fecha)
      setTrabajadores(nuevos)
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo crear la actividad')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Nueva actividad</h1>
        <button className="btn-secondary" onClick={() => navigate('/tareo')}>
          Ir al tareo →
        </button>
      </div>

      <form onSubmit={submit} className="card space-y-5">
        <section>
          <h2 className="text-sm font-semibold text-brand-700 uppercase tracking-wide mb-3">
            Selección de fecha y trabajo
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Fecha de trabajo *</label>
              <input type="date" className="input" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
            </div>
            <div>
              <label className="label">Contrato / Proyecto *</label>
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
              <label className="label">Área *</label>
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
              <label className="label">Especialidad *</label>
              <select
                className="input"
                value={especialidadId}
                onChange={(e) => setEspecialidadId(e.target.value)}
                required
                disabled={!areaId}
              >
                <option value="">{areaId ? 'Selecciona…' : 'Elige un área primero'}</option>
                {especialidades.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.display_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Centro de costo *</label>
              <select
                className="input"
                value={centroCostoId}
                onChange={(e) => setCentroCostoId(e.target.value)}
                required
                disabled={!especialidadId}
              >
                <option value="">{especialidadId ? 'Selecciona…' : 'Elige una especialidad primero'}</option>
                {centrosCosto.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.display_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-brand-700 uppercase tracking-wide mb-3">
            Registro de actividad
          </h2>
          <div>
            <label className="label">Descripción del trabajo *</label>
            <textarea
              className="input min-h-[80px]"
              value={desactividad}
              onChange={(e) => setDesactividad(e.target.value)}
              placeholder="Describe la tarea a realizar…"
              required
            />
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">
                Trabajadores * <span className="text-xs text-slate-400">(seleccionados: {selectedTrabajadores.size})</span>
              </label>
              {trabajadores.length === 0 && (
                <span className="text-xs text-slate-400">No hay trabajadores libres para esta fecha</span>
              )}
            </div>

            <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg divide-y">
              {trabajadores.map((t) => (
                <label
                  key={t.id}
                  className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    className="rounded text-brand-600 focus:ring-brand-500"
                    checked={selectedTrabajadores.has(t.id)}
                    onChange={() => toggleTrabajador(t.id)}
                  />
                  <div className="flex-1">
                    <div className="text-sm text-slate-900">{t.nbrcompleto}</div>
                    <div className="text-xs text-slate-500">{t.descategoriatrabajador || '—'}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>
        )}
        {ok && (
          <div className="rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-3 py-2">{ok}</div>
        )}

        <div className="flex gap-3 justify-end">
          <button type="button" className="btn-secondary" onClick={() => navigate('/tareo')}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={!canSubmit || saving}>
            {saving ? 'Guardando…' : 'Iniciar actividad'}
          </button>
        </div>
      </form>
    </div>
  )
}
