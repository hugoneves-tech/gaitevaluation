# Fase 2 (C) — Sinais de Compensação — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Acrescentar a interpretação de sinais de compensação — marcha antálgica e redução de ROM (sagital) e leitura assistida do Trendelenburg via obliquidade pélvica (coronal) — ao modo Rever.

**Architecture:** Lógica pura em `src/lib/compensation.ts` sobre `RecordedFrame[]` e `GaitMetrics`, reutilizando `computeAngles` da Fase 1. Componentes de apresentação (`CompensationPanel`, `TrendelenburgPanel`) e uma linha da pélvis no `SkeletonOverlay`, integrados no `ClipReviewer`.

**Tech Stack:** React 18, TypeScript, Vitest, React Testing Library. Índices de landmarks MediaPipe: ombro 11(E)/12(D), anca 23(E)/24(D), joelho 25(E)/26(D), tornozelo 27(E)/28(D).

---

## Convenções

- Limiares pedagógicos: simetria de apoio ≥ 10% (antálgica); ROM anca < 30°, joelho < 45°.
- `computeAngles(landmarks, minVisibility)` (já existe) devolve `JointAngles` com `hip/knee/ankle`, cada um `{ left, right }`, valores em graus ou `null`.
- Obliquidade pélvica: `atan2(hipD.y − hipE.y, hipD.x − hipE.x) × 180/π`; 0° = nivelada.

---

## Task 1: Tipos de compensação

**Files:**
- Modify: `src/types.ts` (acrescentar ao fim)

- [ ] **Step 1: Acrescentar os tipos**

Adicionar ao fim de `src/types.ts`:
```ts

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
```

- [ ] **Step 2: Verificar compilação**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add compensation-sign types"
```

---

## Task 2: assessAntalgic (TDD)

**Files:**
- Create: `src/lib/compensation.ts`
- Test: `src/lib/compensation.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/compensation.test.ts`:
```ts
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
```

- [ ] **Step 2: Correr para confirmar que falha**

Run: `npx vitest run src/lib/compensation.test.ts`
Expected: FAIL — `assessAntalgic` não existe.

- [ ] **Step 3: Implementar (ficheiro base + assessAntalgic)**

Criar `src/lib/compensation.ts`:
```ts
import type { AntalgicAssessment, GaitMetrics } from '../types'

const SYMMETRY_FLAG_PCT = 10
const HIP_ROM_MIN_DEG = 30
const KNEE_ROM_MIN_DEG = 45

/** Avalia padrão antálgico a partir das métricas de marcha. */
export function assessAntalgic(metrics: GaitMetrics): AntalgicAssessment {
  const op = metrics.operated.stanceMs
  const nonop = metrics.nonOperated.stanceMs
  const si = metrics.symmetryIndexPct
  if (op === null || nonop === null || si === null) {
    return {
      evaluable: false,
      flagged: false,
      message: 'Não avaliável — sem métricas de apoio suficientes.',
    }
  }
  const flagged = op < nonop && si >= SYMMETRY_FLAG_PCT
  const message = flagged
    ? `⚠️ Apoio do lado operado reduzido em ${Math.round(si)}% — sugestivo de padrão antálgico.`
    : 'Sem assimetria de apoio relevante.'
  return { evaluable: true, flagged, message }
}
```
Nota: `HIP_ROM_MIN_DEG`/`KNEE_ROM_MIN_DEG` são usados na Task 3 (mantê-los aqui).

- [ ] **Step 4: Correr para confirmar que passa**

Run: `npx vitest run src/lib/compensation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/compensation.ts src/lib/compensation.test.ts
git commit -m "feat: add antalgic gait assessment"
```

---

## Task 3: computeRom (TDD)

**Files:**
- Modify: `src/lib/compensation.ts`
- Test: `src/lib/compensation.test.ts` (acrescentar)

- [ ] **Step 1: Acrescentar o teste que falha**

Acrescentar a `src/lib/compensation.test.ts`:
```ts
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
  const lm: PoseFrame = Array.from({ length: 33 }, () => P(0, 0, 0)) // outros invisíveis
  lm[11] = P(sh[0], sh[1], visibility)
  lm[23] = P(hip[0], hip[1], visibility)
  lm[25] = P(knee[0], knee[1], visibility)
  lm[27] = P(ank[0], ank[1], visibility)
  return { timeMs, landmarks: lm }
}

