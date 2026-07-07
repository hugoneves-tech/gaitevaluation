import type { PelvicObliquity } from '../types'

const deg = (v: number | null): string => (v === null ? '—' : `${Math.round(v)}°`)

function nearestAngle(o: PelvicObliquity, timeMs: number): number | null {
  if (!o.series.length) return null
  let best = o.series[0]
  let bestDelta = Infinity
  for (const s of o.series) {
    const d = Math.abs(s.timeMs - timeMs)
    if (d < bestDelta) {
      bestDelta = d
      best = s
    }
  }
  return best.angleDeg
}

export function TrendelenburgPanel({
  obliquity,
  currentTimeMs,
  onSeek,
}: {
  obliquity: PelvicObliquity
  currentTimeMs: number
  onSeek: (timeMs: number) => void
}) {
  const current = nearestAngle(obliquity, currentTimeMs)
  return (
    <div className="trendelenburg">
      <h3>Trendelenburg (obliquidade pélvica)</h3>
      <p className="pedagogical-notice" role="note">
        Para o Trendelenburg, filme de frente (vista coronal) o doente a caminhar na sua direção.
      </p>
      <p>
        Obliquidade no frame: <strong data-testid="obliquity-current">{deg(current)}</strong>
      </p>
      <p>
        Pico no clip: <strong data-testid="obliquity-peak">{deg(obliquity.peakDeg)}</strong>{' '}
        {obliquity.peakTimeMs !== null && (
          <button onClick={() => onSeek(obliquity.peakTimeMs as number)}>ir para o pico</button>
        )}
      </p>
    </div>
  )
}
