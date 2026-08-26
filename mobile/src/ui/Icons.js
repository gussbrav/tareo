/**
 * Icon set premium — stroke outline 1.75, viewBox 24, linecap/linejoin round.
 * Familia visual consistente estilo Gmail/Linear/Notion.
 * Todos los paths son originales o basados en Lucide (MIT).
 */
import Svg, { Path } from 'react-native-svg'

const PATHS = {
  home: [
    'M3 10.5 12 3l9 7.5',
    'M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5',
  ],
  clipboardCheck: [
    'M9 4h6a1 1 0 0 1 1 1v1h2a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h2V5a1 1 0 0 1 1-1z',
    'M9 4h6v3H9z',
    'M8.5 12l2 2 4-4',
    'M9 17h7',
  ],
  plus: [
    'M12 5v14',
    'M5 12h14',
  ],
  barChart: [
    'M4 20h16',
    'M7 20V14',
    'M12 20V10',
    'M17 20V6',
  ],
  dotsHorizontal: [
    'M5 12h.01',
    'M12 12h.01',
    'M19 12h.01',
  ],
  calendar: [
    'M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
    'M4 10h16',
    'M8 3v4',
    'M16 3v4',
  ],
  chevronRight: [
    'M9 6l6 6-6 6',
  ],
  chevronLeft: [
    'M15 6l-6 6 6 6',
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
}

/**
 * Uso: <Icon name="home" size={22} color="#1E40AF" strokeWidth={1.75} />
 */
export default function Icon({ name, size = 22, color = '#0F172A', strokeWidth = 1.75 }) {
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
          fill="none"
        />
      ))}
    </Svg>
  )
}