describe('computeRom', () => {
  it('calcula a amplitude do joelho e sinaliza a anca sem amplitude', () => {
    // Frame 0: joelho reto (180°). Frame 1: joelho a 90°. Anca a 180° nos dois.
    const frames: RecordedFrame[] = [
      leftLegFrame(0, [0, -1], [0, 0], [0, 1], [0, 2]),
      leftLegFrame(100, [0, -1], [0, 0], [0, 1], [1, 1]),
    ]
    const rom = computeRom(frames)
    expect(rom.left.kneeDeg).toBeCloseTo(90, 0) // 180 -> 90
    expect(rom.left.kneeReduced).toBe(false) // 90 >= 45
    expect(rom.left.hipDeg).toBeCloseTo(0, 0) // 180 nos dois => amplitude 0
    expect(rom.left.hipReduced).toBe(true) // 0 < 30
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
```

- [ ] **Step 2: Correr para confirmar que falha**

Run: `npx vitest run src/lib/compensation.test.ts`
Expected: FAIL — `computeRom` não existe.

- [ ] **Step 3: Implementar**

Acrescentar a `src/lib/compensation.ts` (imports no topo e funções no fim):
```ts
import { computeAngles } from './angles'
import type { JointRom, RecordedFrame, RomResult, Side } from '../types'

/** Amplitude (máx−mín) de uma lista de valores; null se < 2 valores. */
function rangeOf(values: number[]): number | null {
  if (values.length < 2) return null
  return Math.max(...values) - Math.min(...values)
}

/**
 * Amplitude (ROM) da anca e do joelho por lado, a partir dos ângulos de cada frame.
 * Ignora frames onde o ângulo é null (baixa visibilidade).
 */
export function computeRom(frames: RecordedFrame[], minVisibility = 0.5): RomResult {
  const acc = {
    left: { hip: [] as number[], knee: [] as number[] },
    right: { hip: [] as number[], knee: [] as number[] },
  }
  for (const f of frames) {
    const a = computeAngles(f.landmarks, minVisibility)
    for (const side of ['left', 'right'] as Side[]) {
      const hip = a.hip[side]
      const knee = a.knee[side]
      if (hip !== null) acc[side].hip.push(hip)
      if (knee !== null) acc[side].knee.push(knee)
    }
  }
  const forSide = (side: Side): JointRom => {
    const hipDeg = rangeOf(acc[side].hip)
    const kneeDeg = rangeOf(acc[side].knee)
    return {
      hipDeg,
      kneeDeg,
      hipReduced: hipDeg !== null && hipDeg < HIP_ROM_MIN_DEG,
      kneeReduced: kneeDeg !== null && kneeDeg < KNEE_ROM_MIN_DEG,
    }
  }
  return { left: forSide('left'), right: forSide('right') }
}
```

- [ ] **Step 4: Correr para confirmar que passa**

Run: `npx vitest run src/lib/compensation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/compensation.ts src/lib/compensation.test.ts
git commit -m "feat: add hip/knee ROM computation"
```

---

## Task 4: pelvicObliquitySeries (TDD)

**Files:**
- Modify: `src/lib/compensation.ts`
- Test: `src/lib/compensation.test.ts` (acrescentar)

- [ ] **Step 1: Acrescentar o teste que falha**

Acrescentar a `src/lib/compensation.test.ts`:
```ts
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
      hipsFrame(0, [0.4, 0.5], [0.6, 0.5]), // nivelada => 0°
      hipsFrame(100, [0.4, 0.5], [0.6, 0.6]), // direita desce => +26.57°
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
```

- [ ] **Step 2: Correr para confirmar que falha**

Run: `npx vitest run src/lib/compensation.test.ts`
Expected: FAIL — `pelvicObliquitySeries` não existe.

- [ ] **Step 3: Implementar**

Acrescentar a `src/lib/compensation.ts` (import de tipos e função no fim). Juntar `ObliquitySample`, `PelvicObliquity` ao import de tipos existente:
```ts
import type { ObliquitySample, PelvicObliquity } from '../types'

const HIP_L = 23
const HIP_R = 24

/**
 * Série temporal da obliquidade pélvica (ângulo da linha das ancas) e o seu pico.
 * angleDeg é null nos frames com ancas pouco visíveis.
 */
export function pelvicObliquitySeries(
  frames: RecordedFrame[],
  minVisibility = 0.5,
): PelvicObliquity {
  const series: ObliquitySample[] = frames.map((f) => {
    const hl = f.landmarks[HIP_L]
    const hr = f.landmarks[HIP_R]
    if (hl.visibility < minVisibility || hr.visibility < minVisibility) {
      return { timeMs: f.timeMs, angleDeg: null }
    }
    const angleDeg = (Math.atan2(hr.y - hl.y, hr.x - hl.x) * 180) / Math.PI
    return { timeMs: f.timeMs, angleDeg }
  })
  let peakDeg: number | null = null
  let peakTimeMs: number | null = null
  for (const s of series) {
    if (s.angleDeg === null) continue
    if (peakDeg === null || Math.abs(s.angleDeg) > Math.abs(peakDeg)) {
      peakDeg = s.angleDeg
      peakTimeMs = s.timeMs
    }
  }
  return { series, peakDeg, peakTimeMs }
}
```

- [ ] **Step 4: Correr para confirmar que passa**

Run: `npx vitest run src/lib/compensation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/compensation.ts src/lib/compensation.test.ts
git commit -m "feat: add pelvic obliquity series for Trendelenburg"
```

---

## Task 5: CompensationPanel (TDD)

**Files:**
- Create: `src/components/CompensationPanel.tsx`
- Test: `src/components/CompensationPanel.test.tsx`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/components/CompensationPanel.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CompensationPanel } from './CompensationPanel'
import type { AntalgicAssessment, RomResult } from '../types'

const antalgic: AntalgicAssessment = {
  evaluable: true,
  flagged: true,
  message: '⚠️ Apoio do lado operado reduzido em 18% — sugestivo de padrão antálgico.',
}

const rom: RomResult = {
  left: { hipDeg: 25, kneeDeg: 40, hipReduced: true, kneeReduced: true },
  right: { hipDeg: 35, kneeDeg: 55, hipReduced: false, kneeReduced: false },
}

describe('CompensationPanel', () => {
  it('mostra o veredito antálgico', () => {
    render(<CompensationPanel antalgic={antalgic} rom={rom} operatedSide="left" />)
    expect(screen.getByText(/antálgico/i)).toBeInTheDocument()
  })

  it('destaca a ROM abaixo do limiar do lado operado', () => {
    render(<CompensationPanel antalgic={antalgic} rom={rom} operatedSide="left" />)
    // lado operado = left => célula do joelho operado (40°) marcada como reduzida
    expect(screen.getByTestId('rom-operated-knee')).toHaveClass('rom-reduced')
    expect(screen.getByTestId('rom-nonOperated-knee')).not.toHaveClass('rom-reduced')
  })
})
```

- [ ] **Step 2: Correr para confirmar que falha**

Run: `npx vitest run src/components/CompensationPanel.test.tsx`
Expected: FAIL — componente não existe.

- [ ] **Step 3: Implementar**

Criar `src/components/CompensationPanel.tsx`:
```tsx
import type { AntalgicAssessment, JointRom, OperatedSide, RomResult } from '../types'

const deg = (v: number | null): string => (v === null ? '—' : `${Math.round(v)}°`)

export function CompensationPanel({
  antalgic,
  rom,
  operatedSide,
}: {
  antalgic: AntalgicAssessment
  rom: RomResult
  operatedSide: OperatedSide
}) {
  const nonOperatedSide = operatedSide === 'left' ? 'right' : 'left'
  const opRom: JointRom = rom[operatedSide]
  const nonRom: JointRom = rom[nonOperatedSide]

  const cell = (
    key: string,
    value: number | null,
    reduced: boolean,
  ) => (
    <td data-testid={key} className={reduced ? 'rom-reduced' : undefined}>
      {deg(value)}
    </td>
  )

  return (
    <div className="compensation">
      <h3>Sinais de compensação</h3>
      <p className={antalgic.flagged ? 'antalgic-flagged' : 'antalgic-ok'} role="status">
        {antalgic.message}
      </p>
      <table className="angle-panel">
        <thead>
          <tr>
            <th>Amplitude</th>
            <th>Operado</th>
            <th aria-label="Não operado">Não op.</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Anca</td>
            {cell('rom-operated-hip', opRom.hipDeg, opRom.hipReduced)}
            {cell('rom-nonOperated-hip', nonRom.hipDeg, nonRom.hipReduced)}
          </tr>
          <tr>
            <td>Joelho</td>
            {cell('rom-operated-knee', opRom.kneeDeg, opRom.kneeReduced)}
            {cell('rom-nonOperated-knee', nonRom.kneeDeg, nonRom.kneeReduced)}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 4: Correr para confirmar que passa**

Run: `npx vitest run src/components/CompensationPanel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/CompensationPanel.tsx src/components/CompensationPanel.test.tsx
git commit -m "feat: add compensation panel (antalgic + ROM)"
```

---

## Task 6: TrendelenburgPanel (TDD)

**Files:**
- Create: `src/components/TrendelenburgPanel.tsx`
- Test: `src/components/TrendelenburgPanel.test.tsx`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/components/TrendelenburgPanel.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TrendelenburgPanel } from './TrendelenburgPanel'
import type { PelvicObliquity } from '../types'

const obliquity: PelvicObliquity = {
  series: [
    { timeMs: 0, angleDeg: 2 },
    { timeMs: 100, angleDeg: 12 },
    { timeMs: 200, angleDeg: 5 },
  ],
  peakDeg: 12,
  peakTimeMs: 100,
}

describe('TrendelenburgPanel', () => {
  it('mostra a obliquidade do frame atual e o pico', () => {
    render(<TrendelenburgPanel obliquity={obliquity} currentTimeMs={200} onSeek={() => {}} />)
    expect(screen.getByTestId('obliquity-current')).toHaveTextContent('5')
    expect(screen.getByTestId('obliquity-peak')).toHaveTextContent('12')
  })

  it('o botão "ir para o pico" aciona onSeek com o tempo do pico', () => {
    const onSeek = vi.fn()
    render(<TrendelenburgPanel obliquity={obliquity} currentTimeMs={0} onSeek={onSeek} />)
    fireEvent.click(screen.getByRole('button', { name: /pico/i }))
    expect(onSeek).toHaveBeenCalledWith(100)
  })
})
```

- [ ] **Step 2: Correr para confirmar que falha**

Run: `npx vitest run src/components/TrendelenburgPanel.test.tsx`
Expected: FAIL — componente não existe.

- [ ] **Step 3: Implementar**

Criar `src/components/TrendelenburgPanel.tsx`:
```tsx
import type { PelvicObliquity } from '../types'

const deg = (v: number | null): string => (v === null ? '—' : `${Math.round(v)}°`)

function nearestAngle(o: PelvicObliquity, timeMs: number): number | null {
  if (!o.series.length) return null
  let best = o.series[0]
  let bestDelta = Infinity
  for (const s of o.series) {
    const d = Math.abs(s.timeMs - timeMs)
    if (d < bestDelta) {
      bestDelta = d
      best = s
    }
  }
  return best.angleDeg
}

export function TrendelenburgPanel({
  obliquity,
  currentTimeMs,
  onSeek,
}: {
  obliquity: PelvicObliquity
  currentTimeMs: number
  onSeek: (timeMs: number) => void
}) {
  const current = nearestAngle(obliquity, currentTimeMs)
  return (
    <div className="trendelenburg">
      <h3>Trendelenburg (obliquidade pélvica)</h3>
      <p className="pedagogical-notice" role="note">
        Para o Trendelenburg, filme de frente (vista coronal) o doente a caminhar na sua direção.
      </p>
      <p>
        Obliquidade no frame: <strong data-testid="obliquity-current">{deg(current)}</strong>
      </p>
      <p>
        Pico no clip: <strong data-testid="obliquity-peak">{deg(obliquity.peakDeg)}</strong>{' '}
        {obliquity.peakTimeMs !== null && (
          <button onClick={() => onSeek(obliquity.peakTimeMs as number)}>ir para o pico</button>
        )}
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Correr para confirmar que passa**

Run: `npx vitest run src/components/TrendelenburgPanel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/TrendelenburgPanel.tsx src/components/TrendelenburgPanel.test.tsx
git commit -m "feat: add Trendelenburg panel with assisted obliquity reading"
```

---

## Task 7: Linha da pélvis no SkeletonOverlay

**Files:**
- Modify: `src/components/SkeletonOverlay.tsx`

Desenha a linha das ancas (23–24) num estilo distinto (roxo, mais grossa) para a leitura da obliquidade, removendo-a da lista genérica de ossos `center` para não a desenhar duas vezes. Sem teste unitário (canvas não é testável em jsdom); validado por `tsc` e manualmente.

- [ ] **Step 1: Remover a pélvis dos ossos genéricos**

Em `src/components/SkeletonOverlay.tsx`, na constante `BONES`, remover a linha:
```ts
  { a: 23, b: 24, side: 'center' },
```
(Manter `{ a: 11, b: 12, side: 'center' }` — os ombros.)

- [ ] **Step 2: Desenhar a linha da pélvis distinta**

Em `src/components/SkeletonOverlay.tsx`, a seguir ao bloco `for (const bone of BONES) { ... }` e antes do desenho dos pontos (`ctx.fillStyle = '#ffffff'`), inserir:
```ts
    // Linha da pélvis (obliquidade) — estilo distinto para o Trendelenburg.
    const hipL = frame[23]
    const hipR = frame[24]
    if (hipL.visibility >= MIN_VIS && hipR.visibility >= MIN_VIS) {
      ctx.strokeStyle = '#9b59b6'
      ctx.lineWidth = 6
      ctx.beginPath()
      ctx.moveTo(hipL.x * width, hipL.y * height)
      ctx.lineTo(hipR.x * width, hipR.y * height)
      ctx.stroke()
      ctx.lineWidth = 4
    }
```

- [ ] **Step 3: Verificar compilação**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/components/SkeletonOverlay.tsx
git commit -m "feat: draw distinct pelvis line for obliquity reading"
```

---

## Task 8: Integrar no ClipReviewer

**Files:**
- Modify: `src/components/ClipReviewer.tsx`

- [ ] **Step 1: Adicionar imports**

Em `src/components/ClipReviewer.tsx`, juntar aos imports existentes:
```tsx
import { assessAntalgic, computeRom, pelvicObliquitySeries } from '../lib/compensation'
import { CompensationPanel } from './CompensationPanel'
import { TrendelenburgPanel } from './TrendelenburgPanel'
```

- [ ] **Step 2: Calcular os dados memoizados**

A seguir à linha `const metrics = useMemo(() => computeMetrics(events, operated), [events, operated])`, adicionar:
```tsx
  const antalgic = useMemo(() => assessAntalgic(metrics), [metrics])
  const rom = useMemo(() => computeRom(clip.frames), [clip])
  const obliquity = useMemo(() => pelvicObliquitySeries(clip.frames), [clip])
```

- [ ] **Step 3: Adicionar a função de salto no tempo**

A seguir à função `seek`, adicionar:
```tsx
  const seekTo = (timeMs: number) => {
    if (videoRef.current) videoRef.current.currentTime = timeMs / 1000
  }
```

- [ ] **Step 4: Renderizar os painéis**

Em `src/components/ClipReviewer.tsx`, a seguir a `<GaitMetricsPanel metrics={metrics} />`, adicionar:
```tsx
      <CompensationPanel antalgic={antalgic} rom={rom} operatedSide={operated} />
      <TrendelenburgPanel obliquity={obliquity} currentTimeMs={timeMs} onSeek={seekTo} />
```

- [ ] **Step 5: Verificar compilação e testes**

Run: `npx tsc --noEmit && npm test`
Expected: sem erros de tipos; todos os testes passam.

- [ ] **Step 6: Commit**

```bash
git add src/components/ClipReviewer.tsx
git commit -m "feat: integrate compensation and Trendelenburg panels into ClipReviewer"
```

---

## Task 9: Estilos

**Files:**
- Modify: `src/index.css` (acrescentar ao fim)

- [ ] **Step 1: Acrescentar estilos**

Adicionar ao fim de `src/index.css`:
```css
.compensation,
.trendelenburg {
  margin-top: 1.25rem;
}

.compensation h3,
.trendelenburg h3 {
  margin-bottom: 0.4rem;
  font-size: 1rem;
}

.antalgic-flagged {
  background: #f8d7da;
  color: #842029;
  border: 1px solid #f1aeb5;
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
}

.antalgic-ok {
  color: #0f5132;
}

.rom-reduced {
  background: #f8d7da;
  font-weight: bold;
}
```

- [ ] **Step 2: Verificar o build**

Run: `npm run build`
Expected: build sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "style: add styling for compensation and Trendelenburg panels"
```

---

## Task 10: Validação manual (checklist)

Sem código. Correr `npm run dev` e confirmar:

- [ ] **Antálgica (clip sagital):** com um clip com passos e o lado operado marcado, o veredito antálgico aparece; se o apoio operado for menor e a simetria ≥ 10%, fica destacado.
- [ ] **ROM (clip sagital):** a tabela mostra a amplitude da anca e do joelho por lado; valores abaixo do limiar ficam destacados.
- [ ] **Trendelenburg (clip coronal):** grava-se uma passagem de frente; a linha roxa da pélvis inclina no apoio unipodal; a obliquidade do frame atualiza ao fazer scrub; o pico e o "ir para o pico" funcionam.
- [ ] **Não avaliável:** um clip sem passos mostra "Não avaliável" na antálgica em vez de veredito falso.
- [ ] **Notas de enquadramento:** a nota de vista coronal aparece no painel de Trendelenburg.

Registar problemas como tarefas de correção antes de concluir C.

---

## Notas de verificação do plano (self-review)

- **Cobertura da spec:** antálgica (Task 2), ROM anca/joelho + limiares (Task 3), obliquidade pélvica + pico (Task 4), painel antálgica/ROM com destaque (Task 5), painel Trendelenburg + "ir para o pico" (Task 6), linha da pélvis no esqueleto (Task 7), integração com `operatedSide` partilhado e `seekTo` (Task 8), estilos (Task 9). ✔️
- **Consistência de tipos:** `AntalgicAssessment`, `JointRom`, `RomResult`, `ObliquitySample`, `PelvicObliquity` definidos na Task 1 e usados coerentemente; `assessAntalgic(metrics)`, `computeRom(frames)`, `pelvicObliquitySeries(frames)` (Tasks 2-4) usados na Task 8; `CompensationPanel` props `{antalgic, rom, operatedSide}` (Task 5) e `TrendelenburgPanel` props `{obliquity, currentTimeMs, onSeek}` (Task 6) usados na Task 8. Limiares `HIP_ROM_MIN_DEG`/`KNEE_ROM_MIN_DEG` introduzidos na Task 2 e usados na Task 3 (mesmo ficheiro). ✔️
- **Fora de âmbito (não incluído):** deteção automática de apoio unipodal, normas clínicas reais, gestão de múltiplos clips. ✔️
