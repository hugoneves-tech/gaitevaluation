# Análise de Marcha (MVP) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App web no browser que deteta as articulações a partir de câmara ao vivo ou clip gravado e mostra o esqueleto sobreposto com os ângulos anca/joelho/tornozelo em tempo real, mais um modo de revisão quadro-a-quadro em câmara lenta.

**Architecture:** SPA React 100% client-side (sem backend). MediaPipe Pose Landmarker devolve 33 landmarks por frame; funções puras (`angles.ts`, `smoothing.ts`) calculam e suavizam ângulos; um Canvas desenha o esqueleto sobre o `<video>`. Modo "Ao Vivo" processa a câmara em tempo real; modo "Rever" reproduz um clip gravado com os landmarks guardados frame-a-frame.

**Tech Stack:** React 18, Vite, TypeScript, @mediapipe/tasks-vision, Vitest, React Testing Library, MediaRecorder API, Canvas 2D.

---

## Estrutura de ficheiros

```
src/
  types.ts                 # Tipos partilhados: Landmark, PoseFrame, JointAngles, RecordedClip
  lib/
    angles.ts              # PURO: cálculo de ângulos a partir de landmarks
    smoothing.ts           # PURO: filtro exponencial de suavização
    angles.test.ts
    smoothing.test.ts
  hooks/
    usePoseEngine.ts       # Carrega MediaPipe, processa frames -> landmarks
    useClipRecorder.ts     # Grava clip (MediaRecorder) + landmarks em paralelo
  components/
    CameraView.tsx         # <video> ao vivo ou clip
    SkeletonOverlay.tsx    # <canvas> desenha esqueleto + arcos de ângulo
    AnglePanel.tsx         # valores numéricos (esq/dir), "—" se baixa visibilidade
    AnglePanel.test.tsx
    ClipReviewer.tsx       # revisão com scrub, frame-a-frame, câmara lenta
    PedagogicalNotice.tsx  # aviso permanente sobre limitações 2D
  App.tsx                  # alterna Ao Vivo / Rever, orquestra tudo
  App.test.tsx
  main.tsx
  index.css
index.html
vite.config.ts
tsconfig.json
package.json
```

**Constante de landmarks (MediaPipe Pose, índices):** ombro 11(E)/12(D), anca 23(E)/24(D), joelho 25(E)/26(D), tornozelo 27(E)/28(D), pé (foot_index) 31(E)/32(D). Estes índices são usados em `angles.ts`.

---

## Task 1: Scaffold do projeto Vite + React + TS

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`

- [ ] **Step 1: Criar o projeto com o template oficial**

Run (na raiz `C:\Users\hugoneves\App movimento`):
```bash
npm create vite@latest . -- --template react-ts
```
Se a pasta não estiver vazia, escolher "Ignore files and continue". Isto cria `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`.

- [ ] **Step 2: Instalar dependências (base + pose + testes)**

Run:
```bash
npm install
npm install @mediapipe/tasks-vision
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitest/coverage-v8
```

- [ ] **Step 3: Configurar Vitest no `vite.config.ts`**

Substituir o conteúdo de `vite.config.ts` por:
```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
  },
})
```

Criar `src/setupTests.ts`:
```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 4: Adicionar o script de teste ao `package.json`**

No `package.json`, dentro de `"scripts"`, adicionar:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Verificar que o build e o dev server arrancam**

Run:
```bash
npm run build
```
Expected: build termina sem erros de TypeScript.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TS project with Vitest"
```

---

## Task 2: Tipos partilhados

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Definir os tipos**

Criar `src/types.ts`:
```ts
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
```

- [ ] **Step 2: Verificar compilação**

Run:
```bash
npx tsc --noEmit
```
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add shared types for landmarks and angles"
```

---

## Task 3: Cálculo de ângulos (lógica pura, TDD)

