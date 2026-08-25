export function today() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export function fmtHM(iso) {
  if (!iso) return '--:--'
  // acepta "HH:MM:SS" o "HH:MM"
  const s = String(iso)
  return s.length >= 5 ? s.slice(0, 5) : s
}

export function minutosToHoras(min) {
  if (min == null) return '—'
  const h = Math.floor(min / 60)
  const m = min % 60
  return h ? `${h}h ${m}m` : `${m}m`
}
