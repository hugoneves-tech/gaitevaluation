import type { Landmark, PoseFrame, JointAngles, AngleValue } from '../types'

// Índices de landmarks do MediaPipe Pose.
const LM = {
  shoulder: { left: 11, right: 12 },
  hip: { left: 23, right: 24 },
  knee: { left: 25, right: 26 },
  ankle: { left: 27, right: 28 },
  foot: { left: 31, right: 32 },
} as const

/** Ângulo (graus) no vértice `b`, entre os segmentos b->a e b->c. */
export function angleBetween(a: Landmark, b: Landmark, c: Landmark): number {
  const v1x = a.x - b.x, v1y = a.y - b.y
  const v2x = c.x - b.x, v2y = c.y - b.y
  const dot = v1x * v2x + v1y * v2y
  const mag1 = Math.hypot(v1x, v1y)
  const mag2 = Math.hypot(v2x, v2y)
  if (mag1 === 0 || mag2 === 0) return NaN
  const cos = Math.min(1, Math.max(-1, dot / (mag1 * mag2)))
  return (Math.acos(cos) * 180) / Math.PI
}

/** Devolve o ângulo se todos os pontos forem visíveis o suficiente; senão null. */
function safeAngle(a: Landmark, b: Landmark, c: Landmark, minVis: number): AngleValue {
  if (a.visibility < minVis || b.visibility < minVis || c.visibility < minVis) return null
  const angle = angleBetween(a, b, c)
  return Number.isNaN(angle) ? null : angle
}

/**
 * Calcula os ângulos de anca, joelho e tornozelo (esq. e dir.) de um frame.
 * @param minVisibility limiar mínimo de visibilidade (0..1) para aceitar um ponto.
 */
export function computeAngles(frame: PoseFrame, minVisibility: number): JointAngles {
  const side = (s: 'left' | 'right') => ({
    hip: safeAngle(frame[LM.shoulder[s]], frame[LM.hip[s]], frame[LM.knee[s]], minVisibility),
    knee: safeAngle(frame[LM.hip[s]], frame[LM.knee[s]], frame[LM.ankle[s]], minVisibility),
    ankle: safeAngle(frame[LM.knee[s]], frame[LM.ankle[s]], frame[LM.foot[s]], minVisibility),
  })
  const l = side('left'), r = side('right')
  return {
    hip: { left: l.hip, right: r.hip },
    knee: { left: l.knee, right: r.knee },
    ankle: { left: l.ankle, right: r.ankle },
  }
}
