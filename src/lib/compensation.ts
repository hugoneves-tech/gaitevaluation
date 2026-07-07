import type { AntalgicAssessment, GaitMetrics } from '../types'

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