**Files:**
- Create: `src/lib/angles.ts`
- Test: `src/lib/angles.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/lib/angles.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { angleBetween, computeAngles } from './angles'
import type { Landmark, PoseFrame } from '../types'

const P = (x: number, y: number, visibility = 1): Landmark => ({ x, y, z: 0, visibility })

describe('angleBetween', () => {
  it('devolve 180 para três pontos colineares (perna reta)', () => {
    const a = P(0, 0), b = P(0, 1), c = P(0, 2)
    expect(angleBetween(a, b, c)).toBeCloseTo(180, 1)
  })

  it('devolve 90 para um ângulo reto', () => {
    const a = P(0, 0), b = P(0, 1), c = P(1, 1)
    expect(angleBetween(a, b, c)).toBeCloseTo(90, 1)
  })

  it('devolve 45 para meio ângulo reto', () => {
    const a = P(0, 0), b = P(0, 1), c = P(1, 2)
    expect(angleBetween(a, b, c)).toBeCloseTo(45, 1)
  })
})

describe('computeAngles', () => {
  // Constrói um frame de 33 landmarks todos em (0,0) e preenche os índices necessários.
  const buildFrame = (overrides: Record<number, Landmark>): PoseFrame => {
    const frame: PoseFrame = Array.from({ length: 33 }, () => P(0, 0))
    for (const [i, lm] of Object.entries(overrides)) frame[Number(i)] = lm
    return frame
  }

  it('calcula o joelho esquerdo como 180 quando anca-joelho-tornozelo estão alinhados', () => {
    const frame = buildFrame({
      23: P(0, 0), // anca E
      25: P(0, 1), // joelho E
      27: P(0, 2), // tornozelo E
    })
    const angles = computeAngles(frame, 0.5)
    expect(angles.knee.left).toBeCloseTo(180, 1)
  })

  it('devolve null para uma articulação com baixa visibilidade', () => {
    const frame = buildFrame({
      23: P(0, 0, 0.1), // anca E com visibilidade baixa
      25: P(0, 1, 1),
      27: P(0, 2, 1),
    })
    const angles = computeAngles(frame, 0.5)
    expect(angles.knee.left).toBeNull()
  })
})
```

- [ ] **Step 2: Correr os testes para confirmar que falham**

Run:
```bash
npx vitest run src/lib/angles.test.ts
```
Expected: FAIL — `angleBetween`/`computeAngles` não existem.

- [ ] **Step 3: Implementar `angles.ts`**

Criar `src/lib/angles.ts`:
```ts
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
```

- [ ] **Step 4: Correr os testes para confirmar que passam**

Run:
```bash
npx vitest run src/lib/angles.test.ts
```
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/angles.ts src/lib/angles.test.ts
git commit -m "feat: add pure joint angle computation with visibility gating"
```

---

## Task 4: Suavização dos ângulos (lógica pura, TDD)

**Files:**
- Create: `src/lib/smoothing.ts`
- Test: `src/lib/smoothing.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/lib/smoothing.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { createAngleSmoother } from './smoothing'

describe('createAngleSmoother', () => {
  it('devolve o primeiro valor tal como entra', () => {
    const s = createAngleSmoother(0.5)
    expect(s(100)).toBe(100)
  })

  it('aplica o filtro exponencial: novo = alpha*valor + (1-alpha)*anterior', () => {
    const s = createAngleSmoother(0.5)
    s(100)
    expect(s(200)).toBeCloseTo(150, 5) // 0.5*200 + 0.5*100
  })

  it('propaga null sem alterar o estado anterior', () => {
    const s = createAngleSmoother(0.5)
    s(100)
    expect(s(null)).toBeNull()
    expect(s(200)).toBeCloseTo(150, 5) // estado anterior ainda é 100
  })
})
```

- [ ] **Step 2: Correr os testes para confirmar que falham**

Run:
```bash
npx vitest run src/lib/smoothing.test.ts
```
Expected: FAIL — `createAngleSmoother` não existe.

- [ ] **Step 3: Implementar `smoothing.ts`**

Criar `src/lib/smoothing.ts`:
```ts
import type { AngleValue } from '../types'

