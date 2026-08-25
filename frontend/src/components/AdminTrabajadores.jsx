import { useEffect, useState } from 'react'

import { adminApi } from '../api/admin'

const EMPTY = {
  nbrcompleto: '',
  numidentificacion: '',
  categoria_id: '',
  desestadotrabajador: 'activo',
  flgativotrabajador: true,
}

export default function AdminTrabajadores() {
  const [items, setItems] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    Promise.all([adminApi.trabajadores.list(), adminApi.categorias.list()])
      .then(([ts, cs]) => {
        setItems(ts)
        setCategorias(cs.filter((c) => c.flgactivocategoria))
      })
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const openNew = () => { setEditing('new'); setForm(EMPTY); setError('') }
  const openEdit = (t) => {
    setEditing(t.id)
    setForm({
      nbrcompleto: t.nbrcompleto || '',
      numidentificacion: t.numidentificacion || '',
      categoria_id: t.categoria_id || '',
      desestadotrabajador: t.desestadotrabajador || 'activo',
      flgativotrabajador: t.flgativotrabajador,
    })
    setError('')
  }
  const close = () => { setEditing(null); setError('') }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const payload = { ...form }
      if (!payload.categoria_id) delete payload.categoria_id
      if (editing === 'new') await adminApi.trabajadores.create(payload)
      else await adminApi.trabajadores.update(editing, payload)
      close()
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo guardar')
    }
  }

  const del = async (id, nombre) => {
    if (!confirm(`¿Desactivar a ${nombre}?`)) return
    await adminApi.trabajadores.remove(id)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">{items.length} trabajador(es)</p>
        <button className="btn-primary" onClick={openNew}>+ Nuevo</button>
      </div>

      {loading ? (
        <p className="text-slate-500 text-sm">Cargando…</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-500 text-xs uppercase text-left">
              <tr>
                <th className="py-2">Nombre</th>
                <th className="py-2">Documento</th>
                <th className="py-2">Categoría</th>
                <th className="py-2">Estado</th>
                <th className="py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((t) => (
                <tr key={t.id}>
                  <td className="py-2 text-slate-900">{t.nbrcompleto}</td>
                  <td className="py-2 text-slate-600">{t.numidentificacion || '—'}</td>
                  <td className="py-2 text-slate-600">{t.categoria_nombre || t.descategoriatrabajador || '—'}</td>
                  <td className="py-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      t.flgativotrabajador ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                            : 'bg-slate-100 text-slate-600'
                    }`}>
                      {t.desestadotrabajador}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <button className="text-brand-600 hover:text-brand-700 text-xs mr-3" onClick={() => openEdit(t)}>Editar</button>
                    <button className="text-red-600 hover:text-red-700 text-xs" onClick={() => del(t.id, t.nbrcompleto)}>Desactivar</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-slate-500">Sin trabajadores</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editing !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-xl shadow-elevated w-full max-w-md">
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">
                {editing === 'new' ? 'Nuevo trabajador' : 'Editar trabajador'}
              </h3>
              <button className="text-slate-400 text-2xl leading-none" onClick={close}>×</button>
            </div>
            <form onSubmit={submit} className="p-5 space-y-3">
              <div>
                <label className="label">Nombre completo *</label>
                <input className="input" value={form.nbrcompleto}
                       onChange={(e) => setForm({ ...form, nbrcompleto: e.target.value })} required />
              </div>
              <div>
                <label className="label">Documento</label>
                <input className="input" value={form.numidentificacion}
                       onChange={(e) => setForm({ ...form, numidentificacion: e.target.value })} />
              </div>
              <div>
                <label className="label">Categoría</label>
                <select className="input" value={form.categoria_id}
                        onChange={(e) => setForm({ ...form, categoria_id: e.target.value })}>
                  <option value="">— Sin categoría —</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>{c.codcategoria} · {c.nbrcategoria}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1">
                  Si falta la categoría, agregala en la tab "Categorías".
                </p>
              </div>
              <div>
                <label className="label">Estado</label>
                <select className="input" value={form.desestadotrabajador}
                        onChange={(e) => setForm({ ...form, desestadotrabajador: e.target.value })}>
                  <option value="activo">activo</option>
                  <option value="inactivo">inactivo</option>
                  <option value="vacaciones">vacaciones</option>
                </select>
              </div>
              {error && <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-secondary" onClick={close}>Cancelar</button>
                <button type="submit" className="btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
