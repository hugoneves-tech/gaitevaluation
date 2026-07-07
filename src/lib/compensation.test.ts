import { describe, it, expect } from 'vitest'
import { assessAntalgic } from './compensation'
import type { GaitMetrics, SideMetrics } from '../types'

const sm = (stanceMs: number | null): SideMetrics => ({
  stanceMs,
  swingMs: null,
  stepMs: null,
  stanceSwingRatio: null,
})

const metrics = (op: number | null, nonop: number | null, si: number | null): GaitMetrics => ({
  cadenceStepsPerMin: null,
  cyclesDetected: 2,
  operated: sm(op),
  nonOperated: sm(nonop),
  symmetryIndexPct: si,
})

describe('assessAntalgic', () => {
  it('sinaliza quando o apoio operado é menor e a simetria >= 10%', () => {
    const a = assessAntalgic(metrics(600, 720, 18))
    expect(a.evaluable).toBe(true)
    expect(a.flagged).toBe(true)
    expect(a.message).toMatch(/antálgic/i)
  })

  it('não sinaliza quando a assimetria está abaixo do limiar', () => {
    const a = assessAntalgic(metrics(700, 720, 3))
    expect(a.flagged).toBe(false)
  })

  it('não é avaliável quando faltam métricas', () => {
    const a = assessAntalgic(metrics(null, 720, null))
    expect(a.evaluable).toBe(false)
    expect(a.flagged).toBe(false)
  })
})