/**
 * Cria um filtro exponencial com memória para um único ângulo.
 * @param alpha peso do valor novo (0..1). Maior = menos suavização.
 * @returns função que recebe o valor atual e devolve o valor suavizado.
 *          null é propagado e não altera o estado.
 */
export function createAngleSmoother(alpha: number): (value: AngleValue) => AngleValue {
  let previous: number | null = null
  return (value: AngleValue): AngleValue => {
    if (value === null) return null
    if (previous === null) {
      previous = value
      return value
    }
    previous = alpha * value + (1 - alpha) * previous
    return previous
  }
}
```

- [ ] **Step 4: Correr os testes para confirmar que passam**

Run:
```bash
npx vitest run src/lib/smoothing.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/smoothing.ts src/lib/smoothing.test.ts
git commit -m "feat: add exponential angle smoother"
```

---

## Task 5: Painel de ângulos (componente, TDD)

**Files:**
- Create: `src/components/AnglePanel.tsx`
- Test: `src/components/AnglePanel.test.tsx`

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/components/AnglePanel.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AnglePanel } from './AnglePanel'
import type { JointAngles } from '../types'

const angles: JointAngles = {
  hip: { left: 170.4, right: 168.9 },
  knee: { left: 155.2, right: null },
  ankle: { left: 90.0, right: 92.1 },
}

describe('AnglePanel', () => {
  it('mostra os ângulos arredondados a inteiro com o símbolo de grau', () => {
    render(<AnglePanel angles={angles} />)
    expect(screen.getByText('170°')).toBeInTheDocument()
    expect(screen.getByText('155°')).toBeInTheDocument()
  })

  it('mostra "—" quando o ângulo é null (baixa visibilidade)', () => {
    render(<AnglePanel angles={angles} />)
    expect(screen.getByTestId('knee-right')).toHaveTextContent('—')
  })
})
```

- [ ] **Step 2: Correr os testes para confirmar que falham**

Run:
```bash
npx vitest run src/components/AnglePanel.test.tsx
```
Expected: FAIL — `AnglePanel` não existe.

- [ ] **Step 3: Implementar `AnglePanel.tsx`**

Criar `src/components/AnglePanel.tsx`:
```tsx
import type { JointAngles, AngleValue } from '../types'

const fmt = (v: AngleValue): string => (v === null ? '—' : `${Math.round(v)}°`)

const joints: { key: keyof JointAngles; label: string }[] = [
  { key: 'hip', label: 'Anca' },
  { key: 'knee', label: 'Joelho' },
  { key: 'ankle', label: 'Tornozelo' },
]

export function AnglePanel({ angles }: { angles: JointAngles }) {
  return (
    <table className="angle-panel">
      <thead>
        <tr>
          <th>Articulação</th>
          <th>Esq.</th>
          <th>Dir.</th>
        </tr>
      </thead>
      <tbody>
        {joints.map(({ key, label }) => (
          <tr key={key}>
            <td>{label}</td>
            <td data-testid={`${key}-left`}>{fmt(angles[key].left)}</td>
            <td data-testid={`${key}-right`}>{fmt(angles[key].right)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 4: Correr os testes para confirmar que passam**

Run:
```bash
npx vitest run src/components/AnglePanel.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/AnglePanel.tsx src/components/AnglePanel.test.tsx
git commit -m "feat: add AnglePanel with graceful low-visibility display"
```

---

## Task 6: Aviso pedagógico

**Files:**
- Create: `src/components/PedagogicalNotice.tsx`

- [ ] **Step 1: Implementar o componente**

Criar `src/components/PedagogicalNotice.tsx`:
```tsx
export function PedagogicalNotice() {
  return (
    <p className="pedagogical-notice" role="note">
      ⚠️ Medições 2D no plano sagital — aproximações para fins de ensino,
      não para decisão clínica.
    </p>
  )
}
```

- [ ] **Step 2: Verificar compilação**

Run:
```bash
npx tsc --noEmit
```
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/PedagogicalNotice.tsx
git commit -m "feat: add permanent pedagogical notice"
```

