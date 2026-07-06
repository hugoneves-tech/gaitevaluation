/** Um ponto devolvido pelo MediaPipe (coordenadas normalizadas 0..1). */
export interface Landmark {
  x: number
  y: number
  z: number
  visibility: number
}

/** Os 33 landmarks de um frame. */
export type PoseFrame = Landmark[]

/** Ângulo de uma articulação; null quando não fiável (baixa visibilidade). */
export type AngleValue = number | null

/** Ângulos das articulações de um frame, por lado. */
export interface JointAngles {
  hip: { left: AngleValue; right: AngleValue }
  knee: { left: AngleValue; right: AngleValue }
  ankle: { left: AngleValue; right: AngleValue }
}

/** Um frame gravado: timestamp relativo (ms) e os landmarks já calculados. */
export interface RecordedFrame {
  timeMs: number
  landmarks: PoseFrame
}

/** Clip gravado: o vídeo (blob URL) e os frames de landmarks sincronizados. */
export interface RecordedClip {
  videoUrl: string
  frames: RecordedFrame[]
}
