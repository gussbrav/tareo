/**
 * Design tokens — Tareo mobile.
 * Basado en principios UI/UX pro max (WCAG AA, touch ≥44pt, tabular-nums KPIs,
 * un solo primary CTA por vista, spring feedback, safe-area aware).
 * Palette validada contra fondos claros en 4.5:1 (texto normal) / 3:1 (grande).
 */

export const colors = {
  // ── Primary (azul Azoramind refinado — más vivo, mantiene identidad)
  // brand.600 antes era #1E40AF (blue-800), muy oscuro/apagado en
  // superficies mobile. Se sube a #2563EB (blue-600) para más
  // presencia visual sin perder la escalera azul. Contraste sobre
  // blanco: 5.9:1 (WCAG AA cumplido para textos ≥ 14 pt bold).
  brand: {
    50:  '#EFF6FF',
    100: '#DBEAFE',
    200: '#BFDBFE',
    500: '#3B82F6',  // azul claro vivo
    600: '#2563EB',  // primary — CTAs, tabs, FAB
    700: '#1D4ED8',  // texto sobre brand[50], hover
  },

  // ── Accent (amber vibrante — reemplaza el dorado muerto D4AF37)
  accent: {
    50:  '#FFFBEB',
    100: '#FEF3C7',
    500: '#F59E0B',
    600: '#D97706',
    700: '#B45309',
  },

  // ── Semantic ──
  success: { 50: '#F0FDF4', 100: '#D1FAE5', 500: '#10B981', 600: '#059669', 700: '#047857' },
  warning: { 50: '#FFFBEB', 100: '#FEF3C7', 500: '#F59E0B', 600: '#D97706', 700: '#B45309' },
  danger:  { 50: '#FEF2F2', 100: '#FEE2E2', 500: '#EF4444', 600: '#DC2626', 700: '#B91C1C' },
  info:    { 50: '#ECFEFF', 100: '#CFFAFE', 500: '#06B6D4', 600: '#0891B2', 700: '#0E7490' },

  // ── Superficies y texto (escala slate) ──
  bg:       '#F8FAFC',   // canvas
  surface:  '#FFFFFF',   // cards, sheets
  surfaceSubtle: '#F1F5F9',
  border:   '#E2E8F0',
  borderStrong: '#CBD5E1',

  text: {
    primary:   '#0F172A',  // 19:1 — títulos, números KPI
    secondary: '#334155',  // 10.4:1 — body (más contraste que antes)
    tertiary:  '#475569',  // 7.5:1 — captions con presencia
    muted:     '#94A3B8',  // 3.5:1 — solo texto grande o disabled
    softMuted: '#94A3B8',  // tabs inactivos, chevrons (más definido)
    inverse:   '#FFFFFF',
  },

  // ── Soft / pastel palette — para tags, badges por categoría, chips
  // color-coded en la Agenda. Cada par bg/fg validado ≥ 6:1 sobre blanco.
  soft: {
    sky:      { bg: '#E0F2FE', fg: '#075985' },  // 7.8:1
    mint:     { bg: '#DCFCE7', fg: '#166534' },  // 7.2:1
    peach:    { bg: '#FFEDD5', fg: '#9A3412' },  // 6.9:1
    lavender: { bg: '#EDE9FE', fg: '#5B21B6' },  // 8.1:1
    rose:     { bg: '#FFE4E6', fg: '#9F1239' },  // 7.4:1
    sun:      { bg: '#FEF3C7', fg: '#854D0E' },  // 6.1:1
  },

  // ── Legacy aliases (compat con código anterior) ──
  slate:  { 50: '#F8FAFC', 100: '#F1F5F9', 200: '#E2E8F0', 400: '#94A3B8', 500: '#64748B', 700: '#334155', 900: '#0F172A' },
  amber:  { 100: '#FEF3C7', 700: '#B45309' },
  emerald:{ 100: '#D1FAE5', 700: '#047857' },
  red:    { 100: '#FEE2E2', 500: '#EF4444', 700: '#B91C1C' },
  white:  '#FFFFFF',
  black:  '#000000',
}

// ── Tipografía (system font — SF Pro / Roboto) ──
// weight semanticos: 400 body, 500 label, 600 emphasis, 700 headings/KPI
export const type = {
  display:    { fontSize: 32, lineHeight: 40, fontWeight: '700', letterSpacing: -0.5 },
  h1:         { fontSize: 24, lineHeight: 32, fontWeight: '700', letterSpacing: -0.3 },
  h2:         { fontSize: 18, lineHeight: 26, fontWeight: '600', letterSpacing: -0.2 },
  h3:         { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  kpiNumber:  { fontSize: 30, lineHeight: 36, fontWeight: '700', fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
  kpiDelta:   { fontSize: 12, lineHeight: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  body:       { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  label:      { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  caption:    { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  overline:   { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
}

// ── Espaciado (4px base grid) ──
export const spacing = {
  xs: 4, sm: 8, md: 12, base: 16, lg: 20, xl: 24, '2xl': 32, '3xl': 40, '4xl': 48,
}

// ── Radios ──
export const radius = {
  sm: 8, md: 12, lg: 16, xl: 20, pill: 999,
}

// ── Sombras premium — tint azul sutil en vez de gris neutro
// (patrón Linear/Notion: sombras con la luz de la marca, no muertas)
export const shadow = {
  card: {
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  floating: {
    shadowColor: '#1E40AF',      // tint azul brand para el FAB
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 10,
  },
  tabBar: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 8,
  },
}

// ── Motion tokens (para Animated y presses) ──
export const motion = {
  press: { activeOpacity: 0.75 },
  duration: { fast: 150, base: 200, slow: 300 },
}

// ── Pastel deterministic picker — mismo string → mismo color siempre.
// Hash FNV-1a. Se usa en AgendaScreen para color-tag por actividad.
const PASTEL_KEYS = ['sky', 'mint', 'peach', 'lavender', 'rose', 'sun']

export function pastelFor(text = '') {
  const s = String(text).trim().toLowerCase()
  if (!s) return colors.soft.sky
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0
  }
  return colors.soft[PASTEL_KEYS[h % PASTEL_KEYS.length]]
}