---

## Task 7: Motor de pose (hook)

**Files:**
- Create: `src/hooks/usePoseEngine.ts`

Nota: este hook envolve o MediaPipe, que depende de WebGL/câmara — validado manualmente, não por teste automático.

- [ ] **Step 1: Implementar o hook**

Criar `src/hooks/usePoseEngine.ts`:
```ts
import { useEffect, useRef, useState } from 'react'
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'
import type { PoseFrame } from '../types'

const WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task'

/**
 * Carrega o PoseLandmarker uma vez e expõe uma função `detect`
 * que recebe um elemento de vídeo + timestamp e devolve os landmarks.
 */
export function usePoseEngine() {
  const landmarkerRef = useRef<PoseLandmarker | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const fileset = await FilesetResolver.forVisionTasks(WASM_URL)
        const landmarker = await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numPoses: 1,
        })
        if (cancelled) return
        landmarkerRef.current = landmarker
        setReady(true)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
      landmarkerRef.current?.close()
    }
  }, [])

  /** Deteta a pose num frame de vídeo. Devolve os 33 landmarks ou null. */
  const detect = (video: HTMLVideoElement, timestampMs: number): PoseFrame | null => {
    const landmarker = landmarkerRef.current
    if (!landmarker) return null
    const result = landmarker.detectForVideo(video, timestampMs)
    const first = result.landmarks?.[0]
    if (!first) return null
    return first.map((p) => ({
      x: p.x,
      y: p.y,
      z: p.z,
      visibility: p.visibility ?? 0,
    }))
  }

  return { ready, error, detect }
}
```

- [ ] **Step 2: Verificar compilação**

Run:
```bash
npx tsc --noEmit
```
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/usePoseEngine.ts
git commit -m "feat: add MediaPipe pose engine hook"
```

---

## Task 8: Overlay do esqueleto (Canvas)

**Files:**
- Create: `src/components/SkeletonOverlay.tsx`

- [ ] **Step 1: Implementar o componente**

Criar `src/components/SkeletonOverlay.tsx`. Desenha ossos entre pares de landmarks; membros esquerdos e direitos com cores distintas.
```tsx
import { useEffect, useRef } from 'react'
import type { PoseFrame } from '../types'

// Pares de landmarks a ligar (ossos principais para marcha).
const BONES: { a: number; b: number; side: 'left' | 'right' | 'center' }[] = [
  { a: 11, b: 23, side: 'left' },  // ombro-anca E
  { a: 23, b: 25, side: 'left' },  // anca-joelho E
  { a: 25, b: 27, side: 'left' },  // joelho-tornozelo E
  { a: 27, b: 31, side: 'left' },  // tornozelo-pé E
  { a: 12, b: 24, side: 'right' },
  { a: 24, b: 26, side: 'right' },
  { a: 26, b: 28, side: 'right' },
  { a: 28, b: 32, side: 'right' },
  { a: 11, b: 12, side: 'center' }, // ombros
  { a: 23, b: 24, side: 'center' }, // ancas
]

const COLORS = { left: '#2ecc71', right: '#e74c3c', center: '#3498db' }
const MIN_VIS = 0.5

