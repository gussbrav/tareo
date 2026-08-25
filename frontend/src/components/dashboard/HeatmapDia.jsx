/**
 * HeatmapDia — Distribución de actividades por día de semana y hora del día.
 * SVG puro — sin dependencia de recharts.
 */
import { useMemo, useState } from 'react'

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
// Horas laborales típicas: 6 am – 6 pm (13 slots)
const HORAS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]

function interpolarColor(valor, max) {
  if (!valor || !max) return '#EFF4FF'
  const ratio = Math.min(valor / max, 1)
  // de brand-100 (#DBE7FE) a brand-700 (#1E3A8A)
  const r = Math.round(219 + (30 - 219) * ratio)
  const g = Math.round(231 + (58 - 231) * ratio)
  const b = Math.round(254 + (138 - 254) * ratio)
  return `rgb(${r},${g},${b})`
}

/**
 * @param {object} props
 * @param {Array}   props.data    - [{dia_semana, hora, actividades, horas}]
 * @param {boolean} [props.loading]
 */
export default function HeatmapDia({ data = [], loading = false }) {
  const { grid, maxActividades } = useMemo(() => {
    // Construye mapa [dia][hora] -> {actividades, horas}
    const mapa = {}
    for (const d of data) {
      if (!mapa[d.dia_semana]) mapa[d.dia_semana] = {}
      mapa[d.dia_semana][d.hora] = d
    }
    let max = 1
    for (const d of data) if (d.actividades > max) max = d.actividades
    return { grid: mapa, maxActividades: max }
  }, [data])

  const [tooltip, setTooltip] = useState(null)

  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-56 mb-4" />
        <div className="h-36 bg-slate-100 rounded" />
      </div>
    )
  }

  if (!data.length) {
    return (
      <div className="card flex flex-col items-center justify-center h-44 gap-3">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect width="48" height="48" rx="10" fill="#EFF4FF" />
          <rect x="10" y="14" width="8" height="8" rx="2" fill="#93B4FD" />
          <rect x="20" y="14" width="8" height="8" rx="2" fill="#3B65F5" />
          <rect x="30" y="14" width="8" height="8" rx="2" fill="#1E40AF" />
          <rect x="10" y="26" width="8" height="8" rx="2" fill="#BFD3FE" />
          <rect x="20" y="26" width="8" height="8" rx="2" fill="#6089FA" />
          <rect x="30" y="26" width="8" height="8" rx="2" fill="#3B65F5" />
        </svg>
        <p className="text-slate-400 text-sm">Sin datos suficientes para el mapa de calor</p>
      </div>
    )
  }

  const CELL_W = 28
  const CELL_H = 22
  const GAP = 2
  const LABEL_W = 32
  const LABEL_H = 20

  const svgW = LABEL_W + HORAS.length * (CELL_W + GAP)
  const svgH = LABEL_H + DIAS.length * (CELL_H + GAP)

  return (
    <div className="card">
      <div className="mb-4">
        <h3 className="font-semibold text-slate-900">Mapa de actividad</h3>
        <p className="text-xs text-slate-400 mt-0.5">Actividades por día y hora</p>
      </div>

      <div className="overflow-x-auto">
        <svg
          width={svgW}
          height={svgH}
          className="block"
          onMouseLeave={() => setTooltip(null)}
        >
          {/* Etiquetas de hora */}
          {HORAS.map((h, hi) => (
            <text
              key={h}
              x={LABEL_W + hi * (CELL_W + GAP) + CELL_W / 2}
              y={LABEL_H - 4}
              textAnchor="middle"
              fontSize={9}
              fill="#94a3b8"
            >
              {`${h}h`}
            </text>
          ))}

          {/* Etiquetas de día */}
          {DIAS.map((dia, di) => (
            <text
              key={dia}
              x={LABEL_W - 4}
              y={LABEL_H + di * (CELL_H + GAP) + CELL_H / 2 + 4}
              textAnchor="end"
              fontSize={9}
              fill="#94a3b8"
            >
              {dia}
            </text>
          ))}

          {/* Celdas */}
          {DIAS.map((_, di) =>
            HORAS.map((hora, hi) => {
              const cell = grid[di]?.[hora]
              const color = interpolarColor(cell?.actividades, maxActividades)
              const x = LABEL_W + hi * (CELL_W + GAP)
              const y = LABEL_H + di * (CELL_H + GAP)
              return (
                <g key={`${di}-${hi}`}>
                  <rect
                    x={x}
                    y={y}
                    width={CELL_W}
                    height={CELL_H}
                    rx={3}
                    fill={color}
                    className="cursor-default"
                    onMouseEnter={() =>
                      setTooltip({
                        x: x + CELL_W / 2,
                        y: y,
                        dia: DIAS[di],
                        hora,
                        cell,
                      })
                    }
                  />
                  {cell?.actividades > 0 && (
                    <text
                      x={x + CELL_W / 2}
                      y={y + CELL_H / 2 + 4}
                      textAnchor="middle"
                      fontSize={8}
                      fill={cell.actividades / maxActividades > 0.5 ? '#fff' : '#1e3a8a'}
                      className="pointer-events-none"
                    >
                      {cell.actividades}
                    </text>
                  )}
                </g>
              )
            }),
          )}

          {/* Tooltip SVG inline */}
          {tooltip && (
            <g>
              <rect
                x={Math.min(tooltip.x - 45, svgW - 100)}
                y={Math.max(tooltip.y - 52, 0)}
                width={90}
                height={46}
                rx={5}
                fill="white"
                stroke="#e2e8f0"
                strokeWidth={1}
                filter="drop-shadow(0 2px 6px rgba(0,0,0,.1))"
              />
              <text
                x={Math.min(tooltip.x, svgW - 55)}
                y={Math.max(tooltip.y - 36, 14)}
                textAnchor="middle"
                fontSize={9}
                fontWeight="600"
                fill="#1e293b"
              >
                {tooltip.dia} {tooltip.hora}:00
              </text>
              <text
                x={Math.min(tooltip.x, svgW - 55)}
                y={Math.max(tooltip.y - 22, 28)}
                textAnchor="middle"
                fontSize={9}
                fill="#64748b"
              >
                {tooltip.cell ? `${tooltip.cell.actividades} act · ${Number(tooltip.cell.horas).toFixed(1)}h` : 'Sin actividad'}
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Leyenda de intensidad */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs text-slate-400">Menos</span>
        {[0, 0.25, 0.5, 0.75, 1].map((r) => (
          <span
            key={r}
            className="inline-block w-5 h-3 rounded-sm"
            style={{ backgroundColor: interpolarColor(r * maxActividades, maxActividades) }}
          />
        ))}
        <span className="text-xs text-slate-400">Más</span>
      </div>
    </div>
  )
}

