/**
 * Aplica la marca (favicon + título de pestaña) al documento en runtime,
 * a partir del payload de `/api/config/public`.
 *
 * Se llama al bootstrap de la app y también cuando el admin guarda cambios
 * en Configuración → Marca (evento window "tareo:brand-updated").
 */

const DEFAULT_FAVICON = '/favicon.svg'
const DEFAULT_TITLE = 'Tareo — Azoramind'

/**
 * Reemplaza el <link rel="icon"> del <head> con el favicon custom (data URL
 * o URL absoluta). Si viene vacío, restaura el favicon por defecto del bundle.
 */
export function applyFavicon(faviconUrl) {
  const href = faviconUrl || DEFAULT_FAVICON
  // Removemos TODOS los <link rel="icon"> previos (puede haber más de uno por
  // reglas de precedencia del navegador) y agregamos uno solo con el nuevo href.
  const links = document.querySelectorAll('link[rel~="icon"]')
  links.forEach((l) => l.parentNode.removeChild(l))
  const link = document.createElement('link')
  link.rel = 'icon'
  // Si es data URL detectamos el mime del prefijo; si es URL absoluta lo omitimos
  // (el navegador lo infiere del Content-Type).
  if (href.startsWith('data:')) {
    const m = href.match(/^data:([^;,]+)/)
    if (m) link.type = m[1]
  }
  link.href = href
  document.head.appendChild(link)
}

/**
 * Actualiza <title> combinando el nombre comercial con "Tareo" — patrón que
 * respeta el producto ("Tareo") y agrega el cliente cuando existe.
 */
export function applyTitle(companyName) {
  document.title = companyName ? `Tareo · ${companyName}` : DEFAULT_TITLE
}

/**
 * Aplica todo el paquete de branding visible en el <head>.
 */
export function applyBrand(publicSettings) {
  if (!publicSettings) return
  applyFavicon(publicSettings.favicon_url)
  applyTitle(publicSettings.company_name)
}