export function SkeletonOverlay({
  frame,
  width,
  height,
}: {
  frame: PoseFrame | null
  width: number
  height: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, width, height)
    if (!frame) return

    ctx.lineWidth = 4
    for (const bone of BONES) {
      const a = frame[bone.a]
      const b = frame[bone.b]
      if (a.visibility < MIN_VIS || b.visibility < MIN_VIS) continue
      ctx.strokeStyle = COLORS[bone.side]
      ctx.beginPath()
      ctx.moveTo(a.x * width, a.y * height)
      ctx.lineTo(b.x * width, b.y * height)
      ctx.stroke()
    }

    // Pontos das articulações.
    ctx.fillStyle = '#ffffff'
    for (const idx of [11, 12, 23, 24, 25, 26, 27, 28, 31, 32]) {
      const p = frame[idx]
      if (p.visibility < MIN_VIS) continue
      ctx.beginPath()
      ctx.arc(p.x * width, p.y * height, 5, 0, Math.PI * 2)
      ctx.fill()
    }
  }, [frame, width, height])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ position: 'absolute', top: 0, left: 0 }}
    />
  )
}
```

- [ ] **Step 2: Verificar compilação**

Run:
```bash
npx tsc --noEmit
```
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/SkeletonOverlay.tsx
git commit -m "feat: add skeleton overlay canvas"
```

---

## Task 9: Vista de câmara

**Files:**
- Create: `src/components/CameraView.tsx`

- [ ] **Step 1: Implementar o componente**

Criar `src/components/CameraView.tsx`. Expõe o `<video>` via ref para o motor de pose o processar; trata erros de permissão/câmara.
```tsx
import { forwardRef, useEffect, useState } from 'react'

interface CameraViewProps {
  width: number
  height: number
  onError: (message: string) => void
}

export const CameraView = forwardRef<HTMLVideoElement, CameraViewProps>(
  function CameraView({ width, height, onError }, ref) {
    const [streaming, setStreaming] = useState(false)

    useEffect(() => {
      let stream: MediaStream | null = null
      ;(async () => {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width, height },
            audio: false,
          })
          const video = (ref as React.RefObject<HTMLVideoElement>).current
          if (video) {
            video.srcObject = stream
            await video.play()
            setStreaming(true)
          }
        } catch (e) {
          onError(
            e instanceof DOMException && e.name === 'NotAllowedError'
              ? 'Permissão de câmara negada. Autorize o acesso ou carregue um vídeo.'
              : 'Câmara indisponível. Carregue um ficheiro de vídeo em alternativa.',
          )
        }
      })()
      return () => {
        stream?.getTracks().forEach((t) => t.stop())
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [width, height])

    return (
      <video
        ref={ref}
        width={width}
        height={height}
        playsInline
        muted
        style={{ display: streaming ? 'block' : 'none' }}
      />
    )
  },
)
```

- [ ] **Step 2: Verificar compilação**

Run:
```bash
npx tsc --noEmit
```
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/CameraView.tsx
git commit -m "feat: add camera view with permission error handling"
```

---

## Task 10: Gravador de clip (hook)

**Files:**
- Create: `src/hooks/useClipRecorder.ts`

- [ ] **Step 1: Implementar o hook**

Criar `src/hooks/useClipRecorder.ts`. Grava o vídeo via MediaRecorder e acumula os landmarks calculados durante a gravação, com timestamps relativos.
```ts
import { useRef, useState } from 'react'
import type { PoseFrame, RecordedClip, RecordedFrame } from '../types'

export function useClipRecorder() {
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const framesRef = useRef<RecordedFrame[]>([])
  const startTimeRef = useRef<number>(0)
  const [recording, setRecording] = useState(false)
  const [clip, setClip] = useState<RecordedClip | null>(null)

  const start = (stream: MediaStream) => {
    chunksRef.current = []
    framesRef.current = []
    startTimeRef.current = performance.now()
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' })
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' })
      setClip({
        videoUrl: URL.createObjectURL(blob),
        frames: framesRef.current,
      })
    }
    recorder.start()
    recorderRef.current = recorder
    setRecording(true)
  }

  /** Chamado a cada frame processado enquanto grava, para guardar os landmarks. */
  const captureFrame = (landmarks: PoseFrame) => {
    if (!recording) return
    framesRef.current.push({
      timeMs: performance.now() - startTimeRef.current,
      landmarks,
    })
  }

  const stop = () => {
    recorderRef.current?.stop()
    setRecording(false)
  }

  return { recording, clip, start, stop, captureFrame }
}
```

- [ ] **Step 2: Verificar compilação**

Run:
```bash
npx tsc --noEmit
```
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useClipRecorder.ts
git commit -m "feat: add clip recorder hook capturing synced landmarks"
```

