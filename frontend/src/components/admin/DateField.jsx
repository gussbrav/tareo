import { useEffect, useRef, useState } from 'react'

import { Icon } from './Icons.jsx'

/**
 * Date input con toggle "premium":
 *  - click en el ícono abre el picker
 *  - segundo click en el ícono lo cierra
 *  - también cierra al elegir fecha, ESC, o click fuera (blur natural)
 *  - el ícono nativo del navegador se oculta y usamos uno nuestro
 *
 * showPicker(): Chrome/Edge 99+, Firefox 101+, Safari 16.4+.
 * Sin soporte → click en el input abre el picker igual (fallback nativo).
 */
export default function DateField({
  value,
  onChange,
  className = '',
  required = false,
  min,
  max,
  disabled = false,
  id,
  ...rest
}) {
  const inputRef = useRef(null)
  const openRef = useRef(false) // fuente de verdad síncrona
  const [open, setOpenState] = useState(false)

  const setOpen = (v) => { openRef.current = v; setOpenState(v) }

  // Cerrar cuando el picker se dismissea (ESC, selección, click fuera)
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    const onBlur = () => setOpen(false)
    el.addEventListener('blur', onBlur)
    return () => el.removeEventListener('blur', onBlur)
  }, [])

  // mousedown + preventDefault: evita que el botón robe focus antes de la lógica
  const handleToggle = (e) => {
    e.preventDefault()
    if (disabled) return
    const el = inputRef.current
    if (!el) return
    if (openRef.current) {
      setOpen(false)
      el.blur()
    } else {
      setOpen(true)
      try {
        el.focus({ preventScroll: true })
        el.showPicker?.()
      } catch {
        // navegador viejo — el click nativo abrirá el picker igual
      }
    }
  }

  return (
    <div className={`date-field ${disabled ? 'is-disabled' : ''}`}>
      <input
        ref={inputRef}
        id={id}
        type="date"
        className={`input date-field-input pr-10 ${className}`}
        value={value || ''}
        onChange={onChange}
        required={required}
        min={min}
        max={max}
        disabled={disabled}
        {...rest}
      />
      <button
        type="button"
        className="date-field-btn"
        onMouseDown={handleToggle}
        disabled={disabled}
        aria-label={open ? 'Cerrar calendario' : 'Abrir calendario'}
        tabIndex={-1}
      >
        <Icon.Calendar className="w-4 h-4" />
      </button>
    </div>
  )
}
