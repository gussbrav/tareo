import { useEffect, useState } from 'react'

import CecoImporterModal from './admin/CecoImporterModal.jsx'
import ConfirmDialog from './admin/ConfirmDialog.jsx'
import DataTable from './admin/DataTable.jsx'
import { Icon } from './admin/Icons.jsx'
import Modal from './admin/Modal.jsx'
import PageHeader from './admin/PageHeader.jsx'
import StatusPill from './admin/StatusPill.jsx'

/**
 * Tabla master genérica con scope opcional por proyecto.
 *
 * Config esperado:
 * - api: { list, create, update, remove, reorder? }
 * - columns: [{ key, label, sortable?, align?, render? }]
 * - fields: [{ key, label, type, required?, options?, optionsAsync? }]
 * - title, singular, countLabel
 * - searchKeys
 * - deleteFlagField
 * - defaults
 *
 * Props extra (scope por proyecto):
 * - scopeProyectoId: si viene, se pasa como { proyecto_id } al api.list()
 *   y se inyecta en el payload de create si `injectProyectoAs` está definido.
 * - proyectoActivo: objeto proyecto (para mostrar en el importador).
 * - injectProyectoAs: key donde inyectar el proyecto_id al crear (ej "proyecto_id").
 * - showCecoImporter: si true, muestra botón "Importar Excel" en el header
 *   (sólo tiene sentido para la tabla de Áreas).
 * - optionsAsyncArgs: extra args pasados a optionsAsync (ej [scopeProyectoId]).
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
  scopeProyectoId,
  proyectoActivo,
  injectProyectoAs,
  showCecoImporter = false,
  optionsAsyncArgs = [],
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
  const [importerOpen, setImporterOpen] = useState(false)

  const listParams = scopeProyectoId ? { proyecto_id: scopeProyectoId } : {}

  const load = () => {
    setLoading(true)
    api.list(listParams)
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  // Recarga cuando cambia el scope (usuario elige otro proyecto)
  useEffect(load, [scopeProyectoId]) // eslint-disable-line

  // Cargar options async para selects — se re-ejecuta cuando cambia scope
  useEffect(() => {
    fields.forEach((f) => {
      if (f.type === 'select' && f.optionsAsync) {
        f.optionsAsync(...optionsAsyncArgs).then((data) => {
          setDynOptions((prev) => ({ ...prev, [f.key]: data }))
        })
      }
    })
  }, [scopeProyectoId]) // eslint-disable-line

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
    // Inyecta proyecto_id al crear si aplica
    if (editing === 'new' && injectProyectoAs && scopeProyectoId) {
      payload[injectProyectoAs] = scopeProyectoId
    }
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

  const handleReorder = async (newItems) => {
    if (!api.reorder) return
    setReorderError('')
    const prev = items
    setItems(newItems)
    try {
      await api.reorder(newItems.map((r) => r.id))
    } catch (err) {
      setReorderError(err.response?.data?.detail || 'No se pudo guardar el orden')
      setItems(prev)
    }
  }

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
        <button className="icon-btn" onClick={() => openEdit(row)} title="Editar" aria-label="Editar">
          <Icon.Edit className="w-4 h-4" />
        </button>
        {!inactive && (
          <button className="icon-btn-danger" onClick={() => del(row)} title="Desactivar" aria-label="Desactivar">
            <Icon.Archive className="w-4 h-4" />
          </button>
        )}
      </>
    )
  }

  // Cuando la tabla necesita un proyecto y no hay ninguno seleccionado, mostramos un CTA
  const needsProyecto = injectProyectoAs && !scopeProyectoId

  return (
    <div className="space-y-4">
      <div className="toolbar">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-slate-900 leading-tight">{title}</h2>
          {typeof items.length === 'number' && !needsProyecto && (
            <p className="text-xs text-slate-500 mt-0.5">
              {items.length} {countLabel || title.toLowerCase()}
              {proyectoActivo && (
                <span className="text-slate-400"> · {proyectoActivo.descontratoproyecto || proyectoActivo.nbrproyecto}</span>
              )}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!needsProyecto && (
            <div className="relative">
              <Icon.Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="search"
                className="input input-sm pl-8 w-56"
                placeholder={`Buscar en ${title.toLowerCase()}…`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}
          {showCecoImporter && scopeProyectoId && (
            <button className="btn-secondary btn-sm" onClick={() => setImporterOpen(true)}>
              <Icon.Layers className="w-4 h-4" />
              Importar Excel
            </button>
          )}
          {!needsProyecto && (
            <button className="btn-primary btn-sm" onClick={openNew}>
              <Icon.Plus className="w-4 h-4" />
              Nuevo {singular}
            </button>
          )}
        </div>
      </div>

      {needsProyecto ? (
        <div className="card-flush text-center py-14 px-6">
          <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
            <Icon.Folder className="w-6 h-6" />
          </div>
          <h3 className="mt-4 text-sm font-medium text-slate-900">Elegí un proyecto</h3>
          <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
            {title} se maneja por proyecto. Seleccioná uno en el desplegable de arriba
            para ver y gestionar sus {countLabel || title.toLowerCase()}.
          </p>
        </div>
      ) : (
        <>
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
                : showCecoImporter
                  ? `Podés importar el Excel de CECOs para cargar todo de una, o crear ${countLabel || title.toLowerCase()} uno por uno.`
                  : `Todavía no tenés ${countLabel || title.toLowerCase()} cargados. Creá el primero para empezar.`,
              actionLabel: search ? undefined : `Nuevo ${singular}`,
              onAction: search ? undefined : openNew,
            }}
          />
        </>
      )}

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

      {showCecoImporter && (
        <CecoImporterModal
          open={importerOpen}
          onClose={() => setImporterOpen(false)}
          proyecto={proyectoActivo}
          onImported={() => { setImporterOpen(false); load() }}
        />
      )}
    </div>
  )
}
