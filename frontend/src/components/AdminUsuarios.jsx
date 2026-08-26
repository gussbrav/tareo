/**
 * AdminUsuarios — Gestión de usuarios por invitación (mirror CRM Azoramind).
 *
 * Cambio de modelo (v0.5+): admin ya NO crea usuarios con password directo.
 * Ahora INVITA por email — el usuario elige su propia contraseña al aceptar.
 * Edición sigue disponible para nombre/rol/estado; password es self-service.
 *
 * Estructura:
 *   1. Tabla de usuarios activos (existentes).
 *   2. Tabla de invitaciones pendientes al fondo (badge "Login bloqueado").
 *   3. Botón principal "+ Invitar a un usuario".
 */
import { useEffect, useState } from 'react'

import { adminApi } from '../api/admin'
import { invitacionesApi } from '../api/invitaciones'
import AsignarProyectosModal from './admin/AsignarProyectosModal.jsx'
import ConfirmDialog from './admin/ConfirmDialog.jsx'
import DataTable from './admin/DataTable.jsx'
import { Icon } from './admin/Icons.jsx'
import Modal from './admin/Modal.jsx'
import PageHeader from './admin/PageHeader.jsx'
import StatusPill from './admin/StatusPill.jsx'

const EMPTY_EDIT = {
  first_name: '',
  last_name: '',
  role: 'trabajador',
  trabajador_id: '',
  is_active: true,
}

const EMPTY_INVITE = {
  email: '',
  first_name: '',
  last_name: '',
  role: 'trabajador',
  trabajador_id: '',
  proyecto_ids: [],
}

const ROLE_TONE = { admin: 'red', supervisor: 'brand', trabajador: 'slate' }

