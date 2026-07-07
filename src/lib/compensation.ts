import { computeAngles } from './angles'
import type { AntalgicAssessment, GaitMetrics, JointRom, RecordedFrame, RomResult, Side } from '../types'

const SYMMETRY_FLAG_PCT = 10
const HIP_ROM_MIN_DEG = 30
const KNEE_ROM_MIN_DEG = 45

/** Avalia padrão antálgico a partir das métricas de marcha. */
export function assessAntalgic(metrics: GaitMetrics): AntalgicAssessment {
  const op = metrics.operated.stanceMs
  const nonop = metrics.nonOperated.stanceMs
  const si = metrics.symmetryIndexPct
  if (op === null || nonop === null || si === null) {
    return {
      evaluable: false,
      flagged: false,
      message: 'Não avaliável — sem métricas de apoio suficientes.',
    }
  }
  const flagged = op < nonop && si >= SYMMETRY_FLAG_PCT
  const message = flagged
    ? `⚠️ Apoio do lado operado reduzido em ${Math.round(si)}% — sugestivo de padrão antálgico.`
    : 'Sem assimetria de apoio relevante.'
  return { evaluable: true, flagged, message }
}

/** Amplitude (máx−mín) de uma lista de valores; null se < 2 valores. */
function rangeOf(values: number[]): number | null {
  if (values.length < 2) return null
  return Math.max(...values) - Math.min(...values)
}

/**
 * Amplitude (ROM) da anca e do joelho por lado, a partir dos ângulos de cada frame.
 * Ignora frames onde o ângulo é null (baixa visibilidade).
 */
export function computeRom(frames: RecordedFrame[], minVisibility = 0.5): RomResult {
  const acc = {
    left: { hip: [] as number[], knee: [] as number[] },
    right: { hip: [] as number[], knee: [] as number[] },
  }
  for (const f of frames) {
    const a = computeAngles(f.landmarks, minVisibility)
    for (const side of ['left', 'right'] as Side[]) {
      const hip = a.hip[side]
      const knee = a.knee[side]
      if (hip !== null) acc[side].hip.push(hip)
      if (knee !== null) acc[side].knee.push(knee)
    }
  }
  const forSide = (side: Side): JointRom => {
    const hipDeg = rangeOf(acc[side].hip)
    const kneeDeg = rangeOf(acc[side].knee)
    return {
      hipDeg,
      kneeDeg,
      hipReduced: hipDeg !== null && hipDeg < HIP_ROM_MIN_DEG,
      kneeReduced: kneeDeg !== null && kneeDeg < KNEE_ROM_MIN_DEG,
    }
  }
  return { left: forSide('left'), right: forSide('right') }
}
