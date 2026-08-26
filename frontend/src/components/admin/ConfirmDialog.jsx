import { useState } from 'react'

import { Icon } from './Icons.jsx'
import Modal from './Modal.jsx'

/**
 * ConfirmDialog — reemplaza el confirm() nativo del browser.
 *
 * Props:
 *   open         : bool
 *   onClose      : () => void
 *   onConfirm    : async () => void   (si tira, el diálogo queda abierto y muestra el error)
 *   title        : string             (ej: "Eliminar actividad")
 *   message      : ReactNode | string (detalle)
 *   confirmLabel : string  (default: "Confirmar")
 *   cancelLabel  : string  (default: "Cancelar")
 *   tone         : "danger" | "primary"  (default "danger")
 *   icon         : componente ícono (default Archive para danger)
 */
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'danger',
  icon: IconCmp,
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const IconChoice = IconCmp || (tone === 'danger' ? Icon.Archive : Icon.Check)
  const iconWrap =
    tone === 'danger'
      ? 'bg-red-50 text-red-600'
      : 'bg-brand-50 text-brand-600'
  const cta =
    tone === 'danger' ? 'btn-danger btn-sm' : 'btn-primary btn-sm'

  const handleConfirm = async () => {
    setErr('')
    setBusy(true)
    try {
      await onConfirm()
      onClose?.()
    } catch (e) {
      setErr(e?.response?.data?.detail || e?.message || 'No se pudo completar la acción')
    } finally {
      setBusy(false)
    }
  }

  const handleClose = () => {
    if (busy) return
    setErr('')
    onClose?.()
  }

  return (
    <Modal open={open} onClose={handleClose} title={title} maxWidth="max-w-md">
      <div className="p-5">
        <div className="flex items-start gap-3">
          <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${iconWrap}`}>
            <IconChoice className="w-5 h-5" />
          </span>
          <div className="text-sm text-slate-600 leading-relaxed pt-1">{message}</div>
        </div>

        {err && (
          <div className="mt-4 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
            {err}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2 pt-4 border-t border-slate-100">
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={handleClose}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={cta}
            onClick={handleConfirm}
            disabled={busy}
            autoFocus
          >
            {busy ? 'Procesando…' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
