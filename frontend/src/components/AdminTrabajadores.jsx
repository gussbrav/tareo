import { useEffect, useState } from 'react'

import { adminApi } from '../api/admin'
import ConfirmDialog from './admin/ConfirmDialog.jsx'
import DataTable from './admin/DataTable.jsx'
import { Icon } from './admin/Icons.jsx'
import Modal from './admin/Modal.jsx'
import PageHeader from './admin/PageHeader.jsx'
import StatusPill from './admin/StatusPill.jsx'

const EMPTY = {
  nbrcompleto: '',
  numidentificacion: '',
  categoria_id: '',
  desestadotrabajador: 'activo',
  flgativotrabajador: true,
}

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

function stateTone(state) {
  return state === 'activo' ? 'emerald' : state === 'vacaciones' ? 'amber' : 'slate'
}

export default function AdminTrabajadores() {
  const [items, setItems] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(null)

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
      setSaving(true)
      const payload = { ...form }
      if (!payload.categoria_id) delete payload.categoria_id
      if (editing === 'new') await adminApi.trabajadores.create(payload)
      else await adminApi.trabajadores.update(editing, payload)
      close()
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  const del = (t) => setConfirmingDelete(t)

  const doDelete = async () => {
    if (!confirmingDelete) return
    await adminApi.trabajadores.remove(confirmingDelete.id)
    load()
  }

  const columns = [
    {
      key: 'nbrcompleto',
      label: 'Trabajador',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3 min-w-0">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-brand-50 text-brand-700 text-xs font-semibold shrink-0">
            {initials(row.nbrcompleto)}
          </span>
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-900 truncate">{row.nbrcompleto}</div>
            <div className="text-xs text-slate-500 truncate">
              {row.categoria_nombre || row.descategoriatrabajador || 'Sin categoría'}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'numidentificacion',
      label: 'Documento',
      sortable: true,
      render: (row) => row.numidentificacion
        ? <span className="font-mono text-xs text-slate-600">{row.numidentificacion}</span>
        : <span className="text-slate-400">—</span>,
    },
    {
      key: 'desestadotrabajador',
      label: 'Estado',
      align: 'center',
      sortable: true,
      render: (row) => (
        <StatusPill tone={stateTone(row.desestadotrabajador)}>
          {row.desestadotrabajador || 'sin estado'}
        </StatusPill>
      ),
    },
    {
      key: 'flgativotrabajador',
      label: 'Activo',
      align: 'center',
      sortable: true,
    },
  ]

  const rowActions = (t) => (
    <>
      <button className="icon-btn" onClick={() => openEdit(t)} title="Editar" aria-label="Editar">
        <Icon.Edit className="w-4 h-4" />
      </button>
      {t.flgativotrabajador && (
        <button
          className="icon-btn-danger"
          onClick={() => del(t)}
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
        title="Trabajadores"
        count={items.length}
        countLabel="trabajadores"
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por nombre o documento…"
        primaryLabel="Nuevo trabajador"
        onPrimary={openNew}
      />

      <DataTable
        items={items}
        columns={columns}
        loading={loading}
        search={search}
        searchKeys={['nbrcompleto', 'numidentificacion', 'categoria_nombre', 'descategoriatrabajador']}
        rowActions={rowActions}
        rowInactive={(t) => !t.flgativotrabajador}
        empty={{
          title: 'Sin trabajadores',
          message: search
            ? 'No hay resultados para tu búsqueda.'
            : 'Cargá al primer trabajador para empezar a asignar actividades.',
          actionLabel: search ? undefined : 'Nuevo trabajador',
          onAction: search ? undefined : openNew,
        }}
      />

      <Modal
        open={editing !== null}
        onClose={close}
        title={editing === 'new' ? 'Nuevo trabajador' : 'Editar trabajador'}
      >
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="label">Nombre completo <span className="text-red-500">*</span></label>
            <input className="input" value={form.nbrcompleto}
                   onChange={(e) => setForm({ ...form, nbrcompleto: e.target.value })} required
                   placeholder="Nombres y apellidos" />
          </div>
          <div>
            <label className="label">Documento</label>
            <input className="input" value={form.numidentificacion}
                   onChange={(e) => setForm({ ...form, numidentificacion: e.target.value })}
                   placeholder="DNI, CE, etc." />
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
              Si falta la categoría, agregala en la sección <strong>Categorías</strong>.
            </p>
          </div>
          <div>
            <label className="label">Estado</label>
            <select className="input" value={form.desestadotrabajador}
                    onChange={(e) => setForm({ ...form, desestadotrabajador: e.target.value })}>
              <option value="activo">Activo</option>
              <option value="vacaciones">Vacaciones</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </div>

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
        title="Desactivar trabajador"
        message={
          <>
            ¿Seguro que querés desactivar a{' '}
            <strong className="text-slate-900">{confirmingDelete?.nbrcompleto}</strong>?
            <br />
            <span className="text-slate-500">
              Ya no aparecerá en el listado de trabajadores disponibles para nuevas actividades.
            </span>
          </>
        }
        confirmLabel="Desactivar"
      />
    </div>
  )
}
