import type { GaitEvent, GaitMetrics, OperatedSide, Side, SideMetrics } from '../types'

const mean = (xs: number[]): number | null =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null

/** Intervalos entre um evento de `fromType` num lado e o próximo `toType` alvo. */
function intervals(
  events: GaitEvent[],
  fromSide: Side,
  fromType: GaitEvent['type'],
  toSide: Side,
  toType: GaitEvent['type'],
): number[] {
  const out: number[] = []
  for (const e of events) {
    if (e.side !== fromSide || e.type !== fromType) continue
    const next = events.find(
      (n) => n.timeMs > e.timeMs && n.side === toSide && n.type === toType,
    )
    if (next) out.push(next.timeMs - e.timeMs)
  }
  return out
}

function sideMetrics(events: GaitEvent[], side: Side): SideMetrics {
  const other: Side = side === 'left' ? 'right' : 'left'
  const stance = mean(intervals(events, side, 'heelStrike', side, 'toeOff'))
  const swing = mean(intervals(events, side, 'toeOff', side, 'heelStrike'))
  const step = mean(intervals(events, side, 'heelStrike', other, 'heelStrike'))
  const ratio = stance !== null && swing !== null && swing !== 0 ? stance / swing : null
  return { stanceMs: stance, swingMs: swing, stepMs: step, stanceSwingRatio: ratio }
}

/**
 * Métricas de marcha a partir dos eventos. `operatedSide` rotula operado/não operado.
 */
export function computeMetrics(events: GaitEvent[], operatedSide: OperatedSide): GaitMetrics {
  const nonOperatedSide: Side = operatedSide === 'left' ? 'right' : 'left'
  const operated = sideMetrics(events, operatedSide)
  const nonOperated = sideMetrics(events, nonOperatedSide)

  const heelStrikes = events.filter((e) => e.type === 'heelStrike').sort((a, b) => a.timeMs - b.timeMs)
  let cadence: number | null = null
  if (heelStrikes.length >= 2) {
    const durMs = heelStrikes[heelStrikes.length - 1].timeMs - heelStrikes[0].timeMs
    if (durMs > 0) cadence = (heelStrikes.length - 1) / (durMs / 60000)
  }

  let symmetry: number | null = null
  if (operated.stanceMs !== null && nonOperated.stanceMs !== null) {
    const denom = (operated.stanceMs + nonOperated.stanceMs) / 2
    if (denom > 0) symmetry = (Math.abs(operated.stanceMs - nonOperated.stanceMs) / denom) * 100
  }

  const cyclesDetected = intervals(events, operatedSide, 'heelStrike', operatedSide, 'toeOff').length

  return {
    cadenceStepsPerMin: cadence,
    cyclesDetected,
    operated,
    nonOperated,
    symmetryIndexPct: symmetry,
  }
}
