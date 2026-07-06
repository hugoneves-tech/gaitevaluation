import type { JointAngles, AngleValue } from '../types'

const fmt = (v: AngleValue): string => (v === null ? '—' : `${Math.round(v)}°`)

const joints: { key: keyof JointAngles; label: string }[] = [
  { key: 'hip', label: 'Anca' },
  { key: 'knee', label: 'Joelho' },
  { key: 'ankle', label: 'Tornozelo' },
]

export function AnglePanel({ angles }: { angles: JointAngles }) {
  return (
    <table className="angle-panel">
      <thead>
        <tr>
          <th>Articulação</th>
          <th>Esq.</th>
          <th>Dir.</th>
        </tr>
      </thead>
      <tbody>
        {joints.map(({ key, label }) => (
          <tr key={key}>
            <td>{label}</td>
            <td data-testid={`${key}-left`}>{fmt(angles[key].left)}</td>
            <td data-testid={`${key}-right`}>{fmt(angles[key].right)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
