/**
 * AsignarProyectosModal — asigna un trabajador o usuario a N proyectos.
 *
 * Reusable: recibe una `scopingApi` con { getProyectos(id), setProyectos(id, ids) }
 * — funciona igual para adminApi.trabajadores.scoping y adminApi.usuarios.scoping.
 *
 * UX:
 * - Al abrir carga la lista de proyectos activos + los ya asignados en paralelo.
 * - Checkboxes con búsqueda; "Seleccionar todos"; contador de seleccionados.
 * - Guardar → PUT con el set completo; el backend hace diff.
 * - Cerrar sin cambios no guarda nada (dirty tracking).
 */
import { useEffect, useMemo, useState } from 'react'

import { adminApi } from '../../api/admin'
import { Icon } from './Icons.jsx'
import Modal from './Modal.jsx'

export default function AsignarProyectosModal({
  open,
  onClose,
  scopingApi,
  entityId,
  entityLabel, // string mostrado en el subtitle ("CARLOS RAMIREZ TORRES" o "carlos@x.com")
  onSaved,
  disabled = false, // si es admin (todos los proyectos por rol), muestra estado no editable
  disabledHelp,     // texto explicativo cuando disabled
}) {
  const [proyectos, setProyectos] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [initial, setInitial] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')

  useEffect(() => {
    if (!open || !entityId) return
    setError('')
    setQ('')
    setLoading(true)
    Promise.all([
      adminApi.proyectos.list().then((rs) => rs.filter((p) => p.flgactivoproyecto)),
      scopingApi.getProyectos(entityId),
    ])
      .then(([activos, asignados]) => {
        setProyectos(activos)
        const set = new Set(asignados.proyecto_ids || [])
        setSelected(set)
        setInitial(new Set(set))
      })
      .catch(() => setError('No se pudieron cargar los proyectos'))
      .finally(() => setLoading(false))
  }, [open, entityId, scopingApi])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return proyectos
    return proyectos.filter((p) =>
      [p.descontratoproyecto, p.nbrproyecto, p.cliproyecto, String(p.codproyecto)]
        .some((s) => (s || '').toString().toLowerCase().includes(query)),
    )
  }, [proyectos, q])

  const toggle = (id) =>
    setSelected((prev) => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  const toggleAllVisible = () => {
    const visibleIds = filtered.map((p) => p.id)
    const allSel = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))
    setSelected((prev) => {
      const n = new Set(prev)
      if (allSel) visibleIds.forEach((id) => n.delete(id))
      else visibleIds.forEach((id) => n.add(id))
      return n
    })
  }

  const isDirty = useMemo(() => {
    if (selected.size !== initial.size) return true
    for (const id of selected) if (!initial.has(id)) return true
    return false
  }, [selected, initial])

  const save = async () => {
    setError('')
    setSaving(true)
    try {
      await scopingApi.setProyectos(entityId, Array.from(selected))
      onSaved?.(Array.from(selected))
      onClose?.()
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo guardar la asignación')
    } finally {
      setSaving(false)
    }
  }

  const visibleIds = filtered.map((p) => p.id)
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))

  return (
    <Modal
      open={open}
      onClose={saving ? undefined : onClose}
      title="Asignar proyectos"
      subtitle={entityLabel}
      maxWidth="max-w-lg"
    >
      <div className="p-5 space-y-4">
        {disabled && (
          <div className="rounded-md bg-slate-50 border border-slate-200 text-slate-700 text-sm px-3 py-2">
            {disabledHelp || 'Este usuario tiene acceso a todos los proyectos por su rol.'}
          </div>
        )}

        {!disabled && (
          <>
            {/* Buscador */}
            <div className="relative">
              <Icon.Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar proyecto…"
                className="input input-sm pl-9 w-full"
              />
            </div>

            {/* Counters + seleccionar todos visibles */}
            <div className="flex items-center justify-between text-sm text-slate-600">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500/30"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                  disabled={loading || filtered.length === 0}
                />
                Seleccionar los {filtered.length} visibles
              </label>
              <span className="tabular-nums text-xs text-slate-500">
                {selected.size} de {proyectos.length} asignados
              </span>
            </div>

            {/* Lista */}
            <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
              {loading ? (
                <p className="py-6 text-center text-sm text-slate-500">Cargando…</p>
              ) : filtered.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">
                  {proyectos.length === 0 ? 'No hay proyectos activos' : `Sin resultados para "${q}"`}
                </p>
              ) : (
                filtered.map((p) => {
                  const checked = selected.has(p.id)
                  const label = p.descontratoproyecto || p.nbrproyecto || `Código ${p.codproyecto}`
                  const secondary = [p.cliproyecto, p.nbrproyecto].filter(Boolean).join(' · ')
                  return (
                    <label
                      key={p.id}
                      className={`flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                        checked ? 'bg-brand-50/60' : 'hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500/30"
                        checked={checked}
                        onChange={() => toggle(p.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">{label}</div>
                        {secondary && (
                          <div className="text-xs text-slate-500 truncate mt-0.5">{secondary}</div>
                        )}
                      </div>
                    </label>
                  )
                })
              )}
            </div>

            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
                {error}
              </div>
            )}
          </>
        )}
      </div>

      <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-2">
        <button type="button" className="btn-ghost btn-sm" onClick={onClose} disabled={saving}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn-primary btn-sm"
          onClick={save}
          disabled={saving || loading || disabled || !isDirty}
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </Modal>
  )
}
