/**
 * CecoImporterModal — sube un Excel con la jerarquía CECO al proyecto activo.
 *
 * Flujo:
 *   1. Usuario elige archivo → preview automático (server valida sin escribir DB)
 *   2. Muestra sample de filas + conteos únicos + warnings
 *   3. Botón "Importar" ejecuta la importación real (transaccional)
 *   4. Muestra resumen final con contadores por nivel
 */
import { useRef, useState } from 'react'

import { adminApi } from '../../api/admin'
import { Icon } from './Icons.jsx'
import Modal from './Modal.jsx'

const MAX_MB = 5

export default function CecoImporterModal({ open, onClose, proyecto, onImported }) {
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [phase, setPhase] = useState('idle') // idle | preview | importing | done
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const reset = () => {
    setFile(null); setPreview(null); setResult(null); setError('')
    setPhase('idle')
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleClose = () => {
    if (phase === 'importing') return
    reset()
    onClose?.()
  }

  const handleFile = async (e) => {
    setError('')
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`El archivo pesa ${(f.size / 1024 / 1024).toFixed(1)} MB. Máximo ${MAX_MB} MB.`)
      return
    }
    if (!/\.(xlsx|xls)$/i.test(f.name)) {
      setError('Solo se aceptan archivos Excel (.xlsx, .xls)')
      return
    }
    setFile(f)
    setPhase('preview')
    setPreview(null)
    try {
      const p = await adminApi.cecoImporter.preview(proyecto.id, f)
      setPreview(p)
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo procesar el Excel')
      setPhase('idle')
    }
  }

  const handleImport = async () => {
    setError('')
    setPhase('importing')
    try {
      const r = await adminApi.cecoImporter.importar(proyecto.id, file)
      setResult(r)
      setPhase('done')
      onImported?.(r)
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo importar')
      setPhase('preview') // volver a preview para permitir reintentar
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Importar CECOs desde Excel"
      subtitle={proyecto ? `Al proyecto ${proyecto.descontratoproyecto || proyecto.nbrproyecto}` : undefined}
      maxWidth="max-w-2xl"
    >
      <div className="p-5 space-y-4">
        {phase === 'idle' && (
          <>
            <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center">
              <Icon.Layers className="w-8 h-8 mx-auto text-slate-400" />
              <p className="mt-2 text-sm font-medium text-slate-700">Subí el Excel de CECOs</p>
              <p className="text-xs text-slate-500 mt-1">
                Columnas esperadas: Cod01, Area, Cod02, Especialidad, Cod03, CentroCosto (obligatorias).
                TipoCosto, CodigoCeco, CecoPalma, Descripcion (opcionales).
              </p>
              <p className="text-xs text-slate-400 mt-2">Máximo {MAX_MB} MB · .xlsx / .xls</p>
              <button
                type="button"
                className="btn-primary btn-sm mt-4"
                onClick={() => inputRef.current?.click()}
              >
                <Icon.Plus className="w-4 h-4" />
                Elegir archivo
              </button>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={handleFile}
            />
          </>
        )}

        {phase === 'preview' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Icon.Check className="w-4 h-4 text-emerald-600" />
              <span className="font-medium text-slate-800">{file?.name}</span>
              <span className="text-slate-400">
                · {(file?.size / 1024).toFixed(1)} KB
                {preview?.sheet_name && ` · hoja "${preview.sheet_name}"`}
              </span>
            </div>

            {!preview ? (
              <div className="text-sm text-slate-500 py-4 text-center">Analizando…</div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <SummaryCard label="Áreas" value={preview.will_touch.areas_unicas} />
                  <SummaryCard label="Especialidades" value={preview.will_touch.especialidades_unicas} />
                  <SummaryCard label="Centros de costo" value={preview.will_touch.centros_costo_unicos} />
                </div>
                <p className="text-xs text-slate-500">
                  <strong>{preview.total_rows}</strong> filas válidas detectadas. Al importar se hará
                  upsert (crear los nuevos, actualizar los existentes por código).
                </p>

                {preview.sample?.length > 0 && (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-50 px-3 py-1.5">
                      Vista previa (primeras {preview.sample.length} filas)
                    </div>
                    <div className="overflow-x-auto max-h-56 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 text-slate-500 sticky top-0">
                          <tr>
                            <th className="text-left px-2 py-1">Área</th>
                            <th className="text-left px-2 py-1">Especialidad</th>
                            <th className="text-left px-2 py-1">CC</th>
                            <th className="text-left px-2 py-1">CECO</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {preview.sample.map((r, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="px-2 py-1 text-slate-700">
                                <span className="text-slate-400 mr-1 tabular-nums">{r.cod01}</span>
                                {r.area}
                              </td>
                              <td className="px-2 py-1 text-slate-700">
                                <span className="text-slate-400 mr-1 tabular-nums">{r.cod02}</span>
                                {r.esp}
                              </td>
                              <td className="px-2 py-1 text-slate-700">
                                <span className="text-slate-400 mr-1 tabular-nums">{r.cod03}</span>
                                {r.cc}
                              </td>
                              <td className="px-2 py-1 font-mono text-slate-500">{r.codigoceco || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {preview.warnings?.length > 0 && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 max-h-32 overflow-y-auto">
                    <p className="font-semibold mb-1">
                      {preview.warnings.length} advertencia{preview.warnings.length === 1 ? '' : 's'}:
                    </p>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {preview.warnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {phase === 'importing' && (
          <div className="text-center py-10">
            <div className="inline-flex w-10 h-10 rounded-full border-4 border-brand-200 border-t-brand-600 animate-spin" />
            <p className="mt-3 text-sm text-slate-600">Importando… no cierres la ventana.</p>
          </div>
        )}

        {phase === 'done' && result && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-emerald-700">
              <Icon.Check className="w-5 h-5" />
              <span className="text-sm font-semibold">Importación completada</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <ResultCard label="Áreas"          result={result.areas} />
              <ResultCard label="Especialidades" result={result.especialidades} />
              <ResultCard label="Centros costo"  result={result.centros_costo} />
            </div>
            <p className="text-xs text-slate-500">
              {result.processed_rows} filas procesadas en total.
              {result.warnings?.length > 0 && ` ${result.warnings.length} advertencias.`}
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          {phase === 'done' ? (
            <button className="btn-primary btn-sm" onClick={handleClose}>Cerrar</button>
          ) : (
            <>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={handleClose}
                disabled={phase === 'importing'}
              >
                Cancelar
              </button>
              {phase === 'preview' && preview && (
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  onClick={handleImport}
                >
                  <Icon.Check className="w-4 h-4" />
                  Confirmar importación
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 border border-slate-200 p-2 text-center">
      <div className="text-lg font-bold text-slate-900 tabular-nums">{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  )
}

function ResultCard({ label, result }) {
  return (
    <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-center">
      <div className="text-sm font-semibold text-emerald-900">
        <span className="tabular-nums">{result.inserted}</span>
        <span className="text-emerald-600 mx-0.5">+</span>
        <span className="tabular-nums text-emerald-700">{result.updated}</span>
      </div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 mt-0.5">{label}</div>
      <div className="text-[9px] text-emerald-600 mt-0.5">nuevos + actualizados</div>
    </div>
  )
}
