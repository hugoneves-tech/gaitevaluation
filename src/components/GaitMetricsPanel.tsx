import type { GaitMetrics, SideMetrics } from '../types'

const ms = (v: number | null): string => (v === null ? '—' : `${Math.round(v)} ms`)
const num = (v: number | null, d = 0): string => (v === null ? '—' : v.toFixed(d))
const ratio = (v: number | null): string => (v === null ? '—' : v.toFixed(2))

const rows: { key: keyof SideMetrics; label: string; fmt: (v: number | null) => string }[] = [
  { key: 'stanceMs', label: 'Apoio', fmt: ms },
  { key: 'swingMs', label: 'Balanço', fmt: ms },
  { key: 'stepMs', label: 'Passo', fmt: ms },
  { key: 'stanceSwingRatio', label: 'Rácio apoio/balanço', fmt: ratio },
]

export function GaitMetricsPanel({ metrics }: { metrics: GaitMetrics }) {
  if (metrics.cyclesDetected === 0) {
    return (
      <p className="metrics-warning" role="status">
        Não foram detetados passos suficientes — filme uma passagem a caminhar de lado,
        com vários passos.
      </p>
    )
  }
  return (
    <div className="gait-metrics">
      <div className="metrics-highlight">
        <span>Cadência: <strong>{num(metrics.cadenceStepsPerMin)}</strong> passos/min</span>
        <span>
          Índice de simetria: <strong>{num(metrics.symmetryIndexPct, 1)}%</strong>
        </span>
        <span className="metrics-cycles">{metrics.cyclesDetected} ciclo(s)</span>
      </div>
      <table className="angle-panel">
        <thead>
          <tr>
            <th>Métrica</th>
            <th>Operado</th>
            <th aria-label="Não operado">Não op.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, label, fmt }) => (
            <tr key={key}>
              <td>{label}</td>
              <td>{fmt(metrics.operated[key])}</td>
              <td>{fmt(metrics.nonOperated[key])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
