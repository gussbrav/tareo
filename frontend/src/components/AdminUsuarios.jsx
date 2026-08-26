import { useEffect, useState } from 'react'

import { adminApi } from '../api/admin'
import ConfirmDialog from './admin/ConfirmDialog.jsx'
import DataTable from './admin/DataTable.jsx'
import { Icon } from './admin/Icons.jsx'
import Modal from './admin/Modal.jsx'
import PageHeader from './admin/PageHeader.jsx'
import StatusPill from './admin/StatusPill.jsx'

const EMPTY = {
  email: '',
  password: '',
  first_name: '',
  last_name: '',
  role: 'trabajador',
  trabajador_id: '',
  is_active: true,
}

const ROLE_TONE = { admin: 'red', supervisor: 'brand', trabajador: 'slate' }

export default function AdminUsuarios() {
  const [items, setItems] = useState([])
  const [trabajadores, setTrabajadores] = useState([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(null)

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
      setSaving(true)
      const payload = { ...form }
      if (!payload.trabajador_id) delete payload.trabajador_id
      if (editing === 'new') {
        if (!payload.password || payload.password.length < 6) {
          setError('Password mínimo 6 caracteres')
          setSaving(false)
          return
        }
        await adminApi.usuarios.create(payload)
      } else {
        if (!payload.password) delete payload.password
        delete payload.email
        await adminApi.usuarios.update(editing, payload)
      }
      close()
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  const del = (u) => setConfirmingDelete(u)

  const doDelete = async () => {
    if (!confirmingDelete) return
    await adminApi.usuarios.remove(confirmingDelete.id)
    load()
  }

  const columns = [
    {
      key: 'email',
      label: 'Email',
      sortable: true,
      render: (u) => (
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-900 truncate">{u.email}</div>
          <div className="text-xs text-slate-500 truncate">
            {[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Rol',
      sortable: true,
      render: (u) => <StatusPill tone={ROLE_TONE[u.role] || 'slate'}>{u.role}</StatusPill>,
    },
    {
      key: 'trabajador_nombre',
      label: 'Trabajador linkeado',
      sortable: true,
      render: (u) => u.trabajador_nombre
        ? <span className="text-slate-600 text-sm">{u.trabajador_nombre}</span>
        : <span className="text-slate-400">—</span>,
    },
    {
      key: 'is_active',
      label: 'Activo',
      align: 'center',
      sortable: true,
    },
  ]

  const rowActions = (u) => (
    <>
      <button className="icon-btn" onClick={() => openEdit(u)} title="Editar" aria-label="Editar">
        <Icon.Edit className="w-4 h-4" />
      </button>
      {u.is_active && (
        <button
          className="icon-btn-danger"
          onClick={() => del(u)}
          title="Desactivar"
          aria-label="Desactivar"
        >
          <Icon.Archive className="w-4 h-4" />
        </button>
      )}
    </>
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title="Usuarios"
        count={items.length}
        countLabel="usuarios"
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por email o nombre…"
        primaryLabel="Nuevo usuario"
        onPrimary={openNew}
      />

      <DataTable
        items={items}
        columns={columns}
        loading={loading}
        search={search}
        searchKeys={['email', 'first_name', 'last_name', 'role', 'trabajador_nombre']}
        rowActions={rowActions}
        rowInactive={(u) => !u.is_active}
        empty={{
          title: 'Sin usuarios',
          message: search
            ? 'No hay resultados para tu búsqueda.'
            : 'Crea el primer usuario para que puedan iniciar sesión.',
          actionLabel: search ? undefined : 'Nuevo usuario',
          onAction: search ? undefined : openNew,
        }}
      />

      <Modal
        open={editing !== null}
        onClose={close}
        title={editing === 'new' ? 'Nuevo usuario' : 'Editar usuario'}
        maxWidth="max-w-lg"
      >
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="label">Email <span className="text-red-500">*</span></label>
            <input type="email" className="input" value={form.email}
                   onChange={(e) => setForm({ ...form, email: e.target.value })}
                   required disabled={editing !== 'new'}
                   placeholder="nombre@empresa.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
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
            <label className="label">
              Password {editing === 'new'
                ? <span className="text-red-500">*</span>
                : <span className="text-slate-400 font-normal">(dejar vacío para no cambiar)</span>}
            </label>
            <input type="password" className="input" value={form.password}
                   onChange={(e) => setForm({ ...form, password: e.target.value })}
                   placeholder={editing === 'new' ? 'Mínimo 6 caracteres' : '••••••••'}
                   autoComplete="new-password" />
          </div>
          <div>
            <label className="label">Rol <span className="text-red-500">*</span></label>
            <select className="input" value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="admin">Admin — acceso total</option>
              <option value="supervisor">Supervisor — crea y ve todo</option>
              <option value="trabajador">Trabajador — solo sus actividades</option>
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
                   onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                   className="rounded border-slate-300 text-brand-600 focus:ring-brand-500/30" />
            Usuario activo
          </label>

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" className="btn-secondary btn-sm" onClick={close} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary btn-sm" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmingDelete}
        onClose={() => setConfirmingDelete(null)}
        onConfirm={doDelete}
        title="Desactivar usuario"
        message={
          <>
            ¿Seguro que quieres desactivar el usuario{' '}
            <strong className="text-slate-900">{confirmingDelete?.email}</strong>?
            <br />
            <span className="text-slate-500">No podrá iniciar sesión hasta que lo reactives.</span>
          </>
        }
        confirmLabel="Desactivar"
      />
    </div>
  )
}
