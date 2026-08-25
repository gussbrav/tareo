import { useEffect, useState } from 'react'

/**
 * Tabla master genérica. Config:
 * - api: { list, create, update, remove }
 * - columns: [{ key, label, format?, sortable? }]
 * - fields: [{ key, label, type: 'text'|'number'|'select'|'checkbox', required?, options?, optionsAsync? }]
 * - title, singular
 * - deleteFlagField: nombre del boolean que se pone false al soft-delete (para color de badge)
 * - defaults: valores iniciales del form
 */
export default function AdminMasterTable({
  api,
  columns,
  fields,
  title,
  singular,
  deleteFlagField,
  defaults,
}) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(defaults)
  const [error, setError] = useState('')
  const [dynOptions, setDynOptions] = useState({})

  const load = () => {
    setLoading(true)
    api.list().then(setItems).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(load, [])

  useEffect(() => {
    // resolver options async (dropdowns que vienen de otro endpoint)
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
    // Validaciones simples
    for (const f of fields) {
      if (f.required && (form[f.key] == null || form[f.key] === '')) {
        setError(`${f.label} es obligatorio`)
        return
      }
    }
    // Limpiar strings vacíos en campos opcionales
    const payload = { ...form }
    Object.keys(payload).forEach((k) => {
      if (payload[k] === '' && !fields.find((f) => f.key === k)?.required) {
        delete payload[k]
      }
    })
    try {
      if (editing === 'new') await api.create(payload)
      else await api.update(editing, payload)
      close()
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo guardar')
    }
  }

  const del = async (row) => {
    const label = row.nbrarea || row.nbrespecialidad || row.nbrcentrocosto ||
                  row.nbrproyecto || row.nbrcategoria || row.nbrcompleto || row.email || row.id
    if (!confirm(`¿Desactivar "${label}"?`)) return
    await api.remove(row.id)
    load()
  }

  const renderCell = (row, col) => {
    const v = row[col.key]
    if (col.format) return col.format(v, row)
    if (v == null) return '—'
    if (typeof v === 'boolean') return v ? '✓' : '—'
    return String(v)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">{items.length} {title.toLowerCase()}</p>
        <button className="btn-primary" onClick={openNew}>+ Nuevo {singular}</button>
      </div>

      {loading ? (
        <p className="text-slate-500 text-sm">Cargando…</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-500 text-xs uppercase text-left">
              <tr>
                {columns.map((c) => <th key={c.key} className="py-2 pr-3">{c.label}</th>)}
                <th className="py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((row) => {
                const inactive = deleteFlagField && row[deleteFlagField] === false
                return (
                  <tr key={row.id} className={inactive ? 'opacity-60' : ''}>
                    {columns.map((c) => (
                      <td key={c.key} className="py-2 pr-3 text-slate-800">{renderCell(row, c)}</td>
                    ))}
                    <td className="py-2 text-right">
                      <button className="text-brand-600 hover:text-brand-700 text-xs mr-3" onClick={() => openEdit(row)}>Editar</button>
                      {!inactive && (
                        <button className="text-red-600 hover:text-red-700 text-xs" onClick={() => del(row)}>Desactivar</button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {items.length === 0 && (
                <tr><td colSpan={columns.length + 1} className="py-6 text-center text-slate-500">Sin registros</td></tr>
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
                {editing === 'new' ? `Nuevo ${singular.toLowerCase()}` : `Editar ${singular.toLowerCase()}`}
              </h3>
              <button className="text-slate-400 text-2xl leading-none" onClick={close}>×</button>
            </div>
            <form onSubmit={submit} className="p-5 space-y-3">
              {fields.map((f) => {
                if (f.type === 'checkbox') {
                  return (
                    <label key={f.key} className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={!!form[f.key]}
                             onChange={(e) => setForm({ ...form, [f.key]: e.target.checked })} />
                      {f.label}
                    </label>
                  )
                }
                if (f.type === 'select') {
                  return (
                    <div key={f.key}>
                      <label className="label">{f.label} {f.required && '*'}</label>
                      <select className="input" value={form[f.key] || ''}
                              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                              required={f.required}>
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
                    <label className="label">{f.label} {f.required && '*'}</label>
                    <input
                      type={f.type || 'text'}
                      className="input"
                      value={form[f.key] ?? ''}
                      onChange={(e) => setForm({ ...form, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value })}
                      required={f.required}
                      placeholder={f.placeholder || ''}
                    />
                  </div>
                )
              })}

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