---

## Task 11: Revisor de clip

**Files:**
- Create: `src/components/ClipReviewer.tsx`

- [ ] **Step 1: Implementar o componente**

Criar `src/components/ClipReviewer.tsx`. Reproduz o clip com scrub, câmara lenta e avanço frame-a-frame; escolhe o `RecordedFrame` mais próximo do tempo atual do vídeo e mostra esqueleto + ângulos.
```tsx
import { useMemo, useRef, useState } from 'react'
import type { RecordedClip } from '../types'
import { computeAngles } from '../lib/angles'
import { SkeletonOverlay } from './SkeletonOverlay'
import { AnglePanel } from './AnglePanel'

const WIDTH = 640
const HEIGHT = 480
const STEP_MS = 1000 / 30 // um frame a 30 fps

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

  const frame = useMemo(
    () => (clip.frames.length ? nearestFrame(clip, timeMs) : null),
    [clip, timeMs],
  )
  const angles = useMemo(
    () => (frame ? computeAngles(frame.landmarks, 0.5) : null),
    [frame],
  )

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

      <div className="controls">
        <button onClick={() => seek(-STEP_MS)}>◀ Frame</button>
        <button onClick={() => seek(STEP_MS)}>Frame ▶</button>
        <button onClick={() => setRate(0.25)}>0.25×</button>
        <button onClick={() => setRate(0.5)}>0.5×</button>
        <button onClick={() => setRate(1)}>1×</button>
      </div>

      {angles && <AnglePanel angles={angles} />}
    </div>
  )
}
```

- [ ] **Step 2: Verificar compilação**

Run:
```bash
npx tsc --noEmit
```
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/ClipReviewer.tsx
git commit -m "feat: add clip reviewer with frame stepping and slow motion"
```

---

## Task 12: App — orquestração e modos (com teste de alternância)

**Files:**
- Modify: `src/App.tsx` (substituir o conteúdo gerado pelo scaffold)
- Create: `src/App.test.tsx`

- [ ] **Step 1: Escrever o teste de alternância de modo**

Criar `src/App.test.tsx`. Testa apenas a lógica de UI de alternância (o motor de pose e a câmara são mockados para não dependerem de hardware).
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import App from './App'

// Mock do motor de pose e câmara (dependem de WebGL/hardware).
vi.mock('./hooks/usePoseEngine', () => ({
  usePoseEngine: () => ({ ready: true, error: null, detect: () => null }),
}))
vi.mock('./components/CameraView', () => ({
  CameraView: () => <div data-testid="camera-view" />,
}))

describe('App', () => {
  it('começa no modo Ao Vivo', () => {
    render(<App />)
    expect(screen.getByTestId('camera-view')).toBeInTheDocument()
  })

  it('mostra sempre o aviso pedagógico', () => {
    render(<App />)
    expect(screen.getByRole('note')).toHaveTextContent(/fins de ensino/i)
  })

  it('alterna para o modo Rever quando não há clip mostra aviso', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /rever/i }))
    expect(screen.getByText(/grave um clip primeiro/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Correr o teste para confirmar que falha**

Run:
```bash
npx vitest run src/App.test.tsx
```
Expected: FAIL — o `App` do scaffold não tem estes elementos.

- [ ] **Step 3: Implementar `App.tsx`**

Substituir todo o conteúdo de `src/App.tsx` por:
```tsx
import { useEffect, useRef, useState } from 'react'
import { usePoseEngine } from './hooks/usePoseEngine'
import { useClipRecorder } from './hooks/useClipRecorder'
import { CameraView } from './components/CameraView'
import { SkeletonOverlay } from './components/SkeletonOverlay'
import { AnglePanel } from './components/AnglePanel'
import { ClipReviewer } from './components/ClipReviewer'
import { PedagogicalNotice } from './components/PedagogicalNotice'
import { computeAngles } from './lib/angles'
import { createAngleSmoother } from './lib/smoothing'
import type { JointAngles, PoseFrame } from './types'
import './index.css'

