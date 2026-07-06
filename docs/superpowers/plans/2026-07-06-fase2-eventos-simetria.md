# Fase 2 (A+B) — Eventos e Simetria/Cadência — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detetar eventos do ciclo de marcha num clip gravado por 3 métodos selecionáveis, derivar métricas de simetria/cadência rotuladas operado/não operado, e mostrar cadência aproximada em tempo real no modo Ao Vivo.

**Architecture:** Lógica pura (`gaitEvents.ts`, `gaitMetrics.ts`, `liveCadence.ts`) sobre o array `RecordedFrame[]` do clip, testável isoladamente com sinais sintéticos. Componentes React (`DetectionProfileBar`, `OperatedSideSelector`, `GaitMetricsPanel`) integrados no `ClipReviewer`; cadência ao vivo no `App`.

**Tech Stack:** React 18, TypeScript, Vitest, React Testing Library (já configurados). Índices de landmarks MediaPipe: anca 23(E)/24(D), tornozelo 27(E)/28(D).

---

## Convenções partilhadas

- Coordenadas normalizadas 0..1; `y` cresce para baixo (topo=0).
- Índices de landmarks: `HIP = {left:23, right:24}`, `ANKLE = {left:27, right:28}`.
- Um `GaitEvent` tem `timeMs`, `side`, `type`. Eventos devolvidos ordenados por `timeMs`.
- Todas as funções puras vivem em `src/lib/` e não importam React.

---

## Task 1: Tipos da Fase 2

**Files:**
- Modify: `src/types.ts` (acrescentar ao fim)

- [ ] **Step 1: Acrescentar os tipos**

Adicionar ao fim de `src/types.ts`:
```ts

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
```

- [ ] **Step 2: Verificar compilação**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add Phase 2 gait event and metrics types"
```

---

## Task 2: Utilitário de deteção de picos (TDD)

**Files:**
- Create: `src/lib/peaks.ts`
- Test: `src/lib/peaks.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/peaks.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { findPeaks } from './peaks'

const times = (n: number, stepMs = 100) =>
  Array.from({ length: n }, (_, i) => i * stepMs)

describe('findPeaks', () => {
  it('encontra máximos locais estritos', () => {
    const v = [0, 1, 0, 1, 2, 1, 0]
    expect(findPeaks(v, times(v.length), 0)).toEqual([1, 4])
  })

  it('ignora as extremidades', () => {
    const v = [5, 1, 0, 1, 5]
    expect(findPeaks(v, times(v.length), 0)).toEqual([])
  })

  it('funde picos demasiado próximos mantendo o mais alto', () => {
    const v = [0, 1, 0, 2, 0]
    // picos em i=1 (t=100) e i=3 (t=300); gap 200ms < 250 => mantém o mais alto (i=3)
    expect(findPeaks(v, times(v.length), 250)).toEqual([3])
  })
})
```

- [ ] **Step 2: Correr para confirmar que falha**

Run: `npx vitest run src/lib/peaks.test.ts`
Expected: FAIL — `findPeaks` não existe.

- [ ] **Step 3: Implementar**

Criar `src/lib/peaks.ts`:
```ts
/**
 * Índices dos máximos locais estritos de `values`, excluindo as extremidades.
 * Picos separados por menos de `minGapMs` são fundidos, mantendo o mais alto.
 * Para vales, negar o sinal antes de chamar.
 */
export function findPeaks(values: number[], times: number[], minGapMs: number): number[] {
  const raw: number[] = []
  for (let i = 1; i < values.length - 1; i++) {
    if (values[i] > values[i - 1] && values[i] > values[i + 1]) raw.push(i)
  }
  const kept: number[] = []
  for (const idx of raw) {
    const last = kept[kept.length - 1]
    if (last !== undefined && times[idx] - times[last] < minGapMs) {
      if (values[idx] > values[last]) kept[kept.length - 1] = idx
    } else {
      kept.push(idx)
    }
  }
  return kept
}
```

- [ ] **Step 4: Correr para confirmar que passa**

Run: `npx vitest run src/lib/peaks.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/peaks.ts src/lib/peaks.test.ts
git commit -m "feat: add local peak detection utility"
```

---

## Task 3: Direção da marcha (TDD)

**Files:**
- Create: `src/lib/gaitEvents.ts`
- Test: `src/lib/gaitEvents.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/gaitEvents.test.ts`:
```ts
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
```

- [ ] **Step 2: Correr para confirmar que falha**

Run: `npx vitest run src/lib/gaitEvents.test.ts`
Expected: FAIL — `walkDirection` não existe.

- [ ] **Step 3: Implementar (ficheiro base + walkDirection)**

Criar `src/lib/gaitEvents.ts`:
```ts
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
```

- [ ] **Step 4: Correr para confirmar que passa**

Run: `npx vitest run src/lib/gaitEvents.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gaitEvents.ts src/lib/gaitEvents.test.ts
git commit -m "feat: add walk direction detection"
```

---

## Task 4: Deteção de eventos — método Coordenadas (TDD)

**Files:**
- Modify: `src/lib/gaitEvents.ts`
- Test: `src/lib/gaitEvents.test.ts` (acrescentar)

- [ ] **Step 1: Acrescentar o teste que falha**

Acrescentar a `src/lib/gaitEvents.test.ts`:
```ts
import { detectEvents } from './gaitEvents'

