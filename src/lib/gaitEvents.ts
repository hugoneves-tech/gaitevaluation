import type { RecordedFrame } from '../types'

const HIP = { left: 23, right: 24 } as const
const ANKLE = { left: 27, right: 28 } as const

/** Deslocação mínima (coords normalizadas) para considerar que houve marcha. */
const MIN_DISPLACEMENT = 0.1

const hipMidX = (f: RecordedFrame) =>
  (f.landmarks[HIP.left].x + f.landmarks[HIP.right].x) / 2

/**
 * Direção da passagem: +1 (esq→dir), -1 (dir→esq), 0 (sem deslocação suficiente).
 */
export function walkDirection(frames: RecordedFrame[]): 1 | -1 | 0 {
  if (frames.length < 2) return 0
  const disp = hipMidX(frames[frames.length - 1]) - hipMidX(frames[0])
  if (Math.abs(disp) < MIN_DISPLACEMENT) return 0
  return disp > 0 ? 1 : -1
}