function fmtDateTime(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('es-PE', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

export default function AdminUsuarios() {
  const [items, setItems] = useState([])
  const [invitations, setInvitations] = useState([])
  const [trabajadores, setTrabajadores] = useState([])
  const [proyectos, setProyectos] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [search, setSearch] = useState('')

  // Edición usuario existente (sin password)
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState(EMPTY_EDIT)
  const [savingEdit, setSavingEdit] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(null)
  const [assigningProyectos, setAssigningProyectos] = useState(null)

  // Invitar nuevo (modal)
  const [inviting, setInviting] = useState(false)
  const [inviteForm, setInviteForm] = useState(EMPTY_INVITE)
  const [savingInvite, setSavingInvite] = useState(false)

  const [confirmingCancel, setConfirmingCancel] = useState(null)

  const load = () => {
    setLoading(true)
    Promise.all([
      adminApi.usuarios.list(),
      adminApi.trabajadores.list(),
      adminApi.proyectos.list(),
      invitacionesApi.list(true),
    ])
      .then(([us, ts, ps, invs]) => {
        setItems(us)
        setTrabajadores(ts.filter((t) => t.flgativotrabajador))
        setProyectos(ps.filter((p) => p.flgactivoproyecto))
        setInvitations(invs)
      })
      .catch(() => setError('No se pudo cargar la información'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  // ─── Edit usuario existente ─────────────────────────────────────────
  const openEdit = (u) => {
    setEditing(u.id)
    setEditForm({
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      role: u.role,
      trabajador_id: u.trabajador_id || '',
      is_active: u.is_active,
    })
    setError('')
  }
  const closeEdit = () => { setEditing(null); setError('') }

  const submitEdit = async (e) => {
    e.preventDefault()
    setError('')
    setSavingEdit(true)
    try {
      const payload = { ...editForm }
      if (!payload.trabajador_id) delete payload.trabajador_id
      await adminApi.usuarios.update(editing, payload)
      closeEdit()
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo guardar')
    } finally {
      setSavingEdit(false)
    }
  }

  const del = (u) => setConfirmingDelete(u)
  const doDelete = async () => {
    if (!confirmingDelete) return
    await adminApi.usuarios.remove(confirmingDelete.id)
    load()
  }

  // ─── Invitar ──────────────────────────────────────────────────────────
  const openInvite = () => {
    setInviteForm(EMPTY_INVITE)
    setInviting(true)
    setError('')
  }
  const closeInvite = () => { setInviting(false); setError('') }

  const toggleInviteProyecto = (id) => {
    setInviteForm((f) => {
      const set = new Set(f.proyecto_ids)
      set.has(id) ? set.delete(id) : set.add(id)
      return { ...f, proyecto_ids: Array.from(set) }
    })
  }

  const submitInvite = async (e) => {
    e.preventDefault()
    setError('')
    setSavingInvite(true)
    try {
      const payload = {
        email: inviteForm.email.trim().toLowerCase(),
        role: inviteForm.role,
        first_name: inviteForm.first_name || null,
        last_name: inviteForm.last_name || null,
        trabajador_id: inviteForm.trabajador_id || null,
        proyecto_ids: inviteForm.role === 'admin' ? [] : inviteForm.proyecto_ids,
      }
      await invitacionesApi.create(payload)
      setMsg(`Invitación enviada a ${payload.email}`)
      setTimeout(() => setMsg(''), 3500)
      closeInvite()
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo enviar la invitación')
    } finally {
      setSavingInvite(false)
    }
  }

  // ─── Reenviar / Cancelar invitación ───────────────────────────────────
  const doResend = async (inv) => {
    setError(''); setMsg('')
    try {
      await invitacionesApi.resend(inv.id)
      setMsg(`Invitación reenviada a ${inv.email}`)
      setTimeout(() => setMsg(''), 3500)
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo reenviar')
    }
  }

  const doCancel = async () => {
    if (!confirmingCancel) return
    try {
      await invitacionesApi.cancel(confirmingCancel.id)
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo cancelar')
    }
  }

  // ─── Columnas usuarios ────────────────────────────────────────────────
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
      key: 'proyectos_count',
      label: 'Proyectos',
      align: 'center',
      sortable: true,
      render: (u) => {
        if (u.role === 'admin') {
          return (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border border-red-200 bg-red-50 text-red-700"
              title="Los administradores acceden a todos los proyectos por su rol"
            >
              <Icon.Shield className="w-3 h-3" />
              Todos
            </span>
          )
        }
        const n = u.proyectos_count || 0
        const tone = n === 0
          ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-400'
          : 'border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100 hover:border-brand-400'
        return (
          <button
            type="button"
            onClick={() => setAssigningProyectos(u)}
            title={n === 0
              ? 'Click para asignar proyectos — hasta que asignes al menos uno, el usuario no verá ninguno'
              : `Click para ver o editar los ${n === 1 ? 'proyecto asignado' : 'proyectos asignados'}`}
            className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium tabular-nums border transition-colors ${tone}`}
          >
            <Icon.Folder className="w-3 h-3" />
            <span className="group-hover:underline">
              {n === 0 ? 'Asignar proyectos' : `${n} ${n === 1 ? 'proyecto' : 'proyectos'}`}
            </span>
            <Icon.Edit className="w-3 h-3 opacity-60 group-hover:opacity-100" />
          </button>
        )
      },
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
        primaryLabel="Invitar a un usuario"
        onPrimary={openInvite}
      />

      {error && <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>}
      {msg && <div className="rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-3 py-2">{msg}</div>}

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
            : 'Aún no hay usuarios activos. Envía la primera invitación para empezar.',
          actionLabel: search ? undefined : 'Invitar a un usuario',
          onAction: search ? undefined : openInvite,
        }}
      />

      {/* ── Invitaciones pendientes ────────────────────────────────────── */}
      {invitations.length > 0 && (
        <div className="card">
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Invitaciones pendientes</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Usuarios invitados que aún no aceptaron el email. El link expira a los 7 días.
              </p>
            </div>
            <span className="text-xs text-slate-400 tabular-nums">
              {invitations.length} {invitations.length === 1 ? 'pendiente' : 'pendientes'}
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 py-3">
                <div className="w-8 h-8 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                  <Icon.Info className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-900 truncate">{inv.email}</span>
                    <StatusPill tone="amber">Login bloqueado</StatusPill>
                    <StatusPill tone={ROLE_TONE[inv.role] || 'slate'}>{inv.role}</StatusPill>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Invitado — expira {fmtDateTime(inv.expires_at)}
                  </div>
                </div>
                <button
                  className="btn-secondary btn-sm"
                  onClick={() => doResend(inv)}
                  title="Renovar el link y reenviar el email"
                >
                  <Icon.Refresh className="w-4 h-4" />
                  Reenviar
                </button>
                <button
                  className="icon-btn-danger"
                  onClick={() => setConfirmingCancel(inv)}
                  title="Cancelar invitación"
                  aria-label="Cancelar invitación"
                >
                  <Icon.X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Modal Invitar ─────────────────────────────────────────────── */}
      <Modal
        open={inviting}
        onClose={closeInvite}
        title="Invitar a un usuario"
        subtitle="El usuario recibirá un email con un link para activar su cuenta y elegir su contraseña."
        maxWidth="max-w-lg"
      >
        <form onSubmit={submitInvite} className="p-5 space-y-4">
          <div>
            <label className="label">Email <span className="text-red-500">*</span></label>
            <input
              type="email"
              className="input"
              value={inviteForm.email}
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
              required
              autoFocus
              placeholder="nombre@empresa.com"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Nombre (opcional)</label>
              <input
                className="input"
                value={inviteForm.first_name}
                onChange={(e) => setInviteForm({ ...inviteForm, first_name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Apellido (opcional)</label>
              <input
                className="input"
                value={inviteForm.last_name}
                onChange={(e) => setInviteForm({ ...inviteForm, last_name: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label">Rol <span className="text-red-500">*</span></label>
            <select
              className="input"
              value={inviteForm.role}
              onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value, proyecto_ids: [] })}
            >
              <option value="admin">Admin — acceso total al sistema</option>
              <option value="supervisor">Supervisor — crea y ve tareo de sus proyectos</option>
              <option value="trabajador">Trabajador — solo ve y finaliza sus actividades</option>
            </select>
          </div>

          {inviteForm.role === 'trabajador' && (
            <div>
              <label className="label">Linkear a trabajador (opcional)</label>
              <select
                className="input"
                value={inviteForm.trabajador_id}
                onChange={(e) => setInviteForm({ ...inviteForm, trabajador_id: e.target.value })}
              >
                <option value="">— Sin link —</option>
                {trabajadores.map((t) => (
                  <option key={t.id} value={t.id}>{t.nbrcompleto}</option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">
                Vincula la cuenta con un trabajador para que vea sus propias actividades.
              </p>
            </div>
          )}

          {inviteForm.role !== 'admin' && (
            <div>
              <label className="label">Proyectos con acceso</label>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                {proyectos.length === 0 ? (
                  <p className="py-4 text-center text-sm text-slate-500">No hay proyectos activos.</p>
                ) : proyectos.map((p) => {
                  const checked = inviteForm.proyecto_ids.includes(p.id)
                  return (
                    <label key={p.id} className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-sm ${checked ? 'bg-brand-50/60' : 'hover:bg-slate-50'}`}>
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500/30"
                        checked={checked}
                        onChange={() => toggleInviteProyecto(p.id)}
                      />
                      <span className="text-slate-800">
                        {p.descontratoproyecto || p.nbrproyecto || `Código ${p.codproyecto}`}
                      </span>
                    </label>
                  )
                })}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {inviteForm.proyecto_ids.length === 0
                  ? '⚠ Sin proyectos, el usuario no verá ningún proyecto al entrar.'
                  : `${inviteForm.proyecto_ids.length} ${inviteForm.proyecto_ids.length === 1 ? 'proyecto seleccionado' : 'proyectos seleccionados'}`}
              </p>
            </div>
          )}

          {error && <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" className="btn-secondary btn-sm" onClick={closeInvite} disabled={savingInvite}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary btn-sm" disabled={savingInvite || !inviteForm.email}>
              {savingInvite ? 'Enviando…' : 'Enviar invitación'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Modal Editar (sin password) ───────────────────────────────── */}
      <Modal
        open={editing !== null}
        onClose={closeEdit}
        title="Editar usuario"
        subtitle="La contraseña la gestiona el propio usuario desde Mi cuenta → Seguridad."
        maxWidth="max-w-lg"
      >
        <form onSubmit={submitEdit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Nombre</label>
              <input className="input" value={editForm.first_name}
                     onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} />
            </div>
            <div>
              <label className="label">Apellido</label>
              <input className="input" value={editForm.last_name}
                     onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Rol <span className="text-red-500">*</span></label>
            <select className="input" value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
              <option value="admin">Admin — acceso total</option>
              <option value="supervisor">Supervisor — crea y ve todo</option>
              <option value="trabajador">Trabajador — solo sus actividades</option>
            </select>
          </div>
          {editForm.role === 'trabajador' && (
            <div>
              <label className="label">Linkear a trabajador</label>
              <select className="input" value={editForm.trabajador_id}
                      onChange={(e) => setEditForm({ ...editForm, trabajador_id: e.target.value })}>
                <option value="">— Sin link —</option>
                {trabajadores.map((t) => (
                  <option key={t.id} value={t.id}>{t.nbrcompleto}</option>
                ))}
              </select>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={editForm.is_active}
                   onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                   className="rounded border-slate-300 text-brand-600 focus:ring-brand-500/30" />
            Usuario activo
          </label>

          {error && <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" className="btn-secondary btn-sm" onClick={closeEdit} disabled={savingEdit}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary btn-sm" disabled={savingEdit}>
              {savingEdit ? 'Guardando…' : 'Guardar'}
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

      <ConfirmDialog
        open={!!confirmingCancel}
        onClose={() => setConfirmingCancel(null)}
        onConfirm={doCancel}
        title="Cancelar invitación"
        message={
          <>
            ¿Cancelar la invitación pendiente para{' '}
            <strong className="text-slate-900">{confirmingCancel?.email}</strong>?
            <br />
            <span className="text-slate-500">
              El link que le mandamos dejará de funcionar. Si querés que acceda igual, tendrás que invitarlo de nuevo.
            </span>
          </>
        }
        confirmLabel="Cancelar invitación"
      />

      <AsignarProyectosModal
        open={!!assigningProyectos}
        onClose={() => setAssigningProyectos(null)}
        scopingApi={adminApi.usuarios.scoping}
        entityId={assigningProyectos?.id}
        entityLabel={assigningProyectos?.email}
        disabled={assigningProyectos?.role === 'admin'}
        disabledHelp="Los admins tienen acceso a todos los proyectos por su rol — no requieren asignación."
        onSaved={load}
      />
    </div>
  )
}
