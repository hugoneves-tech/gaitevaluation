import { describe, it, expect } from 'vitest'
import { walkDirection } from './gaitEvents'
import type { Landmark, PoseFrame, RecordedFrame } from '../types'

const P = (x: number, y: number, visibility = 1): Landmark => ({ x, y, z: 0, visibility })

/** Constrói um frame com anca e tornozelo (E/D) nas posições dadas. */
function frameAt(
  timeMs: number,
  o: { hipL?: [number, number]; hipR?: [number, number]; ankL?: [number, number]; ankR?: [number, number] },
): RecordedFrame {
  const lm: PoseFrame = Array.from({ length: 33 }, () => P(0, 0))
  if (o.hipL) lm[23] = P(o.hipL[0], o.hipL[1])
  if (o.hipR) lm[24] = P(o.hipR[0], o.hipR[1])
  if (o.ankL) lm[27] = P(o.ankL[0], o.ankL[1])
  if (o.ankR) lm[28] = P(o.ankR[0], o.ankR[1])
  return { timeMs, landmarks: lm }
}

describe('walkDirection', () => {
  it('deteta marcha para a direita (+1)', () => {
    const frames = [
      frameAt(0, { hipL: [0.1, 0.5], hipR: [0.1, 0.5] }),
      frameAt(500, { hipL: [0.6, 0.5], hipR: [0.6, 0.5] }),
    ]
    expect(walkDirection(frames)).toBe(1)
  })

  it('deteta marcha para a esquerda (-1)', () => {
    const frames = [
      frameAt(0, { hipL: [0.6, 0.5], hipR: [0.6, 0.5] }),
      frameAt(500, { hipL: [0.1, 0.5], hipR: [0.1, 0.5] }),
    ]
    expect(walkDirection(frames)).toBe(-1)
  })

  it('devolve 0 quando quase não há deslocação', () => {
    const frames = [
      frameAt(0, { hipL: [0.5, 0.5], hipR: [0.5, 0.5] }),
      frameAt(500, { hipL: [0.52, 0.5], hipR: [0.52, 0.5] }),
    ]
    expect(walkDirection(frames)).toBe(0)
  })
})

import { detectEvents } from './gaitEvents'

describe('detectEvents — coordinate', () => {
  it('deteta heel strikes nos máximos do tornozelo relativo à anca', () => {
    const offsets = [0, 0.1, 0.2, 0.1, 0, 0.1, 0.2, 0.1, 0]
    const frames: RecordedFrame[] = offsets.map((off, i) => {
      const hipX = 0.1 + (0.4 * i) / (offsets.length - 1)
      return frameAt(i * 100, {
        hipL: [hipX, 0.5],
        hipR: [hipX, 0.5],
        ankL: [hipX + off, 0.9],
        ankR: [hipX, 0.9],
      })
    })
    const events = detectEvents(frames, 'coordinate')
    const leftHS = events.filter((e) => e.side === 'left' && e.type === 'heelStrike')
    expect(leftHS.map((e) => e.timeMs)).toEqual([200, 600])
  })

  it('devolve [] quando não há deslocação (direção 0)', () => {
    const frames: RecordedFrame[] = [0, 100, 200].map((t) =>
      frameAt(t, { hipL: [0.5, 0.5], hipR: [0.5, 0.5], ankL: [0.5, 0.9], ankR: [0.5, 0.9] }),
    )
    expect(detectEvents(frames, 'coordinate')).toEqual([])
  })
})

describe('detectEvents — verticalVelocity', () => {
  it('deteta heel strikes nos máximos da altura do tornozelo (pé mais baixo)', () => {
    const ys = [0.7, 0.8, 0.9, 0.8, 0.7, 0.8, 0.9, 0.8, 0.7]
    const frames: RecordedFrame[] = ys.map((y, i) => {
      const hipX = 0.1 + (0.4 * i) / (ys.length - 1)
      return frameAt(i * 100, {
        hipL: [hipX, 0.5],
        hipR: [hipX, 0.5],
        ankL: [hipX, y],
        ankR: [hipX, 0.7],
      })
    })
    const events = detectEvents(frames, 'verticalVelocity')
    const leftHS = events.filter((e) => e.side === 'left' && e.type === 'heelStrike')
    expect(leftHS.map((e) => e.timeMs)).toEqual([200, 600])
  })
})
