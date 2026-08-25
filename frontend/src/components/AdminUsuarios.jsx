import { useEffect, useState } from 'react'

import { adminApi } from '../api/admin'

const EMPTY = {
  email: '',
  password: '',
  first_name: '',
  last_name: '',
  role: 'trabajador',
  trabajador_id: '',
  is_active: true,
}

export default function AdminUsuarios() {
  const [items, setItems] = useState([])
  const [trabajadores, setTrabajadores] = useState([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    Promise.all([adminApi.usuarios.list(), adminApi.trabajadores.list()])
      .then(([us, ts]) => {
        setItems(us)
        setTrabajadores(ts.filter((t) => t.flgativotrabajador))
      })
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const openNew = () => { setEditing('new'); setForm(EMPTY); setError('') }
  const openEdit = (u) => {
    setEditing(u.id)
    setForm({
      email: u.email,
      password: '',
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      role: u.role,
      trabajador_id: u.trabajador_id || '',
      is_active: u.is_active,
    })
    setError('')
  }
  const close = () => { setEditing(null); setError('') }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const payload = { ...form }
      if (!payload.trabajador_id) delete payload.trabajador_id
      if (editing === 'new') {
        if (!payload.password || payload.password.length < 6) {
          setError('Password mínimo 6 caracteres')
          return
        }
        await adminApi.usuarios.create(payload)
      } else {
        if (!payload.password) delete payload.password
        delete payload.email  // email no se cambia
        await adminApi.usuarios.update(editing, payload)
      }
      close()
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo guardar')
    }
  }

  const del = async (id, email) => {
    if (!confirm(`¿Desactivar usuario ${email}?`)) return
    await adminApi.usuarios.remove(id)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">{items.length} usuario(s)</p>
        <button className="btn-primary" onClick={openNew}>+ Nuevo</button>
      </div>

      {loading ? (
        <p className="text-slate-500 text-sm">Cargando…</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-500 text-xs uppercase text-left">
              <tr>
                <th className="py-2">Email</th>
                <th className="py-2">Nombre</th>
                <th className="py-2">Rol</th>
                <th className="py-2">Trabajador linkeado</th>
                <th className="py-2">Activo</th>
                <th className="py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((u) => (
                <tr key={u.id}>
                  <td className="py-2 text-slate-900">{u.email}</td>
                  <td className="py-2 text-slate-600">{[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}</td>
                  <td className="py-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      u.role === 'admin' ? 'bg-red-50 text-red-700 border border-red-200'
                      : u.role === 'supervisor' ? 'bg-brand-50 text-brand-700 border border-brand-200'
                      : 'bg-slate-100 text-slate-700'
                    }`}>{u.role}</span>
                  </td>
                  <td className="py-2 text-slate-600 text-xs">{u.trabajador_nombre || '—'}</td>
                  <td className="py-2">{u.is_active ? '✓' : '—'}</td>
                  <td className="py-2 text-right">
                    <button className="text-brand-600 hover:text-brand-700 text-xs mr-3" onClick={() => openEdit(u)}>Editar</button>
                    <button className="text-red-600 hover:text-red-700 text-xs" onClick={() => del(u.id, u.email)}>Desactivar</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-slate-500">Sin usuarios</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {editing !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-xl shadow-elevated w-full max-w-md">
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">
                {editing === 'new' ? 'Nuevo usuario' : 'Editar usuario'}
              </h3>
              <button className="text-slate-400 text-2xl leading-none" onClick={close}>×</button>
            </div>
            <form onSubmit={submit} className="p-5 space-y-3">
              <div>
                <label className="label">Email *</label>
                <input type="email" className="input" value={form.email}
                       onChange={(e) => setForm({ ...form, email: e.target.value })}
                       required disabled={editing !== 'new'} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Nombre</label>
                  <input className="input" value={form.first_name}
                         onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
                </div>
                <div>
                  <label className="label">Apellido</label>
                  <input className="input" value={form.last_name}
                         onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Password {editing === 'new' ? '*' : '(dejar vacío para no cambiar)'}</label>
                <input type="password" className="input" value={form.password}
                       onChange={(e) => setForm({ ...form, password: e.target.value })}
                       placeholder={editing === 'new' ? 'Mínimo 6 caracteres' : '••••••••'} />
              </div>
              <div>
                <label className="label">Rol *</label>
                <select className="input" value={form.role}
                        onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="admin">admin</option>
                  <option value="supervisor">supervisor</option>
                  <option value="trabajador">trabajador</option>
                </select>
              </div>
              {form.role === 'trabajador' && (
                <div>
                  <label className="label">Linkear a trabajador (opcional)</label>
                  <select className="input" value={form.trabajador_id}
                          onChange={(e) => setForm({ ...form, trabajador_id: e.target.value })}>
                    <option value="">— Sin link —</option>
                    {trabajadores.map((t) => (
                      <option key={t.id} value={t.id}>{t.nbrcompleto}</option>
                    ))}
                  </select>
                </div>
              )}
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.is_active}
                       onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                Usuario activo
              </label>

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