const WIDTH = 640
const HEIGHT = 480
const MIN_VIS = 0.5

type Mode = 'live' | 'review'

const emptyAngles: JointAngles = {
  hip: { left: null, right: null },
  knee: { left: null, right: null },
  ankle: { left: null, right: null },
}

export default function App() {
  const [mode, setMode] = useState<Mode>('live')
  const [error, setError] = useState<string | null>(null)
  const [frame, setFrame] = useState<PoseFrame | null>(null)
  const [angles, setAngles] = useState<JointAngles>(emptyAngles)

  const videoRef = useRef<HTMLVideoElement>(null)
  const rafRef = useRef<number>(0)
  const { ready, error: engineError, detect } = usePoseEngine()
  const { recording, clip, start, stop, captureFrame } = useClipRecorder()

  // Suavizadores por articulação/lado (persistem entre frames).
  const smoothers = useRef({
    hipL: createAngleSmoother(0.4), hipR: createAngleSmoother(0.4),
    kneeL: createAngleSmoother(0.4), kneeR: createAngleSmoother(0.4),
    ankleL: createAngleSmoother(0.4), ankleR: createAngleSmoother(0.4),
  })

  // Loop de deteção no modo Ao Vivo.
  useEffect(() => {
    if (mode !== 'live' || !ready) return
    let running = true
    const tick = () => {
      if (!running) return
      const video = videoRef.current
      if (video && video.readyState >= 2) {
        const lm = detect(video, performance.now())
        setFrame(lm)
        if (lm) {
          const raw = computeAngles(lm, MIN_VIS)
          const s = smoothers.current
          setAngles({
            hip: { left: s.hipL(raw.hip.left), right: s.hipR(raw.hip.right) },
            knee: { left: s.kneeL(raw.knee.left), right: s.kneeR(raw.knee.right) },
            ankle: { left: s.ankleL(raw.ankle.left), right: s.ankleR(raw.ankle.right) },
          })
          if (recording) captureFrame(lm)
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      running = false
      cancelAnimationFrame(rafRef.current)
    }
  }, [mode, ready, detect, recording, captureFrame])

  const toggleRecording = () => {
    const video = videoRef.current
    if (!video?.srcObject) return
    if (recording) stop()
    else start(video.srcObject as MediaStream)
  }

  const displayError = error ?? engineError

  return (
    <main className="app">
      <h1>Análise de Marcha — Ferramenta Pedagógica</h1>
      <PedagogicalNotice />

      <nav className="mode-tabs">
        <button
          aria-pressed={mode === 'live'}
          onClick={() => setMode('live')}
        >
          Ao Vivo
        </button>
        <button
          aria-pressed={mode === 'review'}
          onClick={() => setMode('review')}
        >
          Rever
        </button>
      </nav>

      {displayError && <p className="error">{displayError}</p>}
      {!ready && mode === 'live' && <p>A carregar o modelo de pose…</p>}

      {mode === 'live' && (
        <>
          <div style={{ position: 'relative', width: WIDTH, height: HEIGHT }}>
            <CameraView ref={videoRef} width={WIDTH} height={HEIGHT} onError={setError} />
            <SkeletonOverlay frame={frame} width={WIDTH} height={HEIGHT} />
          </div>
          <button onClick={toggleRecording}>
            {recording ? '■ Parar gravação' : '● Gravar clip'}
          </button>
          <AnglePanel angles={angles} />
        </>
      )}

      {mode === 'review' && (
        clip
          ? <ClipReviewer clip={clip} />
          : <p>Grave um clip primeiro no modo Ao Vivo.</p>
      )}
    </main>
  )
}
```

- [ ] **Step 4: Correr o teste para confirmar que passa**

Run:
```bash
npx vitest run src/App.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Correr a suite completa**

Run:
```bash
npm test
```
Expected: todos os testes passam.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: wire up App with live and review modes"
```

---

## Task 13: Estilos e retoques finais

**Files:**
- Modify: `src/index.css` (substituir conteúdo)

- [ ] **Step 1: Escrever os estilos**

Substituir `src/index.css` por:
```css
:root {
  font-family: system-ui, sans-serif;
  color-scheme: light dark;
}

.app {
  max-width: 720px;
  margin: 0 auto;
  padding: 1rem;
}

.pedagogical-notice {
  background: #fff3cd;
  color: #664d03;
  border: 1px solid #ffe69c;
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  font-size: 0.9rem;
}

.mode-tabs button,
.controls button {
  margin-right: 0.5rem;
  padding: 0.4rem 0.9rem;
  cursor: pointer;
}

.mode-tabs button[aria-pressed='true'] {
  font-weight: bold;
  border-bottom: 2px solid #3498db;
}

.error {
  color: #b02a37;
  background: #f8d7da;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
}

.angle-panel {
  margin-top: 1rem;
  border-collapse: collapse;
  min-width: 260px;
}

.angle-panel th,
.angle-panel td {
  border: 1px solid #ccc;
  padding: 0.35rem 0.75rem;
  text-align: center;
}

.controls {
  margin-top: 0.5rem;
}
```

- [ ] **Step 2: Verificar o build de produção**

Run:
```bash
npm run build
```
Expected: build sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "style: add app styling"
```

---

## Task 14: Validação manual (checklist)

Não há passos de código. Correr `npm run dev`, abrir o URL local e confirmar:

- [ ] **Câmara:** com permissão concedida, o vídeo ao vivo aparece e o esqueleto sobrepõe-se ao corpo.
- [ ] **Ângulos ao vivo:** ao ficar de lado (plano sagital) e dobrar o joelho, o valor do joelho desce abaixo de 180° de forma suave (sem tremor excessivo).
- [ ] **Baixa visibilidade:** ao sair parcialmente do enquadramento, os ângulos afetados mostram "—" em vez de valores errados.
- [ ] **Permissão negada:** ao recusar a câmara, aparece a mensagem de erro clara.
- [ ] **Gravar:** "Gravar clip" grava alguns segundos; "Parar" termina sem erros.
- [ ] **Rever:** o separador "Rever" mostra o clip; os botões de frame-a-frame e câmara lenta (0.25×/0.5×) funcionam e o esqueleto acompanha o vídeo.
- [ ] **Aviso pedagógico:** está sempre visível no topo.

Registar quaisquer problemas encontrados como tarefas de correção antes de considerar o MVP concluído.

---

## Notas de verificação do plano (self-review)

- **Cobertura da spec:** arquitetura client-side (Tasks 1,7,9), MediaPipe (Task 7), ângulos anca/joelho/tornozelo esq/dir (Task 3), suavização (Task 4), esqueleto (Task 8), modo ao vivo (Task 12), gravar+rever quadro-a-quadro/câmara lenta (Tasks 10,11,12), baixa visibilidade → "—" (Tasks 3,5), erro de câmara + alternativa (Task 9), aviso pedagógico permanente (Tasks 6,12), testes unitários e de componente (Tasks 3,4,5,12). ✔️
- **Consistência de tipos:** `Landmark`, `PoseFrame`, `JointAngles`, `AngleValue`, `RecordedFrame`, `RecordedClip` definidos na Task 2 e usados coerentemente. Funções: `angleBetween`/`computeAngles` (Task 3), `createAngleSmoother` (Task 4), `detect` (Task 7), `start`/`stop`/`captureFrame`/`clip`/`recording` (Task 10) usadas com as mesmas assinaturas na Task 12. ✔️
- **Fora de âmbito (Fase 2), não incluído:** simetria/cadência, fases do ciclo, sinais de compensação. ✔️
