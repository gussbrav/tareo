import { useEffect, useState } from 'react'

import { actividadesApi } from '../api/actividades'
import { fmtHM } from '../lib/format'

export default function EditarActividadModal({ actividadId, onClose, onSaved, canDelete }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    desactividad: '',
    horinicio: '',
    horfin: '',
    desestadoactividad: 'iniciado',
    desobservaciones: '',
  })
  const [meta, setMeta] = useState(null)

  useEffect(() => {
    setLoading(true)
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
      .catch(() => setError('No se pudo cargar la actividad'))
      .finally(() => setLoading(false))
  }, [actividadId])

  const handleChange = (k) => (e) => setForm((prev) => ({ ...prev, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      // Validaciones cliente
      if (!form.desactividad.trim()) {
        setError('La descripción es obligatoria')
        setSaving(false)
        return
      }
      if (form.desestadoactividad === 'finalizado' && !form.horfin) {
        setError('La hora de fin es obligatoria al finalizar')
        setSaving(false)
        return
      }
      const payload = {
        desactividad: form.desactividad.trim(),
        desestadoactividad: form.desestadoactividad,
        desobservaciones: form.desobservaciones.trim() || null,
      }
      if (form.horinicio) payload.horinicio = `${form.horinicio}:00`
      if (form.horfin) payload.horfin = `${form.horfin}:00`

      await actividadesApi.editar(actividadId, payload)
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    setError('')
    try {
      await actividadesApi.eliminar(actividadId)
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo eliminar')
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      <div className="bg-white rounded-xl shadow-elevated w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="font-semibold text-slate-900">Editar actividad</h2>
          <button className="text-slate-400 hover:text-slate-600 text-2xl leading-none" onClick={onClose}>
            ×
          </button>
        </div>

        {loading ? (
          <div className="p-6 text-slate-500 text-sm">Cargando…</div>
        ) : confirmDelete ? (
          <div className="p-5 space-y-4">
            <p className="text-sm text-slate-800">
              ¿Confirmás eliminar la actividad de <strong>{meta?.trabajador_nombre}</strong>? Esta acción no se puede deshacer.
            </p>
            {error && <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>}
            <div className="flex gap-2 justify-end">
              <button className="btn-secondary" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                Cancelar
              </button>
              <button className="btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Eliminando…' : 'Confirmar eliminación'}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="p-5 space-y-4">
            <div className="text-xs text-slate-500 space-y-0.5">
              <div>Trabajador: <strong className="text-slate-800">{meta?.trabajador_nombre}</strong></div>
              <div>Fecha: <strong className="text-slate-800">{meta?.fecactividad}</strong></div>
              <div>Centro de Costo: {meta?.centro_costo_nombre || '—'} · Proyecto: {meta?.proyecto_nombre || '—'}</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="label">Estado *</label>
                <select className="input" value={form.desestadoactividad} onChange={handleChange('desestadoactividad')}>
                  <option value="iniciado">Iniciado</option>
                  <option value="finalizado">Finalizado</option>
                </select>
              </div>
              <div>
                <label className="label">Hora inicio</label>
                <input type="time" className="input" value={form.horinicio} onChange={handleChange('horinicio')} />
              </div>
              <div>
                <label className="label">Hora fin</label>
                <input type="time" className="input" value={form.horfin} onChange={handleChange('horfin')} />
              </div>
            </div>

            <div>
              <label className="label">Descripción *</label>
              <textarea
                className="input min-h-[70px]"
                value={form.desactividad}
                onChange={handleChange('desactividad')}
                required
              />
            </div>

            <div>
              <label className="label">Observaciones</label>
              <textarea
                className="input min-h-[70px]"
                value={form.desobservaciones}
                onChange={handleChange('desobservaciones')}
                placeholder="Notas o incidencias (opcional)"
              />
            </div>

            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>
            )}

            <div className="flex justify-between items-center gap-2 pt-2 border-t border-slate-100">
              {canDelete ? (
                <button type="button" className="btn-danger" onClick={() => setConfirmDelete(true)}>
                  Eliminar
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button type="button" className="btn-secondary" onClick={onClose}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
