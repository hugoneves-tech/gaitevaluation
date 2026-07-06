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
  return events.sort((a, b) => a.timeMs - b.timeMs)
}
