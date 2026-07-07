import { describe, it, expect } from 'vitest'
import { computeMetrics } from './gaitMetrics'
import type { GaitEvent } from '../types'

const events: GaitEvent[] = [
  { timeMs: 0, side: 'left', type: 'heelStrike' },
  { timeMs: 500, side: 'right', type: 'heelStrike' },
  { timeMs: 600, side: 'left', type: 'toeOff' },
  { timeMs: 1000, side: 'left', type: 'heelStrike' },
  { timeMs: 1100, side: 'right', type: 'toeOff' },
  { timeMs: 1500, side: 'right', type: 'heelStrike' },
  { timeMs: 1600, side: 'left', type: 'toeOff' },
  { timeMs: 2000, side: 'left', type: 'heelStrike' },
  { timeMs: 2100, side: 'right', type: 'toeOff' },
]

describe('computeMetrics', () => {
  it('calcula apoio, balanço e passo do lado operado', () => {
    const m = computeMetrics(events, 'left')
    expect(m.operated.stanceMs).toBeCloseTo(600, 1)
    expect(m.operated.swingMs).toBeCloseTo(400, 1)
    expect(m.operated.stepMs).toBeCloseTo(500, 1)
    expect(m.operated.stanceSwingRatio).toBeCloseTo(1.5, 2)
  })

  it('índice de simetria é 0 quando os apoios são iguais', () => {
    const m = computeMetrics(events, 'left')
    expect(m.symmetryIndexPct).toBeCloseTo(0, 1)
  })

  it('cadência = passos por minuto a partir dos heel strikes', () => {
    const m = computeMetrics(events, 'left')
    // 5 HS entre t=0 e t=2000 => 4 passos => 4 / (2000/60000) = 120 passos/min
    expect(m.cadenceStepsPerMin).toBeCloseTo(120, 0)
  })

  it('devolve nulos e aviso quando há poucos eventos', () => {
    const m = computeMetrics([{ timeMs: 0, side: 'left', type: 'heelStrike' }], 'left')
    expect(m.cyclesDetected).toBe(0)
    expect(m.operated.stanceMs).toBeNull()
    expect(m.cadenceStepsPerMin).toBeNull()
  })
})
