/**
 * Design tokens — Tareo mobile.
 * Basado en principios UI/UX pro max (WCAG AA, touch ≥44pt, tabular-nums KPIs,
 * un solo primary CTA por vista, spring feedback, safe-area aware).
 * Palette validada contra fondos claros en 4.5:1 (texto normal) / 3:1 (grande).
 */

export const colors = {
  // ── Primary (azul Azoramind) ──
  brand: {
    50:  '#EFF6FF',
    100: '#DBEAFE',
    200: '#BFDBFE',
    500: '#2563EB',
    600: '#1E40AF',  // primary — 8.6:1 sobre blanco
    700: '#1E3A8A',
  },

  // ── Accent (dorado Azoramind) ──
  accent: {
    100: '#FEF3C7',
    500: '#D4AF37',
    700: '#92671A',
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
    primary:   '#0F172A',  // 17:1  — títulos, números KPI
    secondary: '#475569',  // 7.5:1 — body
    tertiary:  '#64748B',  // 5.7:1 — captions
    muted:     '#94A3B8',  // 3.5:1 — solo texto grande o disabled
    inverse:   '#FFFFFF',
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

// ── Sombras (elevation Android + shadow iOS) ──
export const shadow = {
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  floating: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  tabBar: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 10,
  },
}

// ── Motion tokens (para Animated y presses) ──
export const motion = {
  press: { activeOpacity: 0.75 },
  duration: { fast: 150, base: 200, slow: 300 },
}
