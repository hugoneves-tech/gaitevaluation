import type {
  AntalgicAssessment, GaitEventMethod, GaitMetrics, OperatedSide,
  PelvicObliquity, RomResult, SideMetrics,
} from '../types'

/** Resumo anónimo (só números/flags/config) enviado ao LLM. Sem vídeo nem landmarks. */
export interface GaitSummary {
  operatedSide: OperatedSide
  detectionMethod: GaitEventMethod
  cadenceStepsPerMin: number | null
  cyclesDetected: number
  symmetryIndexPct: number | null
  operated: SideMetrics
  nonOperated: SideMetrics
  antalgic: { flagged: boolean; evaluable: boolean }
  rom: RomResult
  pelvicObliquityPeakDeg: number | null
}

export function buildSummary(
  metrics: GaitMetrics,
  antalgic: AntalgicAssessment,
  rom: RomResult,
  obliquity: PelvicObliquity,
  operatedSide: OperatedSide,
  detectionMethod: GaitEventMethod,
): GaitSummary {
  return {
    operatedSide,
    detectionMethod,
    cadenceStepsPerMin: metrics.cadenceStepsPerMin,
    cyclesDetected: metrics.cyclesDetected,
    symmetryIndexPct: metrics.symmetryIndexPct,
    operated: metrics.operated,
    nonOperated: metrics.nonOperated,
    antalgic: { flagged: antalgic.flagged, evaluable: antalgic.evaluable },
    rom,
    pelvicObliquityPeakDeg: obliquity.peakDeg,
  }
}

export function buildPrompt(summary: GaitSummary): string {
  return [
    'És um assistente didático para estudantes de mestrado em enfermagem de reabilitação.',
    'Com base nas seguintes métricas de marcha (medições 2D aproximadas obtidas de vídeo) de',
    'um doente pós-artroplastia da coxofemoral, escreve uma interpretação pedagógica em',
    'português de Portugal. Explica o que as métricas sugerem — padrão antálgico, redução de',
    'amplitude (ROM) e possível sinal de Trendelenburg — em linguagem clara e formativa.',
    'Termina SEMPRE com uma ressalva de que é uma leitura educativa sobre medições 2D',
    'aproximadas e não constitui um diagnóstico clínico.',
    '',
    'Métricas (JSON):',
    JSON.stringify(summary, null, 2),
  ].join('\n')
}
