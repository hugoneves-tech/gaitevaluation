import { findPeaks } from './peaks'
import type { GaitEvent, GaitEventMethod, RecordedFrame, Side } from '../types'

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

const MIN_EVENT_GAP_MS = 250

/** Extrai o sinal e os tempos de um lado, aplicando um seletor a cada frame. */
function signalOf(frames: RecordedFrame[], sel: (f: RecordedFrame) => number) {
  return {
    values: frames.map(sel),
    times: frames.map((f) => f.timeMs),
  }
}

/** Gera eventos de um sinal: máximos = heelStrike, mínimos = toeOff. */
function eventsFromSignal(
  values: number[],
  times: number[],
  side: Side,
): GaitEvent[] {
  const events: GaitEvent[] = []
  for (const i of findPeaks(values, times, MIN_EVENT_GAP_MS)) {
    events.push({ timeMs: times[i], side, type: 'heelStrike' })
  }
  const neg = values.map((v) => -v)
  for (const i of findPeaks(neg, times, MIN_EVENT_GAP_MS)) {
    events.push({ timeMs: times[i], side, type: 'toeOff' })
  }
  return events
}

/** Método Coordenadas (Zeni): sinal = (ankleX - hipX) * direção. */
function detectCoordinate(frames: RecordedFrame[], dir: number): GaitEvent[] {
  const out: GaitEvent[] = []
  for (const side of ['left', 'right'] as Side[]) {
    const { values, times } = signalOf(
      frames,
      (f) => (f.landmarks[ANKLE[side]].x - f.landmarks[HIP[side]].x) * dir,
    )
    out.push(...eventsFromSignal(values, times, side))
  }
  return out
}

/** Método Velocidade vertical: sinal = ankle_y (máx = heelStrike, mín = toeOff). */
function detectVerticalVelocity(frames: RecordedFrame[]): GaitEvent[] {
  const out: GaitEvent[] = []
  for (const side of ['left', 'right'] as Side[]) {
    const { values, times } = signalOf(frames, (f) => f.landmarks[ANKLE[side]].y)
    out.push(...eventsFromSignal(values, times, side))
  }
  return out
}

/** Método Distância entre tornozelos: máx afastamento => HS pé da frente, TO pé de trás. */
function detectAnkleDistance(frames: RecordedFrame[], dir: number): GaitEvent[] {
  const values = frames.map(
    (f) => Math.abs(f.landmarks[ANKLE.left].x - f.landmarks[ANKLE.right].x),
  )
  const times = frames.map((f) => f.timeMs)
  const out: GaitEvent[] = []
  for (const i of findPeaks(values, times, MIN_EVENT_GAP_MS)) {
    const f = frames[i]
    const leftAheadWhenDirPos = f.landmarks[ANKLE.left].x > f.landmarks[ANKLE.right].x
    const leftLeads = dir > 0 ? leftAheadWhenDirPos : !leftAheadWhenDirPos
    const front: Side = leftLeads ? 'left' : 'right'
    const back: Side = leftLeads ? 'right' : 'left'
    out.push({ timeMs: times[i], side: front, type: 'heelStrike' })
    out.push({ timeMs: times[i], side: back, type: 'toeOff' })
  }
  return out
}

/**
 * Deteta os eventos do ciclo de marcha por um dos métodos.
 * Devolve [] se não houver deslocação suficiente. Eventos ordenados por timeMs.
 */
export function detectEvents(
  frames: RecordedFrame[],
  method: GaitEventMethod,
): GaitEvent[] {
  const dir = walkDirection(frames)
  if (dir === 0 || frames.length < 3) return []
  let events: GaitEvent[] = []
  if (method === 'coordinate') events = detectCoordinate(frames, dir)
  else if (method === 'verticalVelocity') events = detectVerticalVelocity(frames)
  else if (method === 'ankleDistance') events = detectAnkleDistance(frames, dir)
  return events.sort((a, b) => a.timeMs - b.timeMs)
}
