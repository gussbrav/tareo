const TONES = {
  emerald: { pill: 'pill-emerald', dot: 'bg-emerald-500' },
  slate:   { pill: 'pill-slate',   dot: 'bg-slate-400' },
  red:     { pill: 'pill-red',     dot: 'bg-red-500' },
  brand:   { pill: 'pill-brand',   dot: 'bg-brand-500' },
  amber:   { pill: 'pill-amber',   dot: 'bg-amber-500' },
}

export default function StatusPill({ tone = 'slate', children, dot = true }) {
  const t = TONES[tone] || TONES.slate
  return (
    <span className={t.pill}>
      {dot && <span className={`pill-dot ${t.dot}`} />}
      {children}
    </span>
  )
}
