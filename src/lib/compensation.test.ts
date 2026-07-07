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

import { computeRom } from './compensation'
import type { Landmark, PoseFrame, RecordedFrame } from '../types'

const P = (x: number, y: number, visibility = 1): Landmark => ({ x, y, z: 0, visibility })

/** Frame com landmarks do lado esquerdo (ombro 11, anca 23, joelho 25, tornozelo 27). */
function leftLegFrame(
  timeMs: number,
  sh: [number, number],
  hip: [number, number],
  knee: [number, number],
  ank: [number, number],
  visibility = 1,
): RecordedFrame {
  const lm: PoseFrame = Array.from({ length: 33 }, () => P(0, 0, 0))
  lm[11] = P(sh[0], sh[1], visibility)
  lm[23] = P(hip[0], hip[1], visibility)
  lm[25] = P(knee[0], knee[1], visibility)
  lm[27] = P(ank[0], ank[1], visibility)
  return { timeMs, landmarks: lm }
}

describe('computeRom', () => {
  it('calcula a amplitude do joelho e sinaliza a anca sem amplitude', () => {
    const frames: RecordedFrame[] = [
      leftLegFrame(0, [0, -1], [0, 0], [0, 1], [0, 2]),
      leftLegFrame(100, [0, -1], [0, 0], [0, 1], [1, 1]),
    ]
    const rom = computeRom(frames)
    expect(rom.left.kneeDeg).toBeCloseTo(90, 0)
    expect(rom.left.kneeReduced).toBe(false)
    expect(rom.left.hipDeg).toBeCloseTo(0, 0)
    expect(rom.left.hipReduced).toBe(true)
  })

  it('devolve null quando os landmarks têm baixa visibilidade', () => {
    const frames: RecordedFrame[] = [
      leftLegFrame(0, [0, -1], [0, 0], [0, 1], [0, 2], 0.1),
      leftLegFrame(100, [0, -1], [0, 0], [0, 1], [1, 1], 0.1),
    ]
    const rom = computeRom(frames)
    expect(rom.left.kneeDeg).toBeNull()
    expect(rom.left.hipDeg).toBeNull()
  })
})

import { pelvicObliquitySeries } from './compensation'

/** Frame só com as ancas (23 esq, 24 dir) nas posições dadas. */
function hipsFrame(
  timeMs: number,
  hipL: [number, number],
  hipR: [number, number],
  visibility = 1,
): RecordedFrame {
  const lm: PoseFrame = Array.from({ length: 33 }, () => P(0, 0, 0))
  lm[23] = P(hipL[0], hipL[1], visibility)
  lm[24] = P(hipR[0], hipR[1], visibility)
  return { timeMs, landmarks: lm }
}

describe('pelvicObliquitySeries', () => {
  it('0° quando a pélvis está nivelada; pico na maior inclinação', () => {
    const frames: RecordedFrame[] = [
      hipsFrame(0, [0.4, 0.5], [0.6, 0.5]),
      hipsFrame(100, [0.4, 0.5], [0.6, 0.6]),
    ]
    const o = pelvicObliquitySeries(frames)
    expect(o.series[0].angleDeg).toBeCloseTo(0, 1)
    expect(o.series[1].angleDeg).toBeCloseTo(26.57, 1)
    expect(o.peakDeg).toBeCloseTo(26.57, 1)
    expect(o.peakTimeMs).toBe(100)
  })

  it('devolve null no frame com ancas pouco visíveis', () => {
    const frames: RecordedFrame[] = [hipsFrame(0, [0.4, 0.5], [0.6, 0.6], 0.1)]
    const o = pelvicObliquitySeries(frames)
    expect(o.series[0].angleDeg).toBeNull()
    expect(o.peakDeg).toBeNull()
    expect(o.peakTimeMs).toBeNull()
  })
})
