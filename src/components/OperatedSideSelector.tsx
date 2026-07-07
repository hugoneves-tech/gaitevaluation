import type { OperatedSide } from '../types'

const SIDES: { key: OperatedSide; label: string }[] = [
  { key: 'left', label: 'Esquerda' },
  { key: 'right', label: 'Direita' },
]

export function OperatedSideSelector({
  value,
  onChange,
}: {
  value: OperatedSide
  onChange: (side: OperatedSide) => void
}) {
  return (
    <div className="operated-selector" role="group" aria-label="Perna operada">
      <span>Perna operada:</span>
      {SIDES.map(({ key, label }) => (
        <button key={key} aria-pressed={value === key} onClick={() => onChange(key)}>
          {label}
        </button>
      ))}
    </div>
  )
}
