import type { AngleValue, JointAngles } from '../types'

const deg = (v: AngleValue): string => (v === null ? '—' : `${Math.round(v)}°`)

export function MetricChips({
  angles,
  cadence,
}: {
  angles: JointAngles
  cadence: number | null
}) {
  return (
    <div className="metric-chips">
      <span className="chip">
        <span className="chip-label">Joelho E</span>
        <span className="chip-val side-left" data-testid="chip-knee-left">{deg(angles.knee.left)}</span>
      </span>
      <span className="chip">
        <span className="chip-label">Joelho D</span>
        <span className="chip-val side-right" data-testid="chip-knee-right">{deg(angles.knee.right)}</span>
      </span>
      <span className="chip">
        <span className="chip-label">Cadência</span>
        <span className="chip-val" data-testid="chip-cadence">{cadence === null ? '—' : Math.round(cadence)}</span>
      </span>
    </div>
  )
}
