import { describe, it, expect } from 'vitest'
import { buildSummary, buildPrompt } from './gaitSummary'
import type {
  AntalgicAssessment, GaitMetrics, PelvicObliquity, RomResult,
} from '../types'

const metrics: GaitMetrics = {
  cadenceStepsPerMin: 108,
  cyclesDetected: 3,
  operated: { stanceMs: 620, swingMs: 400, stepMs: 520, stanceSwingRatio: 1.55 },
  nonOperated: { stanceMs: 700, swingMs: 410, stepMs: 540, stanceSwingRatio: 1.71 },
  symmetryIndexPct: 12.1,
}
const antalgic: AntalgicAssessment = { evaluable: true, flagged: true, message: 'x' }
const rom: RomResult = {
  left: { hipDeg: 28, kneeDeg: 40, hipReduced: true, kneeReduced: true },
  right: { hipDeg: 34, kneeDeg: 58, hipReduced: false, kneeReduced: false },
}
const obliquity: PelvicObliquity = { series: [], peakDeg: 9.3, peakTimeMs: 800 }

describe('buildSummary', () => {
  it('inclui as métricas-chave e o lado/método, sem vídeo nem landmarks', () => {
    const s = buildSummary(metrics, antalgic, rom, obliquity, 'left', 'coordinate')
    expect(s.operatedSide).toBe('left')
    expect(s.detectionMethod).toBe('coordinate')
    expect(s.cadenceStepsPerMin).toBe(108)
    expect(s.symmetryIndexPct).toBeCloseTo(12.1, 1)
    expect(s.antalgic.flagged).toBe(true)
    expect(s.pelvicObliquityPeakDeg).toBeCloseTo(9.3, 1)
    const json = JSON.stringify(s)
    expect(json).not.toMatch(/landmark/i)
    expect(json).not.toMatch(/videoUrl/i)
  })
})

describe('buildPrompt', () => {
  it('produz um prompt em português com a ressalva e o JSON das métricas', () => {
    const s = buildSummary(metrics, antalgic, rom, obliquity, 'left', 'coordinate')
    const p = buildPrompt(s)
    expect(p).toMatch(/enfermagem de reabilitação/i)
    expect(p).toMatch(/não.*diagnóstico/i)
    expect(p).toContain('"cadenceStepsPerMin": 108')
  })
})