describe('detectEvents — coordinate', () => {
  it('deteta heel strikes nos máximos do tornozelo relativo à anca', () => {
    // offset do tornozelo E relativo à anca: sobe e desce 2 ciclos.
    const offsets = [0, 0.1, 0.2, 0.1, 0, 0.1, 0.2, 0.1, 0]
    const frames: RecordedFrame[] = offsets.map((off, i) => {
      const hipX = 0.1 + (0.4 * i) / (offsets.length - 1) // marcha para a direita
      return frameAt(i * 100, {
        hipL: [hipX, 0.5],
        hipR: [hipX, 0.5],
        ankL: [hipX + off, 0.9],
        ankR: [hipX, 0.9], // direito constante relativo à anca => sem picos
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
```

- [ ] **Step 2: Correr para confirmar que falha**

Run: `npx vitest run src/lib/gaitEvents.test.ts`
Expected: FAIL — `detectEvents` não existe.

- [ ] **Step 3: Implementar o dispatcher + método coordinate**

Acrescentar a `src/lib/gaitEvents.ts` (imports no topo e funções no fim):
```ts
import { findPeaks } from './peaks'
import type { GaitEvent, GaitEventMethod, Side } from '../types'

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
```

- [ ] **Step 4: Correr para confirmar que passa**

Run: `npx vitest run src/lib/gaitEvents.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gaitEvents.ts src/lib/gaitEvents.test.ts
git commit -m "feat: add coordinate-method gait event detection"
```

---

## Task 5: Deteção de eventos — método Velocidade vertical (TDD)

**Files:**
- Modify: `src/lib/gaitEvents.ts`
- Test: `src/lib/gaitEvents.test.ts` (acrescentar)

Nota: neste método, heelStrike = máximos de `ankle_y` (pé mais baixo, velocidade vertical cruza zero descendente→ascendente); toeOff = mínimos de `ankle_y` (pé mais alto). É uma aproximação — documentada — do evento de balanço.

- [ ] **Step 1: Acrescentar o teste que falha**

Acrescentar a `src/lib/gaitEvents.test.ts`:
```ts
describe('detectEvents — verticalVelocity', () => {
  it('deteta heel strikes nos máximos da altura do tornozelo (pé mais baixo)', () => {
    // ankle_y do lado E: pé desce (y grande) e sobe (y pequeno), 2 ciclos.
    const ys = [0.7, 0.8, 0.9, 0.8, 0.7, 0.8, 0.9, 0.8, 0.7]
    const frames: RecordedFrame[] = ys.map((y, i) => {
      const hipX = 0.1 + (0.4 * i) / (ys.length - 1)
      return frameAt(i * 100, {
        hipL: [hipX, 0.5],
        hipR: [hipX, 0.5],
        ankL: [hipX, y],
        ankR: [hipX, 0.7], // direito constante => sem picos
      })
    })
    const events = detectEvents(frames, 'verticalVelocity')
    const leftHS = events.filter((e) => e.side === 'left' && e.type === 'heelStrike')
    expect(leftHS.map((e) => e.timeMs)).toEqual([200, 600])
  })
})
```

- [ ] **Step 2: Correr para confirmar que falha**

Run: `npx vitest run src/lib/gaitEvents.test.ts`
Expected: FAIL — método `verticalVelocity` ainda não tratado (heelStrikes vazio).

- [ ] **Step 3: Implementar o método**

Em `src/lib/gaitEvents.ts`, acrescentar a função e ligar no dispatcher:
```ts
/** Método Velocidade vertical: sinal = ankle_y (máx = heelStrike, mín = toeOff). */
function detectVerticalVelocity(frames: RecordedFrame[]): GaitEvent[] {
  const out: GaitEvent[] = []
  for (const side of ['left', 'right'] as Side[]) {
    const { values, times } = signalOf(frames, (f) => f.landmarks[ANKLE[side]].y)
    out.push(...eventsFromSignal(values, times, side))
  }
  return out
}
```
E no `detectEvents`, a seguir ao ramo `coordinate`:
```ts
  else if (method === 'verticalVelocity') events = detectVerticalVelocity(frames)
```

- [ ] **Step 4: Correr para confirmar que passa**

Run: `npx vitest run src/lib/gaitEvents.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gaitEvents.ts src/lib/gaitEvents.test.ts
git commit -m "feat: add vertical-velocity gait event detection"
```

---

## Task 6: Deteção de eventos — método Distância entre tornozelos (TDD)

**Files:**
- Modify: `src/lib/gaitEvents.ts`
- Test: `src/lib/gaitEvents.test.ts` (acrescentar)

Nota: sinal = `|ankleX_E − ankleX_D|`. Em cada máximo (pés maximamente afastados), o pé da frente (na direção da marcha) recebe heelStrike e o de trás recebe toeOff.

- [ ] **Step 1: Acrescentar o teste que falha**

Acrescentar a `src/lib/gaitEvents.test.ts`:
```ts
describe('detectEvents — ankleDistance', () => {
  it('nos máximos de afastamento marca heelStrike no pé da frente e toeOff no de trás', () => {
    // marcha para a direita. Afastamento máximo no índice 2 e 6.
    // No índice 2, pé E à frente (x maior); no índice 6, pé D à frente.
    const spec = [
      { l: 0.30, r: 0.30 }, // 0
      { l: 0.34, r: 0.28 }, // 1
      { l: 0.42, r: 0.26 }, // 2  <- máx, E à frente
      { l: 0.40, r: 0.34 }, // 3
      { l: 0.40, r: 0.40 }, // 4
      { l: 0.42, r: 0.48 }, // 5
      { l: 0.40, r: 0.56 }, // 6  <- máx, D à frente
      { l: 0.48, r: 0.54 }, // 7
      { l: 0.52, r: 0.52 }, // 8
    ]
    const frames: RecordedFrame[] = spec.map((s, i) =>
      frameAt(i * 100, {
        hipL: [0.1 + (0.4 * i) / (spec.length - 1), 0.5],
        hipR: [0.1 + (0.4 * i) / (spec.length - 1), 0.5],
        ankL: [s.l, 0.9],
        ankR: [s.r, 0.9],
      }),
    )
    const events = detectEvents(frames, 'ankleDistance')
    expect(events).toContainEqual({ timeMs: 200, side: 'left', type: 'heelStrike' })
    expect(events).toContainEqual({ timeMs: 200, side: 'right', type: 'toeOff' })
    expect(events).toContainEqual({ timeMs: 600, side: 'right', type: 'heelStrike' })
    expect(events).toContainEqual({ timeMs: 600, side: 'left', type: 'toeOff' })
  })
})
```

- [ ] **Step 2: Correr para confirmar que falha**

Run: `npx vitest run src/lib/gaitEvents.test.ts`
Expected: FAIL — método `ankleDistance` ainda não tratado.

- [ ] **Step 3: Implementar o método**

Em `src/lib/gaitEvents.ts`, acrescentar e ligar no dispatcher:
```ts
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
```
E no `detectEvents`, a seguir ao ramo `verticalVelocity`:
```ts
  else if (method === 'ankleDistance') events = detectAnkleDistance(frames, dir)
```

- [ ] **Step 4: Correr para confirmar que passa**

Run: `npx vitest run src/lib/gaitEvents.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gaitEvents.ts src/lib/gaitEvents.test.ts
git commit -m "feat: add ankle-distance gait event detection"
```

---

## Task 7: Métricas de marcha (TDD)

**Files:**
- Create: `src/lib/gaitMetrics.ts`
- Test: `src/lib/gaitMetrics.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/gaitMetrics.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { computeMetrics } from './gaitMetrics'
import type { GaitEvent } from '../types'

// Dois ciclos simétricos e limpos:
// E: HS 0, TO 600, HS 1000, TO 1600, HS 2000
// D: HS 500, TO 1100, HS 1500, TO 2100
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
    // apoio E: HS0->TO600 = 600; HS1000->TO1600 = 600 => média 600
    expect(m.operated.stanceMs).toBeCloseTo(600, 1)
    // balanço E: TO600->HS1000 = 400; TO1600->HS2000 = 400 => 400
    expect(m.operated.swingMs).toBeCloseTo(400, 1)
    // passo E: HS0->HS(D)500 = 500; HS1000->HS(D)1500 = 500 => 500
    expect(m.operated.stepMs).toBeCloseTo(500, 1)
    // rácio apoio/balanço = 600/400 = 1.5
    expect(m.operated.stanceSwingRatio).toBeCloseTo(1.5, 2)
  })

  it('índice de simetria é 0 quando os apoios são iguais', () => {
    const m = computeMetrics(events, 'left')
    expect(m.symmetryIndexPct).toBeCloseTo(0, 1)
  })

  it('cadência = passos por minuto a partir dos heel strikes', () => {
    const m = computeMetrics(events, 'left')
    // 5 HS no total (E:0,1000,2000; D:500,1500) entre t=0 e t=2000 => 4 passos
    // 4 / (2000/60000) = 120 passos/min
    expect(m.cadenceStepsPerMin).toBeCloseTo(120, 0)
  })

  it('devolve nulos e aviso quando há poucos eventos', () => {
    const m = computeMetrics([{ timeMs: 0, side: 'left', type: 'heelStrike' }], 'left')
    expect(m.cyclesDetected).toBe(0)
    expect(m.operated.stanceMs).toBeNull()
    expect(m.cadenceStepsPerMin).toBeNull()
  })
})
```

- [ ] **Step 2: Correr para confirmar que falha**

Run: `npx vitest run src/lib/gaitMetrics.test.ts`
Expected: FAIL — `computeMetrics` não existe.

- [ ] **Step 3: Implementar**

Criar `src/lib/gaitMetrics.ts`:
```ts
import type { GaitEvent, GaitMetrics, OperatedSide, Side, SideMetrics } from '../types'

const mean = (xs: number[]): number | null =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null

/** Intervalos entre um evento de `fromType` num lado e o próximo `toType` alvo. */
function intervals(
  events: GaitEvent[],
  fromSide: Side,
  fromType: GaitEvent['type'],
  toSide: Side,
  toType: GaitEvent['type'],
): number[] {
  const out: number[] = []
  for (const e of events) {
    if (e.side !== fromSide || e.type !== fromType) continue
    const next = events.find(
      (n) => n.timeMs > e.timeMs && n.side === toSide && n.type === toType,
    )
    if (next) out.push(next.timeMs - e.timeMs)
  }
  return out
}

function sideMetrics(events: GaitEvent[], side: Side): SideMetrics {
  const other: Side = side === 'left' ? 'right' : 'left'
  const stance = mean(intervals(events, side, 'heelStrike', side, 'toeOff'))
  const swing = mean(intervals(events, side, 'toeOff', side, 'heelStrike'))
  const step = mean(intervals(events, side, 'heelStrike', other, 'heelStrike'))
  const ratio = stance !== null && swing !== null && swing !== 0 ? stance / swing : null
  return { stanceMs: stance, swingMs: swing, stepMs: step, stanceSwingRatio: ratio }
}

/**
 * Métricas de marcha a partir dos eventos. `operatedSide` rotula operado/não operado.
 */
export function computeMetrics(events: GaitEvent[], operatedSide: OperatedSide): GaitMetrics {
  const nonOperatedSide: Side = operatedSide === 'left' ? 'right' : 'left'
  const operated = sideMetrics(events, operatedSide)
  const nonOperated = sideMetrics(events, nonOperatedSide)

  const heelStrikes = events.filter((e) => e.type === 'heelStrike').sort((a, b) => a.timeMs - b.timeMs)
  let cadence: number | null = null
  if (heelStrikes.length >= 2) {
    const durMs = heelStrikes[heelStrikes.length - 1].timeMs - heelStrikes[0].timeMs
    if (durMs > 0) cadence = (heelStrikes.length - 1) / (durMs / 60000)
  }

  let symmetry: number | null = null
  if (operated.stanceMs !== null && nonOperated.stanceMs !== null) {
    const denom = (operated.stanceMs + nonOperated.stanceMs) / 2
    if (denom > 0) symmetry = (Math.abs(operated.stanceMs - nonOperated.stanceMs) / denom) * 100
  }

  // ciclos = nº de intervalos de apoio calculados no lado operado
  const cyclesDetected = intervals(events, operatedSide, 'heelStrike', operatedSide, 'toeOff').length

  return {
    cadenceStepsPerMin: cadence,
    cyclesDetected,
    operated,
    nonOperated,
    symmetryIndexPct: symmetry,
  }
}
```

- [ ] **Step 4: Correr para confirmar que passa**

Run: `npx vitest run src/lib/gaitMetrics.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gaitMetrics.ts src/lib/gaitMetrics.test.ts
git commit -m "feat: add gait metrics (stance/swing/step, cadence, symmetry)"
```

---

## Task 8: Cadência ao vivo (TDD)

**Files:**
- Create: `src/lib/liveCadence.ts`
- Test: `src/lib/liveCadence.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/liveCadence.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { createLiveCadence } from './liveCadence'

describe('createLiveCadence', () => {
  it('conta picos numa janela e devolve passos/min', () => {
    const cad = createLiveCadence(5000, 200)
    // Sinal com pico de altura a cada 500ms (2 passos/s = 120/min) durante 5s.
    // ankle_y sobe/desce; pico = máximo local.
    const values: number[] = []
    const step = [0.7, 0.9, 0.7] // sobe ao meio (pico)
    for (let k = 0; k < 12; k++) values.push(...step)
    let last: number | null = null
    let t = 0
    for (const v of values) {
      last = cad.push(v, t)
      t += 500 / step.length
    }
    // ~12 picos em ~6s; a janela de 5s deve dar perto de 120 passos/min.
    expect(last).not.toBeNull()
    expect(last!).toBeGreaterThan(90)
    expect(last!).toBeLessThan(150)
  })

  it('devolve null antes de haver picos suficientes', () => {
    const cad = createLiveCadence(5000, 200)
    expect(cad.push(0.7, 0)).toBeNull()
  })
})
```

- [ ] **Step 2: Correr para confirmar que falha**

Run: `npx vitest run src/lib/liveCadence.test.ts`
Expected: FAIL — `createLiveCadence` não existe.

- [ ] **Step 3: Implementar**

Criar `src/lib/liveCadence.ts`:
```ts
/**
 * Contador de passos em streaming para o modo Ao Vivo.
 * Deteta máximos locais do sinal (altura do tornozelo) e conta os que caem
 * numa janela deslizante para estimar a cadência (passos/min).
 * @param windowMs largura da janela deslizante.
 * @param minGapMs intervalo mínimo entre picos (rejeita duplos).
 */
export function createLiveCadence(windowMs: number, minGapMs: number) {
  const peakTimes: number[] = []
  let p2: number | null = null // valor há 2 amostras
  let p1: number | null = null // valor há 1 amostra
  let t1 = 0 // tempo da amostra p1

  return {
    /** Recebe uma amostra; devolve a cadência estimada (passos/min) ou null. */
    push(value: number, timeMs: number): number | null {
      if (p2 !== null && p1 !== null && p1 > p2 && p1 > value) {
        const last = peakTimes[peakTimes.length - 1]
        if (last === undefined || t1 - last >= minGapMs) peakTimes.push(t1)
      }
      p2 = p1
      p1 = value
      t1 = timeMs

      const cutoff = timeMs - windowMs
      while (peakTimes.length && peakTimes[0] < cutoff) peakTimes.shift()

      if (peakTimes.length < 2) return null
      return peakTimes.length * (60000 / windowMs)
    },
  }
}
```

- [ ] **Step 4: Correr para confirmar que passa**

Run: `npx vitest run src/lib/liveCadence.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/liveCadence.ts src/lib/liveCadence.test.ts
git commit -m "feat: add live cadence step counter"
```

---

## Task 9: Barra de perfil de deteção (TDD)

**Files:**
- Create: `src/components/DetectionProfileBar.tsx`
- Test: `src/components/DetectionProfileBar.test.tsx`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/components/DetectionProfileBar.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DetectionProfileBar } from './DetectionProfileBar'

describe('DetectionProfileBar', () => {
  it('marca o método ativo e chama onChange ao clicar noutro', () => {
    const onChange = vi.fn()
    render(<DetectionProfileBar value="coordinate" onChange={onChange} />)
    const ativo = screen.getByRole('button', { name: /coordenadas/i })
    expect(ativo).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: /velocidade/i }))
    expect(onChange).toHaveBeenCalledWith('verticalVelocity')
  })
})
```

- [ ] **Step 2: Correr para confirmar que falha**

Run: `npx vitest run src/components/DetectionProfileBar.test.tsx`
Expected: FAIL — componente não existe.

- [ ] **Step 3: Implementar**

Criar `src/components/DetectionProfileBar.tsx`:
```tsx
import type { GaitEventMethod } from '../types'

const METHODS: { key: GaitEventMethod; label: string }[] = [
  { key: 'coordinate', label: 'Coordenadas' },
  { key: 'verticalVelocity', label: 'Velocidade' },
  { key: 'ankleDistance', label: 'Distância' },
]

export function DetectionProfileBar({
  value,
  onChange,
}: {
  value: GaitEventMethod
  onChange: (method: GaitEventMethod) => void
}) {
  return (
    <div className="profile-bar" role="group" aria-label="Método de deteção">
      {METHODS.map(({ key, label }) => (
        <button
          key={key}
          aria-pressed={value === key}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Correr para confirmar que passa**

Run: `npx vitest run src/components/DetectionProfileBar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/DetectionProfileBar.tsx src/components/DetectionProfileBar.test.tsx
git commit -m "feat: add detection profile bar"
```

---

## Task 10: Seletor de perna operada (TDD)

**Files:**
- Create: `src/components/OperatedSideSelector.tsx`
- Test: `src/components/OperatedSideSelector.test.tsx`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/components/OperatedSideSelector.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OperatedSideSelector } from './OperatedSideSelector'

describe('OperatedSideSelector', () => {
  it('mostra o lado ativo e alterna', () => {
    const onChange = vi.fn()
    render(<OperatedSideSelector value="left" onChange={onChange} />)
    expect(screen.getByRole('button', { name: /esquerda/i })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: /direita/i }))
    expect(onChange).toHaveBeenCalledWith('right')
  })
})
```

- [ ] **Step 2: Correr para confirmar que falha**

Run: `npx vitest run src/components/OperatedSideSelector.test.tsx`
Expected: FAIL — componente não existe.

- [ ] **Step 3: Implementar**

Criar `src/components/OperatedSideSelector.tsx`:
```tsx
import type { OperatedSide } from '../types'

const SIDES: { key: OperatedSide; label: string }[] = [
  { key: 'left', label: 'Esquerda' },
  { key: 'right', label: 'Direita' },
]

export function OperatedSideSelector({
  value,
  onChange,
}: {
  value: OperatedSide
  onChange: (side: OperatedSide) => void
}) {
  return (
    <div className="operated-selector" role="group" aria-label="Perna operada">
      <span>Perna operada:</span>
      {SIDES.map(({ key, label }) => (
        <button key={key} aria-pressed={value === key} onClick={() => onChange(key)}>
          {label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Correr para confirmar que passa**

Run: `npx vitest run src/components/OperatedSideSelector.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/OperatedSideSelector.tsx src/components/OperatedSideSelector.test.tsx
git commit -m "feat: add operated-side selector"
```

---

## Task 11: Painel de métricas (TDD)

**Files:**
- Create: `src/components/GaitMetricsPanel.tsx`
- Test: `src/components/GaitMetricsPanel.test.tsx`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/components/GaitMetricsPanel.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GaitMetricsPanel } from './GaitMetricsPanel'
import type { GaitMetrics } from '../types'

const metrics: GaitMetrics = {
  cadenceStepsPerMin: 110,
  cyclesDetected: 3,
  operated: { stanceMs: 700, swingMs: 400, stepMs: 550, stanceSwingRatio: 1.75 },
  nonOperated: { stanceMs: 600, swingMs: 420, stepMs: 540, stanceSwingRatio: 1.43 },
  symmetryIndexPct: 15.4,
}

describe('GaitMetricsPanel', () => {
  it('mostra cadência, simetria e rótulos operado/não operado', () => {
    render(<GaitMetricsPanel metrics={metrics} />)
    expect(screen.getByText(/110/)).toBeInTheDocument()
    expect(screen.getByText(/15/)).toBeInTheDocument()
    expect(screen.getByText(/operado/i)).toBeInTheDocument()
  })

  it('mostra aviso de passos insuficientes quando não há ciclos', () => {
    const empty: GaitMetrics = {
      cadenceStepsPerMin: null,
      cyclesDetected: 0,
      operated: { stanceMs: null, swingMs: null, stepMs: null, stanceSwingRatio: null },
      nonOperated: { stanceMs: null, swingMs: null, stepMs: null, stanceSwingRatio: null },
      symmetryIndexPct: null,
    }
    render(<GaitMetricsPanel metrics={empty} />)
    expect(screen.getByText(/passos suficientes/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Correr para confirmar que falha**

Run: `npx vitest run src/components/GaitMetricsPanel.test.tsx`
Expected: FAIL — componente não existe.

- [ ] **Step 3: Implementar**

Criar `src/components/GaitMetricsPanel.tsx`:
```tsx
import type { GaitMetrics, SideMetrics } from '../types'

const ms = (v: number | null): string => (v === null ? '—' : `${Math.round(v)} ms`)
const num = (v: number | null, d = 0): string => (v === null ? '—' : v.toFixed(d))
const ratio = (v: number | null): string => (v === null ? '—' : v.toFixed(2))

const rows: { key: keyof SideMetrics; label: string; fmt: (v: number | null) => string }[] = [
  { key: 'stanceMs', label: 'Apoio', fmt: ms },
  { key: 'swingMs', label: 'Balanço', fmt: ms },
  { key: 'stepMs', label: 'Passo', fmt: ms },
  { key: 'stanceSwingRatio', label: 'Rácio apoio/balanço', fmt: ratio },
]

export function GaitMetricsPanel({ metrics }: { metrics: GaitMetrics }) {
  if (metrics.cyclesDetected === 0) {
    return (
      <p className="metrics-warning" role="status">
        Não foram detetados passos suficientes — filme uma passagem a caminhar de lado,
        com vários passos.
      </p>
    )
  }
  return (
    <div className="gait-metrics">
      <div className="metrics-highlight">
        <span>Cadência: <strong>{num(metrics.cadenceStepsPerMin)}</strong> passos/min</span>
        <span>
          Índice de simetria: <strong>{num(metrics.symmetryIndexPct, 1)}%</strong>
        </span>
        <span className="metrics-cycles">{metrics.cyclesDetected} ciclo(s)</span>
      </div>
      <table className="angle-panel">
        <thead>
          <tr>
            <th>Métrica</th>
            <th>Operado</th>
            <th>Não operado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, label, fmt }) => (
            <tr key={key}>
              <td>{label}</td>
              <td>{fmt(metrics.operated[key])}</td>
              <td>{fmt(metrics.nonOperated[key])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 4: Correr para confirmar que passa**

Run: `npx vitest run src/components/GaitMetricsPanel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/GaitMetricsPanel.tsx src/components/GaitMetricsPanel.test.tsx
git commit -m "feat: add gait metrics panel"
```

---

## Task 12: Integrar no ClipReviewer

**Files:**
- Modify: `src/components/ClipReviewer.tsx`

Integra a barra de perfil, o seletor de lado, o painel de métricas, os marcadores de evento na timeline e a nota de enquadramento. Os eventos e as métricas são memoizados e recalculam ao trocar de método ou de lado.

- [ ] **Step 1: Substituir o conteúdo de `ClipReviewer.tsx`**

Substituir todo o ficheiro por:
```tsx
import { useMemo, useRef, useState } from 'react'
import type { GaitEventMethod, OperatedSide, RecordedClip } from '../types'
import { computeAngles } from '../lib/angles'
import { detectEvents } from '../lib/gaitEvents'
import { computeMetrics } from '../lib/gaitMetrics'
import { SkeletonOverlay } from './SkeletonOverlay'
import { AnglePanel } from './AnglePanel'
import { DetectionProfileBar } from './DetectionProfileBar'
import { OperatedSideSelector } from './OperatedSideSelector'
import { GaitMetricsPanel } from './GaitMetricsPanel'

const WIDTH = 640
const HEIGHT = 480
const STEP_MS = 1000 / 30 // um frame a 30 fps

const EVENT_COLOR = { left: '#2ecc71', right: '#e74c3c' } as const

function nearestFrame(clip: RecordedClip, timeMs: number) {
  let best = clip.frames[0]
  let bestDelta = Infinity
  for (const f of clip.frames) {
    const d = Math.abs(f.timeMs - timeMs)
    if (d < bestDelta) {
      bestDelta = d
      best = f
    }
  }
  return best ?? null
}

export function ClipReviewer({ clip }: { clip: RecordedClip }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [timeMs, setTimeMs] = useState(0)
  const [method, setMethod] = useState<GaitEventMethod>('coordinate')
  const [operated, setOperated] = useState<OperatedSide>('left')

  const frame = useMemo(
    () => (clip.frames.length ? nearestFrame(clip, timeMs) : null),
    [clip, timeMs],
  )
  const angles = useMemo(
    () => (frame ? computeAngles(frame.landmarks, 0.5) : null),
    [frame],
  )
  const events = useMemo(() => detectEvents(clip.frames, method), [clip, method])
  const metrics = useMemo(() => computeMetrics(events, operated), [events, operated])

  const durationMs = clip.frames.length
    ? clip.frames[clip.frames.length - 1].timeMs
    : 0

  const seek = (deltaMs: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = Math.max(0, video.currentTime + deltaMs / 1000)
  }

  const setRate = (rate: number) => {
    if (videoRef.current) videoRef.current.playbackRate = rate
  }

  return (
    <div>
      <p className="pedagogical-notice" role="note">
        Para esta análise, filme de lado (plano sagital) o doente a caminhar vários passos a
        atravessar o enquadramento.
      </p>

      <div style={{ position: 'relative', width: WIDTH, height: HEIGHT }}>
        <video
          ref={videoRef}
          src={clip.videoUrl}
          width={WIDTH}
          height={HEIGHT}
          onTimeUpdate={(e) => setTimeMs(e.currentTarget.currentTime * 1000)}
          controls
        />
        <SkeletonOverlay frame={frame?.landmarks ?? null} width={WIDTH} height={HEIGHT} />
      </div>

      {durationMs > 0 && (
        <div className="event-timeline" aria-label="Marcadores de evento">
          {events.map((ev, i) => (
            <span
              key={i}
              className="event-marker"
              title={`${ev.type === 'heelStrike' ? 'Contacto inicial' : 'Toe off'} (${ev.side})`}
              style={{
                left: `${(ev.timeMs / durationMs) * 100}%`,
                background: EVENT_COLOR[ev.side],
                opacity: ev.type === 'heelStrike' ? 1 : 0.4,
              }}
            />
          ))}
        </div>
      )}

      <div className="controls">
        <button onClick={() => seek(-STEP_MS)}>◀ Frame</button>
        <button onClick={() => seek(STEP_MS)}>Frame ▶</button>
        <button onClick={() => setRate(0.25)}>0.25×</button>
        <button onClick={() => setRate(0.5)}>0.5×</button>
        <button onClick={() => setRate(1)}>1×</button>
      </div>

      <DetectionProfileBar value={method} onChange={setMethod} />
      <OperatedSideSelector value={operated} onChange={setOperated} />
      <GaitMetricsPanel metrics={metrics} />

      {angles && <AnglePanel angles={angles} />}
    </div>
  )
}
```

- [ ] **Step 2: Verificar compilação e testes**

Run: `npx tsc --noEmit && npm test`
Expected: sem erros de tipos; todos os testes passam (o teste do App mock não é afetado).

- [ ] **Step 3: Commit**

```bash
git add src/components/ClipReviewer.tsx
git commit -m "feat: integrate events, metrics and profile bar into ClipReviewer"
```

---

## Task 13: Cadência ao vivo no App

**Files:**
- Modify: `src/App.tsx`

Adiciona um contador de cadência em streaming no loop de deteção do modo Ao Vivo, alimentado pela altura média dos tornozelos, e mostra o valor com etiqueta "aproximada".

- [ ] **Step 1: Adicionar estado e o contador**

Em `src/App.tsx`, a seguir à linha `const [angles, setAngles] = useState<JointAngles>(emptyAngles)`, adicionar:
```tsx
  const [liveCadence, setLiveCadence] = useState<number | null>(null)
```
E a seguir ao bloco `const smoothers = useRef({ ... })`, adicionar o contador (import no topo do ficheiro):
```tsx
  const cadenceCounter = useRef(createLiveCadence(5000, 300))
```
No topo do ficheiro, juntar aos imports:
```tsx
import { createLiveCadence } from './lib/liveCadence'
```

- [ ] **Step 2: Alimentar o contador no loop**

Dentro do `tick`, no bloco `if (lm) { ... }` (a seguir a `if (recording) captureFrame(lm)`), adicionar:
```tsx
          const ankleY = (lm[27].y + lm[28].y) / 2
          setLiveCadence(cadenceCounter.current.push(ankleY, performance.now()))
```

- [ ] **Step 3: Mostrar a cadência no modo Ao Vivo**

No JSX do modo `live`, a seguir ao `<AnglePanel angles={angles} />`, adicionar:
```tsx
          <p className="live-cadence">
            Cadência (aproximada):{' '}
            <strong>{liveCadence === null ? '—' : Math.round(liveCadence)}</strong> passos/min
          </p>
```

- [ ] **Step 4: Verificar compilação e testes**

Run: `npx tsc --noEmit && npm test`
Expected: sem erros; testes passam (o App.test mocka `usePoseEngine`/`CameraView`, não corre o loop).

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add approximate live cadence in live mode"
```

---

## Task 14: Estilos dos novos elementos

**Files:**
- Modify: `src/index.css` (acrescentar ao fim)

- [ ] **Step 1: Acrescentar estilos**

Adicionar ao fim de `src/index.css`:
```css
.profile-bar,
.operated-selector {
  margin-top: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.profile-bar button,
.operated-selector button {
  padding: 0.35rem 0.8rem;
  cursor: pointer;
}

.profile-bar button[aria-pressed='true'],
.operated-selector button[aria-pressed='true'] {
  font-weight: bold;
  border-bottom: 2px solid #3498db;
}

.event-timeline {
  position: relative;
  height: 14px;
  margin-top: 4px;
  background: #f0f0f0;
  border-radius: 3px;
}

.event-marker {
  position: absolute;
  top: 0;
  width: 2px;
  height: 14px;
  transform: translateX(-1px);
}

.gait-metrics {
  margin-top: 1rem;
}

.metrics-highlight {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.5rem;
}

.metrics-cycles {
  color: #6b6375;
}

.metrics-warning {
  margin-top: 1rem;
  background: #fff3cd;
  color: #664d03;
  border: 1px solid #ffe69c;
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
}

.live-cadence {
  margin-top: 0.5rem;
}
```

- [ ] **Step 2: Verificar o build**

Run: `npm run build`
Expected: build sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "style: add styling for profile bar, timeline and metrics"
```

---

## Task 15: Validação manual (checklist)

Sem código. Correr `npm run dev`, gravar um clip a caminhar de lado (vários passos) e confirmar:

- [ ] **Deteção:** com o clip gravado, o painel de métricas mostra cadência, apoio/balanço/passo e índice de simetria.
- [ ] **Barra de perfil:** trocar entre Coordenadas / Velocidade / Distância recalcula e muda os marcadores e as métricas.
- [ ] **Perna operada:** trocar Esquerda/Direita troca os rótulos operado/não operado e o índice de simetria.
- [ ] **Marcadores na timeline:** os traços aparecem alinhados com os eventos; ao avançar quadro-a-quadro, coincidem com os instantes de contacto/toe off.
- [ ] **Passos insuficientes:** um clip curto/parado mostra o aviso em vez de métricas.
- [ ] **Cadência ao vivo:** no modo Ao Vivo, a caminhar no lugar, aparece um valor aproximado de passos/min.
- [ ] **Nota de enquadramento:** visível no modo Rever.

Registar quaisquer problemas como tarefas de correção antes de concluir A+B.

---

## Notas de verificação do plano (self-review)

- **Cobertura da spec:** 3 métodos de deteção (Tasks 4,5,6), direção da marcha (Task 3), utilitário de picos partilhado/DRY (Task 2), métricas apoio/balanço/passo/rácio/cadência/simetria (Task 7), cadência ao vivo (Task 8), barra de perfil (Task 9), seletor de lado operado (Task 10), painel com rótulos + aviso (Task 11), marcadores na timeline + nota de enquadramento (Task 12), cadência ao vivo na UI (Task 13). ✔️
- **Consistência de tipos:** `GaitEventMethod`, `GaitEvent`, `Side`, `OperatedSide`, `SideMetrics`, `GaitMetrics` definidos na Task 1 e usados coerentemente; `detectEvents(frames, method)` (Tasks 4-6) e `computeMetrics(events, operatedSide)` (Task 7) com as mesmas assinaturas na Task 12; `createLiveCadence(windowMs, minGapMs)` (Task 8) usado na Task 13; `findPeaks(values, times, minGapMs)` (Task 2) usado nas Tasks 4-6. ✔️
- **Fora de âmbito (não incluído):** Trendelenburg/antálgica dedicada (sub-projeto C), modelo ML de eventos, velocidade absoluta. ✔️
