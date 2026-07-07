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

// ----- Fase 2: eventos e métricas de marcha -----

export type GaitEventMethod = 'coordinate' | 'verticalVelocity' | 'ankleDistance'
export type Side = 'left' | 'right'
export type OperatedSide = Side
export type GaitEventType = 'heelStrike' | 'toeOff'

/** Um evento do ciclo de marcha detetado num instante do clip. */
export interface GaitEvent {
  timeMs: number
  side: Side
  type: GaitEventType
}

/** Métricas temporais médias de um lado (null se não calculável). */
export interface SideMetrics {
  stanceMs: number | null
  swingMs: number | null
  stepMs: number | null
  stanceSwingRatio: number | null
}

/** Métricas de marcha do clip. */
export interface GaitMetrics {
  cadenceStepsPerMin: number | null
  cyclesDetected: number
  operated: SideMetrics
  nonOperated: SideMetrics
  symmetryIndexPct: number | null
}

// ----- Fase 2 C: sinais de compensação -----

export interface AntalgicAssessment {
  evaluable: boolean
  flagged: boolean
  message: string
}

export interface JointRom {
  hipDeg: number | null
  kneeDeg: number | null
  hipReduced: boolean
  kneeReduced: boolean
}

export interface RomResult {
  left: JointRom
  right: JointRom
}

/** Um ponto da série de obliquidade pélvica. */
export interface ObliquitySample {
  timeMs: number
  angleDeg: number | null
}

export interface PelvicObliquity {
  series: ObliquitySample[]
  peakDeg: number | null
  peakTimeMs: number | null
}
