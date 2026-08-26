import { useEffect, useState } from 'react'

import ConfirmDialog from './admin/ConfirmDialog.jsx'
import DataTable from './admin/DataTable.jsx'
import { Icon } from './admin/Icons.jsx'
import Modal from './admin/Modal.jsx'
import PageHeader from './admin/PageHeader.jsx'
import StatusPill from './admin/StatusPill.jsx'

/**
 * Tabla master genérica.
 *
 * Config esperado:
 * - api: { list, create, update, remove }
 * - columns: [{ key, label, sortable?, align?, render? }]
 * - fields: [{ key, label, type: 'text'|'number'|'select'|'checkbox', required?, options?, optionsAsync? }]
 * - title, singular, countLabel
 * - searchKeys: keys sobre las que filtra el buscador
 * - deleteFlagField: nombre del boolean que se pone false al soft-delete
 * - defaults: valores iniciales del form
 */
export default function AdminMasterTable({
  api,
  columns,
  fields,
  title,
  singular,
  countLabel,
  searchKeys = [],
  deleteFlagField,
  defaults,
}) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(defaults)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [dynOptions, setDynOptions] = useState({})
  const [confirmingDelete, setConfirmingDelete] = useState(null)
  const [reorderError, setReorderError] = useState('')

  const load = () => {
    setLoading(true)
    api.list().then(setItems).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(load, [])

  useEffect(() => {
    fields.forEach((f) => {
      if (f.type === 'select' && f.optionsAsync) {
        f.optionsAsync().then((data) => {
          setDynOptions((prev) => ({ ...prev, [f.key]: data }))
        })
      }
    })
  }, []) // eslint-disable-line

  const optionsFor = (f) => (f.options ? f.options : dynOptions[f.key] || [])

  const openNew = () => { setEditing('new'); setForm(defaults); setError('') }
  const openEdit = (row) => {
    setEditing(row.id)
    const initial = {}
    fields.forEach((f) => {
      const v = row[f.key]
      initial[f.key] = v == null ? (f.type === 'checkbox' ? false : '') : v
    })
    setForm(initial)
    setError('')
  }
  const close = () => { setEditing(null); setError('') }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    for (const f of fields) {
      if (f.required && (form[f.key] == null || form[f.key] === '')) {
        setError(`${f.label} es obligatorio`)
        return
      }
    }
    const payload = { ...form }
    Object.keys(payload).forEach((k) => {
      if (payload[k] === '' && !fields.find((f) => f.key === k)?.required) {
        delete payload[k]
      }
    })
    try {
      setSaving(true)
      if (editing === 'new') await api.create(payload)
      else await api.update(editing, payload)
      close()
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  const labelOf = (row) =>
    row.nbrarea || row.nbrespecialidad || row.nbrcentrocosto ||
    row.nbrproyecto || row.nbrcategoria || row.nbrcompleto || row.email || `#${row.id}`

  const del = (row) => setConfirmingDelete(row)

  const doDelete = async () => {
    if (!confirmingDelete) return
    await api.remove(confirmingDelete.id)
    load()
  }

  // Reorder optimista: mostramos el orden nuevo al toque, luego persistimos.
  // Si el backend falla, recargamos para volver al orden real.
  const handleReorder = async (newItems) => {
    if (!api.reorder) return
    setReorderError('')
    const prev = items
    setItems(newItems)
    try {
      await api.reorder(newItems.map((r) => r.id))
    } catch (err) {
      setReorderError(err.response?.data?.detail || 'No se pudo guardar el orden')
      setItems(prev) // rollback
    }
  }

  // Enriquecer columnas: boolean → pill de estado
  const enrichedColumns = columns.map((c) => {
    if (c.render) return c
    if (deleteFlagField && c.key === deleteFlagField) {
      return {
        ...c,
        render: (row) => (
          row[c.key]
            ? <StatusPill tone="emerald">activa</StatusPill>
            : <StatusPill tone="slate">inactiva</StatusPill>
        ),
      }
    }
    return c
  })

  const rowActions = (row) => {
    const inactive = deleteFlagField && row[deleteFlagField] === false
    return (
      <>
        <button
          className="icon-btn"
          onClick={() => openEdit(row)}
          title="Editar"
          aria-label="Editar"
        >
          <Icon.Edit className="w-4 h-4" />
        </button>
        {!inactive && (
          <button
            className="icon-btn-danger"
            onClick={() => del(row)}
            title="Desactivar"
            aria-label="Desactivar"
          >
            <Icon.Archive className="w-4 h-4" />
          </button>
        )}
      </>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={title}
        count={items.length}
        countLabel={countLabel || title.toLowerCase()}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={`Buscar en ${title.toLowerCase()}…`}
        primaryLabel={`Nuevo ${singular}`}
        onPrimary={openNew}
      />

      {reorderError && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
          {reorderError}
        </div>
      )}

      <DataTable
        items={items}
        columns={enrichedColumns}
        loading={loading}
        search={search}
        searchKeys={searchKeys}
        rowActions={rowActions}
        rowInactive={(row) => deleteFlagField && row[deleteFlagField] === false}
        onReorder={api.reorder ? handleReorder : undefined}
        empty={{
          title: `Sin ${countLabel || title.toLowerCase()}`,
          message: search
            ? 'No hay resultados para tu búsqueda. Probá con otros términos.'
            : `Todavía no tenés ${countLabel || title.toLowerCase()} cargados. Creá el primero para empezar.`,
          actionLabel: search ? undefined : `Nuevo ${singular}`,
          onAction: search ? undefined : openNew,
        }}
      />

      <Modal
        open={editing !== null}
        onClose={close}
        title={editing === 'new' ? `Nuevo ${singular}` : `Editar ${singular}`}
      >
        <form onSubmit={submit} className="p-5 space-y-4">
          {fields.map((f) => {
            if (f.type === 'checkbox') {
              return (
                <label key={f.key} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={!!form[f.key]}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.checked })}
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500/30"
                  />
                  {f.label}
                </label>
              )
            }
            if (f.type === 'select') {
              return (
                <div key={f.key}>
                  <label className="label">{f.label} {f.required && <span className="text-red-500">*</span>}</label>
                  <select
                    className="input"
                    value={form[f.key] || ''}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    required={f.required}
                  >
                    <option value="">— Seleccionar —</option>
                    {optionsFor(f).map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              )
            }
            return (
              <div key={f.key}>
                <label className="label">{f.label} {f.required && <span className="text-red-500">*</span>}</label>
                <input
                  type={f.type || 'text'}
                  className="input"
                  value={form[f.key] ?? ''}
                  onChange={(e) => setForm({
                    ...form,
                    [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value,
                  })}
                  required={f.required}
                  placeholder={f.placeholder || ''}
                />
              </div>
            )
          })}

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
        title={`Desactivar ${singular}`}
        message={
          <>
            ¿Seguro que querés desactivar <strong className="text-slate-900">"{confirmingDelete && labelOf(confirmingDelete)}"</strong>?
            <br />
            <span className="text-slate-500">Podés reactivarlo desde la lista.</span>
          </>
        }
        confirmLabel="Desactivar"
      />
    </div>
  )
}
