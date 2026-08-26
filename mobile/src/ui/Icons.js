/**
 * Icon set premium — stroke outline 1.75, viewBox 24, linecap/linejoin round.
 * Familia visual consistente estilo Gmail / Linear / Notion.
 * Todos los paths son originales o adaptados de Lucide (MIT).
 *
 * Regla de oro: cada glifo cabe en un canvas 20×20 óptico dentro del viewBox
 * 24, con 2 px de padding en todos los lados. Peso visual balanceado —
 * ninguno "grita" ni desaparece cuando conviven en un tab bar.
 */
import Svg, { Path, Circle } from 'react-native-svg'

const PATHS = {
  // ── Tab bar principales ─────────────────────────────────────────────────
  home: [
    // Casa clásica con techo triangular y ventana/puerta indicada por líneas verticales
    'M3 11l9-8 9 8',
    'M5 9.5V19a2 2 0 0 0 2 2h3v-6h4v6h3a2 2 0 0 0 2-2V9.5',
  ],
  // Versión filled: casa sólida con puerta interior blanca (indica hueco).
  // Para uso en tab activo — más presencia visual (patrón iOS/Instagram).
  homeFilled: [
    'M12 3L2 12h3v8a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-8h3L12 3z',
  ],
  list: [
    // Checklist de 3 items con checks a la izquierda — comunica "actividades"
    'M4.5 6.5l1.5 1.5 3-3',
    'M4.5 12.5l1.5 1.5 3-3',
    'M4.5 18.5l1.5 1.5 3-3',
    'M13 7h8',
    'M13 13h8',
    'M13 19h8',
  ],
  listFilled: [
    // Fondos cuadrados sólidos de las 3 marcas + líneas de texto
    'M3 5h6v6H3z',
    'M3 14h6v6H3z',
    'M12 6h9',
    'M12 8h6',
    'M12 15h9',
    'M12 17h6',
  ],
  plus: [
    'M12 5v14',
    'M5 12h14',
  ],
  calendar: [
    // Calendario con dot activo dentro (indica "hoy tiene eventos")
    'M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
    'M4 10h16',
    'M8 3v4',
    'M16 3v4',
    'M8.5 15.5h.01',
    'M12.5 15.5h.01',
    'M16.5 15.5h.01',
  ],
  calendarFilled: [
    // Body sólido + top con dos "orejitas" de tick + banda blanca del header
    'M6 4h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
    'M4 10h16', 'M8 3v4', 'M16 3v4',
  ],
  layoutGrid: [
    // 2x2 grid — patrón "más opciones / app drawer" tipo iOS Home
    'M4 4h6v6H4z',
    'M14 4h6v6h-6z',
    'M14 14h6v6h-6z',
    'M4 14h6v6H4z',
  ],
  layoutGridFilled: [
    // Mismos 4 cuadros pero fill: color (sin trazos internos)
    'M4 4h6v6H4z',
    'M14 4h6v6h-6z',
    'M14 14h6v6h-6z',
    'M4 14h6v6H4z',
  ],

  // ── Auxiliares ──────────────────────────────────────────────────────────
  barChart: [
    // Bar chart creciente + baseline
    'M4 20h16',
    'M7 20V13',
    'M12 20V9',
    'M17 20V5',
  ],
  chevronRight: [
    'M9 6l6 6-6 6',
  ],
  chevronLeft: [
    'M15 6l-6 6 6 6',
  ],
  chevronUp: [
    'M6 15l6-6 6 6',
  ],
  chevronDown: [
    'M6 9l6 6 6-6',
  ],
  user: [
    'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2',
    'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  ],
  helpCircle: [
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
    'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3',
    'M12 17h.01',
  ],
  info: [
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
    'M12 16v-4',
    'M12 8h.01',
  ],
  logOut: [
    'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4',
    'M16 17l5-5-5-5',
    'M21 12H9',
  ],
  settings: [
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  ],
  clipboardCheck: [
    'M9 4h6a1 1 0 0 1 1 1v1h2a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h2V5a1 1 0 0 1 1-1z',
    'M9 4h6v3H9z',
    'M8.5 12l2 2 4-4',
    'M9 17h7',
  ],
  dotsHorizontal: [
    'M5 12h.01',
    'M12 12h.01',
    'M19 12h.01',
  ],
  search: [
    'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
    'M21 21l-4.35-4.35',
  ],
  x: [
    'M18 6L6 18',
    'M6 6l12 12',
  ],
  check: [
    'M20 6L9 17l-5-5',
  ],
  mail: [
    'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
    'M3 7l9 6 9-6',
  ],
  shield: [
    'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z',
  ],
}

/**
 * Uso:
 *   <Icon name="home" size={22} color="#1E40AF" strokeWidth={1.75} />
 * Para variante "filled" (dots del tab activo), pasar `filled`.
 */
export default function Icon({ name, size = 22, color = '#0F172A', strokeWidth = 1.75, filled = false }) {
  const paths = PATHS[name]
  if (!paths) return null
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {paths.map((d, i) => (
        <Path
          key={i}
          d={d}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={filled ? color : 'none'}
        />
      ))}
    </Svg>
  )
}
