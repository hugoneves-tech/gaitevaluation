import type { GaitEventMethod } from '../types'

const METHODS: { key: GaitEventMethod; label: string }[] = [
  { key: 'coordinate', label: 'Coordenadas' },
  { key: 'verticalVelocity', label: 'Velocidade' },
  { key: 'ankleDistance', label: 'Distância' },
]

export function DetectionProfileBar({
  value,
  onChange,
}: {
  value: GaitEventMethod
  onChange: (method: GaitEventMethod) => void
}) {
  return (
    <div className="profile-bar" role="group" aria-label="Método de deteção">
      {METHODS.map(({ key, label }) => (
        <button
          key={key}
          aria-pressed={value === key}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
