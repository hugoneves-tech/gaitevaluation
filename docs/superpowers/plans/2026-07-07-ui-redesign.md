# Redesenho Visual e Modo Câmara — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar a app ao estilo Google AI Studio (tema automático claro/escuro), com o vídeo como protagonista e um modo câmara em ecrã inteiro, sem alterar a lógica.

**Architecture:** Uma camada de tokens CSS (`theme.css`) alimenta componentes de apresentação novos (`AppHeader`, `ModeTabs`, `Card`, `MetricChips`, `CameraStage`) e um hook `useFullscreen`. O `App` mantém toda a lógica e passa a compor estes componentes. Os testes existentes mantêm-se verdes.

**Tech Stack:** React 18, TypeScript, Vitest, React Testing Library, CSS (variáveis + `prefers-color-scheme`), Fullscreen API.

---

## Convenções

- **Não alterar lógica.** Só apresentação. Correr `npm test` a cada tarefa — tem de ficar verde.
- Preservar todos os `data-testid` e rótulos existentes que os testes consultam
  (ex.: `camera-view`, botões "Ao Vivo"/"Rever", `role="note"`).
- Cores por lado: esquerdo `#2ecc71`, direito `#e74c3c` (via tokens `--side-left/right`).

---

## Task 1: Tokens de tema (claro/escuro)

**Files:**
- Create: `src/theme.css`
- Modify: `src/main.tsx`

- [ ] **Step 1: Criar `src/theme.css`**

```css
:root {
  --bg: #f5f6f8;
  --surface: #ffffff;
  --surface-2: #eceef1;
  --text: #1a1c1f;
  --text-muted: #6b7280;
  --accent: #2f6df6;
  --accent-contrast: #ffffff;
  --danger: #e5484d;
  --bg-danger: #fdecec;
  --success: #2e9e6b;
  --warning: #b7791f;
  --bg-warning: #fff6e6;
  --border: #e2e5ea;
  --radius: 10px;
  --radius-card: 14px;
  --shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  --side-left: #2ecc71;
  --side-right: #e74c3c;
  color-scheme: light dark;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0f1115;
    --surface: #1a1d23;
    --surface-2: #23272f;
    --text: #e8eaed;
    --text-muted: #9aa0aa;
    --accent: #5b8cff;
    --accent-contrast: #0f1115;
    --danger: #ff6369;
    --bg-danger: #3a1e20;
    --success: #4ccf94;
    --warning: #e2b04a;
    --bg-warning: #33291a;
    --border: #2c313a;
    --shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  }
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: system-ui, sans-serif;
}
```

- [ ] **Step 2: Importar em `src/main.tsx` antes de `index.css`**

Alterar `src/main.tsx` para:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 3: Verificar build e suite**

Run: `npm run build && npm test`
Expected: build sem erros; todos os testes passam.

- [ ] **Step 4: Commit**

```bash
git add src/theme.css src/main.tsx
git commit -m "feat: add light/dark theme tokens"
```

---

## Task 2: Card (TDD)

**Files:**
- Create: `src/components/Card.tsx`
- Test: `src/components/Card.test.tsx`

- [ ] **Step 1: Escrever o teste que falha**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card } from './Card'

describe('Card', () => {
  it('mostra o título e os filhos', () => {
    render(
      <Card title="Métricas">
        <p>conteúdo</p>
      </Card>,
    )
    expect(screen.getByRole('heading', { name: 'Métricas' })).toBeInTheDocument()
    expect(screen.getByText('conteúdo')).toBeInTheDocument()
  })

  it('sem título não renderiza cabeçalho', () => {
    render(<Card><p>só isto</p></Card>)
    expect(screen.queryByRole('heading')).toBeNull()
  })
})
```

- [ ] **Step 2: Correr para confirmar que falha**

Run: `npx vitest run src/components/Card.test.tsx`
Expected: FAIL — componente não existe.

- [ ] **Step 3: Implementar `src/components/Card.tsx`**

```tsx
import type { ReactNode } from 'react'

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="card">
      {title && <h3 className="card-title">{title}</h3>}
      {children}
    </section>
  )
}
```

- [ ] **Step 4: Correr para confirmar que passa**

Run: `npx vitest run src/components/Card.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Card.tsx src/components/Card.test.tsx
git commit -m "feat: add Card wrapper component"
```

---

## Task 3: MetricChips (TDD)

**Files:**
- Create: `src/components/MetricChips.tsx`
- Test: `src/components/MetricChips.test.tsx`

- [ ] **Step 1: Escrever o teste que falha**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MetricChips } from './MetricChips'
import type { JointAngles } from '../types'

const angles: JointAngles = {
  hip: { left: 170, right: 168 },
  knee: { left: 158, right: null },
  ankle: { left: 90, right: 92 },
}

describe('MetricChips', () => {
  it('mostra os ângulos do joelho e a cadência, com "—" para null', () => {
    render(<MetricChips angles={angles} cadence={108} />)
    expect(screen.getByTestId('chip-knee-left')).toHaveTextContent('158°')
    expect(screen.getByTestId('chip-knee-right')).toHaveTextContent('—')
    expect(screen.getByTestId('chip-cadence')).toHaveTextContent('108')
  })
})
```

- [ ] **Step 2: Correr para confirmar que falha**

Run: `npx vitest run src/components/MetricChips.test.tsx`
Expected: FAIL — componente não existe.

- [ ] **Step 3: Implementar `src/components/MetricChips.tsx`**

```tsx
import type { AngleValue, JointAngles } from '../types'

const deg = (v: AngleValue): string => (v === null ? '—' : `${Math.round(v)}°`)

export function MetricChips({
  angles,
  cadence,
}: {
  angles: JointAngles
  cadence: number | null
}) {
  return (
    <div className="metric-chips">
      <span className="chip">
        <span className="chip-label">Joelho E</span>
        <span className="chip-val side-left" data-testid="chip-knee-left">{deg(angles.knee.left)}</span>
      </span>
      <span className="chip">
        <span className="chip-label">Joelho D</span>
        <span className="chip-val side-right" data-testid="chip-knee-right">{deg(angles.knee.right)}</span>
      </span>
      <span className="chip">
        <span className="chip-label">Cadência</span>
        <span className="chip-val" data-testid="chip-cadence">{cadence === null ? '—' : Math.round(cadence)}</span>
      </span>
    </div>
  )
}
```

- [ ] **Step 4: Correr para confirmar que passa**

Run: `npx vitest run src/components/MetricChips.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/MetricChips.tsx src/components/MetricChips.test.tsx
git commit -m "feat: add metric chips overlay"
```

---

## Task 4: useFullscreen (TDD)

**Files:**
- Create: `src/hooks/useFullscreen.ts`
- Test: `src/hooks/useFullscreen.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFullscreen } from './useFullscreen'

describe('useFullscreen', () => {
  it('alterna o estado no fallback (sem Fullscreen API)', () => {
    const { result } = renderHook(() => useFullscreen<HTMLDivElement>())
    expect(result.current.isFullscreen).toBe(false)
    act(() => result.current.toggle())
    expect(result.current.isFullscreen).toBe(true)
    act(() => result.current.toggle())
    expect(result.current.isFullscreen).toBe(false)
  })

  it('chama exitFullscreen ao sair quando a API está ativa', () => {
    const exit = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(document, 'exitFullscreen', { value: exit, configurable: true })
    Object.defineProperty(document, 'fullscreenElement', { value: {}, configurable: true })
    const { result } = renderHook(() => useFullscreen<HTMLDivElement>())
    act(() => result.current.toggle()) // entra
    act(() => result.current.toggle()) // sai -> exitFullscreen
    expect(exit).toHaveBeenCalled()
    Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true })
  })
})
```

- [ ] **Step 2: Correr para confirmar que falha**

Run: `npx vitest run src/hooks/useFullscreen.test.ts`
Expected: FAIL — hook não existe.

- [ ] **Step 3: Implementar `src/hooks/useFullscreen.ts`**

```ts
import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Ecrã inteiro sobre um elemento, via Fullscreen API com fallback de estado.
 * `ref` deve ser aplicado ao contentor a expandir.
 */
export function useFullscreen<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Sincroniza quando a API sai (ex.: Esc no modo nativo).
  useEffect(() => {
    const onChange = () => {
      if (document.fullscreenElement === null) setIsFullscreen(false)
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  // No fallback, Esc também sai.
  useEffect(() => {
    if (!isFullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isFullscreen])

  const toggle = useCallback(() => {
    setIsFullscreen((prev) => {
      const next = !prev
      const el = ref.current
      if (next) {
        if (el && typeof el.requestFullscreen === 'function') el.requestFullscreen().catch(() => {})
      } else if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
        document.exitFullscreen().catch(() => {})
      }
      return next
    })
  }, [])

  return { ref, isFullscreen, toggle }
}
```

- [ ] **Step 4: Correr para confirmar que passa**

Run: `npx vitest run src/hooks/useFullscreen.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useFullscreen.ts src/hooks/useFullscreen.test.ts
git commit -m "feat: add useFullscreen hook"
```

---

## Task 5: AppHeader e ModeTabs (TDD)

**Files:**
- Create: `src/components/AppHeader.tsx`, `src/components/ModeTabs.tsx`
- Test: `src/components/ModeTabs.test.tsx`

- [ ] **Step 1: Escrever o teste que falha**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ModeTabs } from './ModeTabs'

describe('ModeTabs', () => {
  it('marca o modo ativo e alterna', () => {
    const onChange = vi.fn()
    render(<ModeTabs mode="live" onChange={onChange} />)
    expect(screen.getByRole('button', { name: /ao vivo/i })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: /rever/i }))
    expect(onChange).toHaveBeenCalledWith('review')
  })
})
```

- [ ] **Step 2: Correr para confirmar que falha**

Run: `npx vitest run src/components/ModeTabs.test.tsx`
Expected: FAIL — componente não existe.

- [ ] **Step 3: Implementar `src/components/ModeTabs.tsx`**

```tsx
export type Mode = 'live' | 'review'

const TABS: { key: Mode; label: string }[] = [
  { key: 'live', label: 'Ao Vivo' },
  { key: 'review', label: 'Rever' },
]

export function ModeTabs({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <nav className="mode-tabs" aria-label="Modo">
      {TABS.map(({ key, label }) => (
        <button key={key} aria-pressed={mode === key} onClick={() => onChange(key)}>
          {label}
        </button>
      ))}
    </nav>
  )
}
```

- [ ] **Step 4: Implementar `src/components/AppHeader.tsx`**

```tsx
export function AppHeader({ onOpenProfile }: { onOpenProfile: () => void }) {
  return (
    <header className="app-header">
      <div className="app-brand">
        <span className="app-logo" aria-hidden="true">🚶</span>
        <span className="app-name">Análise de Marcha</span>
      </div>
      <button className="profile-button" onClick={onOpenProfile}>⚙️ Perfil</button>
    </header>
  )
}
```

- [ ] **Step 5: Correr para confirmar que passa**

Run: `npx vitest run src/components/ModeTabs.test.tsx && npx tsc --noEmit`
Expected: PASS; tsc limpo.

- [ ] **Step 6: Commit**

```bash
git add src/components/AppHeader.tsx src/components/ModeTabs.tsx src/components/ModeTabs.test.tsx
git commit -m "feat: add AppHeader and ModeTabs components"
```

---

## Task 6: CameraStage (TDD)

**Files:**
- Create: `src/components/CameraStage.tsx`
- Test: `src/components/CameraStage.test.tsx`

- [ ] **Step 1: Escrever o teste que falha**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { createRef } from 'react'
import { CameraStage } from './CameraStage'
import type { JointAngles } from '../types'

vi.mock('./CameraView', () => ({ CameraView: () => <div data-testid="camera-view" /> }))
vi.mock('./SkeletonOverlay', () => ({ SkeletonOverlay: () => <div data-testid="skeleton" /> }))

const angles: JointAngles = {
  hip: { left: null, right: null },
  knee: { left: 158, right: 150 },
  ankle: { left: null, right: null },
}

function setup(overrides: Partial<Parameters<typeof CameraStage>[0]> = {}) {
  const props = {
    videoRef: createRef<HTMLVideoElement>(),
    frame: null,
    angles,
    liveCadence: 108,
    facingMode: 'environment' as const,
    recording: false,
    recordingSeconds: 0,
    onToggleRecording: vi.fn(),
    onSwitchCamera: vi.fn(),
    onCameraError: vi.fn(),
    ...overrides,
  }
  render(<CameraStage {...props} />)
  return props
}

describe('CameraStage', () => {
  it('mostra a câmara, os chips e a barra de comandos', () => {
    setup()
    expect(screen.getByTestId('camera-view')).toBeInTheDocument()
    expect(screen.getByTestId('chip-knee-left')).toHaveTextContent('158°')
    expect(screen.getByRole('button', { name: /gravar/i })).toBeInTheDocument()
  })

  it('aciona os callbacks de gravar e rodar câmara', () => {
    const props = setup()
    fireEvent.click(screen.getByRole('button', { name: /gravar/i }))
    expect(props.onToggleRecording).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /rodar câmara/i }))
    expect(props.onSwitchCamera).toHaveBeenCalled()
  })

  it('a gravar, mostra o indicador REC e desativa rodar câmara', () => {
    setup({ recording: true, recordingSeconds: 5 })
    expect(screen.getByText(/REC/)).toHaveTextContent('0:05')
    expect(screen.getByRole('button', { name: /rodar câmara/i })).toBeDisabled()
  })
})
```

- [ ] **Step 2: Correr para confirmar que falha**

Run: `npx vitest run src/components/CameraStage.test.tsx`
Expected: FAIL — componente não existe.

- [ ] **Step 3: Implementar `src/components/CameraStage.tsx`**

```tsx
import type { Ref } from 'react'
import { CameraView } from './CameraView'
import { SkeletonOverlay } from './SkeletonOverlay'
import { MetricChips } from './MetricChips'
import { useFullscreen } from '../hooks/useFullscreen'
import type { JointAngles, PoseFrame } from '../types'

const WIDTH = 640
const HEIGHT = 480

export interface CameraStageProps {
  videoRef: Ref<HTMLVideoElement>
  frame: PoseFrame | null
  angles: JointAngles
  liveCadence: number | null
  facingMode: 'user' | 'environment'
  recording: boolean
  recordingSeconds: number
  onToggleRecording: () => void
  onSwitchCamera: () => void
  onCameraError: (message: string) => void
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export function CameraStage(props: CameraStageProps) {
  const { ref, isFullscreen, toggle } = useFullscreen<HTMLDivElement>()

  return (
    <div ref={ref} className={`camera-stage${isFullscreen ? ' stage-fullscreen' : ''}`}>
      <div className="stage-video">
        <CameraView
          ref={props.videoRef}
          width={WIDTH}
          height={HEIGHT}
          facingMode={props.facingMode}
          onError={props.onCameraError}
        />
        <SkeletonOverlay frame={props.frame} width={WIDTH} height={HEIGHT} />
        <MetricChips angles={props.angles} cadence={props.liveCadence} />

        {props.recording && (
          <span className="rec-badge">
            <span className="rec-blink" aria-hidden="true" /> REC {mmss(props.recordingSeconds)}
          </span>
        )}

        <div className="stage-controls">
          <button
            className="ctrl"
            onClick={props.onSwitchCamera}
            disabled={props.recording}
            aria-label="Rodar câmara"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 12a8 8 0 0 1 13-6l3 2M20 12a8 8 0 0 1-13 6l-3-2" />
            </svg>
          </button>

          <button
            className={`ctrl-record${props.recording ? ' is-recording' : ''}`}
            onClick={props.onToggleRecording}
            aria-label={props.recording ? 'Parar gravação' : 'Gravar'}
          >
            <span className={props.recording ? 'rec-square' : 'rec-dot'} aria-hidden="true" />
          </button>

          <button
            className="ctrl"
            onClick={toggle}
            aria-label={isFullscreen ? 'Sair de ecrã inteiro' : 'Ecrã inteiro'}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Correr para confirmar que passa**

Run: `npx vitest run src/components/CameraStage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/CameraStage.tsx src/components/CameraStage.test.tsx
git commit -m "feat: add CameraStage with controls and fullscreen"
```

---

## Task 7: Refatorar o App para o novo shell

**Files:**
- Modify: `src/App.tsx`

Substitui o cabeçalho/tabs/live-view pelo `AppHeader`, `ModeTabs` e `CameraStage`; acrescenta o cronómetro de gravação. Mantém toda a lógica (loop, estados, gravação, cadência). O `App.test` continua verde (o `camera-view` mockado é renderizado pelo `CameraStage`; os rótulos "Ao Vivo"/"Rever" e o `role="note"` mantêm-se).

- [ ] **Step 1: Ler o ficheiro atual e substituir por:**

```tsx
import { useEffect, useRef, useState } from 'react'
import { usePoseEngine } from './hooks/usePoseEngine'
import { useClipRecorder } from './hooks/useClipRecorder'
import { AppHeader } from './components/AppHeader'
import { ModeTabs, type Mode } from './components/ModeTabs'
import { CameraStage } from './components/CameraStage'
import { ClipReviewer } from './components/ClipReviewer'
import { PedagogicalNotice } from './components/PedagogicalNotice'
import { ProfileModal } from './components/ProfileModal'
import { computeAngles } from './lib/angles'
import { createAngleSmoother } from './lib/smoothing'
import { createLiveCadence } from './lib/liveCadence'
import type { JointAngles, PoseFrame } from './types'
import './index.css'

const MIN_VIS = 0.5

const emptyAngles: JointAngles = {
  hip: { left: null, right: null },
  knee: { left: null, right: null },
  ankle: { left: null, right: null },
}

export default function App() {
  const [mode, setMode] = useState<Mode>('live')
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')
  const [error, setError] = useState<string | null>(null)
  const [frame, setFrame] = useState<PoseFrame | null>(null)
  const [angles, setAngles] = useState<JointAngles>(emptyAngles)
  const [liveCadence, setLiveCadence] = useState<number | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)

  const videoRef = useRef<HTMLVideoElement>(null)
  const rafRef = useRef<number>(0)
  const { ready, error: engineError, detect } = usePoseEngine()
  const { recording, clip, start, stop, captureFrame } = useClipRecorder()

  const smoothers = useRef({
    hipL: createAngleSmoother(0.4), hipR: createAngleSmoother(0.4),
    kneeL: createAngleSmoother(0.4), kneeR: createAngleSmoother(0.4),
    ankleL: createAngleSmoother(0.4), ankleR: createAngleSmoother(0.4),
  })
  const cadenceCounter = useRef(createLiveCadence(5000, 300))

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
          const ankleY = (lm[27].y + lm[28].y) / 2
          setLiveCadence(cadenceCounter.current.push(ankleY, performance.now()))
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

  // Cronómetro de gravação.
  useEffect(() => {
    if (!recording) {
      setRecordingSeconds(0)
      return
    }
    const id = setInterval(() => setRecordingSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [recording])

  const toggleRecording = () => {
    const video = videoRef.current
    if (!video?.srcObject) return
    if (recording) stop()
    else start(video.srcObject as MediaStream)
  }

  const switchCamera = () =>
    setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))

  const displayError = error ?? engineError

  return (
    <main className="app">
      <AppHeader onOpenProfile={() => setProfileOpen(true)} />
      <PedagogicalNotice />
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />

      <ModeTabs mode={mode} onChange={setMode} />

      {displayError && <p className="error">{displayError}</p>}
      {!ready && mode === 'live' && <p className="loading">A carregar o modelo de pose…</p>}

      {mode === 'live' && (
        <CameraStage
          videoRef={videoRef}
          frame={frame}
          angles={angles}
          liveCadence={liveCadence}
          facingMode={facingMode}
          recording={recording}
          recordingSeconds={recordingSeconds}
          onToggleRecording={toggleRecording}
          onSwitchCamera={switchCamera}
          onCameraError={setError}
        />
      )}

      {mode === 'review' &&
        (clip ? <ClipReviewer clip={clip} /> : <p>Grave um clip primeiro no modo Ao Vivo.</p>)}
    </main>
  )
}
```

- [ ] **Step 2: Verificar tipos e suite**

Run: `npx tsc --noEmit && npm test`
Expected: sem erros; todos os testes passam (incl. `App.test.tsx`).

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "refactor: compose App from header, tabs and CameraStage"
```

---

## Task 8: Cartões no ClipReviewer

**Files:**
- Modify: `src/components/ClipReviewer.tsx`

Embrulha cada painel num `Card` e mantém os controlos numa barra. Não muda comportamento nem `data-testid` internos dos painéis.

- [ ] **Step 1: Adicionar import do Card**

Em `src/components/ClipReviewer.tsx`, juntar aos imports:
```tsx
import { Card } from './Card'
```

- [ ] **Step 2: Envolver os painéis em Card**

Substituir o bloco que renderiza os painéis (de `<DetectionProfileBar ... />` até `<InterpretationPanel summary={summary} />`, inclusive o `{angles && <AnglePanel .../>}`) por:
```tsx
      <Card title="Deteção e métricas">
        <DetectionProfileBar value={method} onChange={setMethod} />
        <OperatedSideSelector value={operated} onChange={setOperated} />
        <GaitMetricsPanel metrics={metrics} />
      </Card>

      <Card title="Compensação">
        <CompensationPanel antalgic={antalgic} rom={rom} operatedSide={operated} />
        <TrendelenburgPanel obliquity={obliquity} currentTimeMs={timeMs} onSeek={seekTo} />
      </Card>

      <Card title="Interpretação">
        <InterpretationPanel summary={summary} />
      </Card>

      {angles && (
        <Card title="Ângulos (frame atual)">
          <AnglePanel angles={angles} />
        </Card>
      )}
```

- [ ] **Step 3: Verificar tipos e suite**

Run: `npx tsc --noEmit && npm test`
Expected: sem erros; todos os testes passam.

- [ ] **Step 4: Commit**

```bash
git add src/components/ClipReviewer.tsx
git commit -m "style: wrap ClipReviewer panels in cards"
```

---

## Task 9: Reestilizar componentes com estilos existentes

**Files:**
- Modify: `src/components/PedagogicalNotice.tsx`, `src/components/GaitMetricsPanel.tsx` (só se necessário — ver nota)

Nota: estes componentes já usam classes CSS (`.pedagogical-notice`, `.angle-panel`, etc.). A reestilização faz-se sobretudo no CSS (Task 10), sem alterar o JSX. Esta tarefa confirma que nenhum componente tem cores inline que escapem aos tokens.

- [ ] **Step 1: Procurar cores inline em componentes**

Run: `npx tsc --noEmit` e depois procurar estilos inline com cor fixa:
```bash
grep -rn "style=.*#" src/components || echo "sem cores inline"
```
Esperado: apenas `SkeletonOverlay.tsx` (desenha no canvas com cores fixas — é suposto) e nada mais problemático.

- [ ] **Step 2: Confirmar que não há alterações necessárias**

Se o grep só devolver `SkeletonOverlay.tsx`, não é preciso alterar componentes — o canvas usa cores próprias por design. Registar e avançar.

- [ ] **Step 3: Commit (vazio de código, marca o checkpoint)**

Se nada mudou, saltar o commit. Se algum componente tinha cor inline indevida, corrigi-lo para usar `var(--…)` e commitar:
```bash
git add -A && git commit -m "style: replace stray inline colors with tokens"
```

---

## Task 10: CSS — reescrever `index.css` com os tokens e os novos elementos

**Files:**
- Modify: `src/index.css` (substituir todo o conteúdo)

- [ ] **Step 1: Substituir `src/index.css` por:**

```css
.app {
  max-width: 760px;
  margin: 0 auto;
  padding: 1rem;
}

/* Cabeçalho e marca */
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}
.app-brand { display: flex; align-items: center; gap: 8px; }
.app-logo { font-size: 20px; }
.app-name { font-weight: 500; font-size: 1.05rem; }
.profile-button {
  padding: 0.4rem 0.8rem;
  border: 0.5px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: var(--radius);
  cursor: pointer;
  white-space: nowrap;
}
.profile-button:hover { background: var(--surface-2); }

/* Aviso pedagógico */
.pedagogical-notice {
  background: var(--bg-warning);
  color: var(--warning);
  border: 0.5px solid var(--border);
  border-radius: var(--radius);
  padding: 0.5rem 0.75rem;
  font-size: 0.88rem;
}

/* Separadores de modo e pílulas */
.mode-tabs,
.profile-bar,
.operated-selector {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin: 0.75rem 0;
}
.mode-tabs button,
.profile-bar button,
.operated-selector button {
  padding: 0.4rem 0.9rem;
  border: 0.5px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 999px;
  cursor: pointer;
  font-size: 0.9rem;
}
.mode-tabs button[aria-pressed='true'],
.profile-bar button[aria-pressed='true'],
.operated-selector button[aria-pressed='true'] {
  background: var(--accent);
  color: var(--accent-contrast);
  border-color: var(--accent);
  font-weight: 500;
}

/* Cartões */
.card {
  background: var(--surface);
  border: 0.5px solid var(--border);
  border-radius: var(--radius-card);
  padding: 1rem 1.1rem;
  margin-top: 1rem;
  box-shadow: var(--shadow);
}
.card-title { margin: 0 0 0.6rem; font-size: 1rem; font-weight: 500; }

/* Estágio da câmara */
.camera-stage { margin-top: 0.5rem; }
.stage-video {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  background: #10131a;
  border-radius: 16px;
  overflow: hidden;
}
.stage-video video,
.stage-video canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.stage-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 200;
  margin: 0;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.stage-fullscreen .stage-video {
  height: 100%;
  aspect-ratio: auto;
  border-radius: 0;
}

/* Chips de métricas sobre o vídeo */
.metric-chips {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-end;
}
.chip {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  background: rgba(16, 19, 26, 0.66);
  color: #eceef1;
  padding: 4px 9px;
  border-radius: 8px;
  font-size: 12px;
}
.chip-label { color: #b9c0cb; }
.chip-val { font-weight: 500; }
.chip-val.side-left { color: var(--side-left); }
.chip-val.side-right { color: var(--side-right); }

/* Indicador REC */
.rec-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(229, 72, 77, 0.92);
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  padding: 4px 9px;
  border-radius: 999px;
}
.rec-blink { width: 8px; height: 8px; border-radius: 50%; background: #fff; }

/* Barra de comandos */
.stage-controls {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 28px;
}
.ctrl {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.ctrl:disabled { opacity: 0.4; cursor: default; }
.ctrl-record {
  width: 66px;
  height: 66px;
  border-radius: 50%;
  border: 4px solid #fff;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.rec-dot { width: 44px; height: 44px; border-radius: 50%; background: var(--danger); }
.rec-square { width: 26px; height: 26px; border-radius: 6px; background: var(--danger); }

/* Controlos de revisão */
.controls {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.6rem;
}
.controls button {
  padding: 0.4rem 0.8rem;
  border: 0.5px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: var(--radius);
  cursor: pointer;
}

/* Tabelas de métricas */
.angle-panel {
  margin-top: 0.75rem;
  border-collapse: collapse;
  min-width: 260px;
  width: 100%;
}
.angle-panel th,
.angle-panel td {
  border: 0.5px solid var(--border);
  padding: 0.4rem 0.75rem;
  text-align: center;
}
.metrics-highlight { display: flex; gap: 1.5rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
.metrics-cycles { color: var(--text-muted); }
.metrics-warning {
  background: var(--bg-warning);
  color: var(--warning);
  border: 0.5px solid var(--border);
  border-radius: var(--radius);
  padding: 0.5rem 0.75rem;
}
.live-cadence { margin-top: 0.5rem; }

/* Timeline de eventos */
.event-timeline {
  position: relative;
  height: 14px;
  margin-top: 6px;
  background: var(--surface-2);
  border-radius: 4px;
}
.event-marker { position: absolute; top: 0; width: 2px; height: 14px; transform: translateX(-1px); }

/* Compensação */
.antalgic-flagged {
  background: var(--bg-danger);
  color: var(--danger);
  border: 0.5px solid var(--border);
  border-radius: var(--radius);
  padding: 0.5rem 0.75rem;
}
.antalgic-ok { color: var(--success); }
.rom-reduced { background: var(--bg-danger); font-weight: 500; }

/* Interpretação */
.privacy-note { font-size: 0.85rem; color: var(--text-muted); }
.interpretation-text {
  margin-top: 0.6rem;
  white-space: pre-wrap;
  background: var(--surface-2);
  border-radius: var(--radius);
  padding: 0.75rem;
}
.model-used { margin-top: 0.4rem; font-size: 0.8rem; color: var(--text-muted); }
.interpretation-hint { color: var(--text-muted); font-size: 0.85rem; }

/* Erros e estados */
.error {
  color: var(--danger);
  background: var(--bg-danger);
  border-radius: var(--radius);
  padding: 0.5rem 0.75rem;
}
.loading { color: var(--text-muted); }

/* Modal de perfil */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.modal {
  background: var(--surface);
  color: var(--text);
  border: 0.5px solid var(--border);
  border-radius: 16px;
  padding: 1.25rem;
  max-width: 420px;
  width: 90%;
  max-height: 90vh;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.modal label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.9rem; }
.modal label.remember { flex-direction: row; align-items: center; gap: 0.4rem; }
.modal input,
.modal select {
  padding: 0.45rem;
  border: 0.5px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-2);
  color: var(--text);
}
.modal button {
  padding: 0.4rem 0.8rem;
  border: 0.5px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
  border-radius: var(--radius);
  cursor: pointer;
}
.modal-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.modal-security {
  font-size: 0.8rem;
  color: var(--warning);
  background: var(--bg-warning);
  border-radius: var(--radius);
  padding: 0.4rem 0.6rem;
}
.test-result ul { list-style: none; padding-left: 0; margin: 0.25rem 0; }
```

- [ ] **Step 2: Verificar build e suite**

Run: `npm run build && npm test`
Expected: build sem erros; todos os testes passam.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "style: restyle app with theme tokens and new layout"
```

---

## Task 11: Verificação visual (checklist)

Sem código. Correr `npm run dev`, abrir no browser e usar a ferramenta de dispositivo (telemóvel/tablet) e a emulação de tema:

- [ ] **Modo claro e escuro** — alternar o esquema do sistema/emulação; confirmar legibilidade de texto, cartões, chips e botões nos dois.
- [ ] **Shell** — cabeçalho com marca + Perfil; separadores em pílula com o ativo em acento.
- [ ] **Ao Vivo** — o vídeo ocupa a largura; chips de métricas no canto; barra de comandos (rodar câmara · gravar · ecrã inteiro) por baixo/sobre o vídeo.
- [ ] **Gravar** — o botão central mostra o quadrado; aparece o indicador REC com o tempo; rodar câmara fica desativado.
- [ ] **Ecrã inteiro** — o botão expande o estágio a todo o ecrã; sair volta ao normal (botão e Esc).
- [ ] **Rever** — painéis em cartões coerentes; seletores em pílula.
- [ ] **Perfil** — modal legível nos dois temas; ✓/✗ do teste em cores semânticas.
- [ ] **Telemóvel/tablet** — tudo responsivo, sem overflow horizontal.

Registar problemas como tarefas de correção antes de concluir.

---

## Notas de verificação do plano (self-review)

- **Cobertura da spec:** tokens claro/escuro (Task 1), Card (Task 2), MetricChips (Task 3),
  useFullscreen (Task 4), AppHeader+ModeTabs (Task 5), CameraStage com comandos/REC/fullscreen
  (Task 6), refactor do App preservando lógica e testes (Task 7), cartões no Rever (Task 8),
  varredura de cores inline (Task 9), CSS unificado com tokens + modal/painéis/pílulas
  (Task 10), verificação visual claro/escuro/mobile (Task 11). ✔️
- **Consistência de tipos:** `Mode` de `ModeTabs` (Task 5) usado no `App` (Task 7);
  `CameraStageProps` (Task 6) alimentado pelo `App` com `videoRef/frame/angles/liveCadence/
  facingMode/recording/recordingSeconds/onToggleRecording/onSwitchCamera/onCameraError` (Task 7);
  `useFullscreen` (Task 4) usado no `CameraStage` (Task 6); `MetricChips`/`Card` usados em
  CameraStage/ClipReviewer. ✔️
- **Invariante respeitada:** nenhuma lógica de `src/lib` alterada; `camera-view` e rótulos dos
  testes preservados; `App.test` continua a bater (camera-view via CameraStage, tabs, note). ✔️
- **Fora de âmbito (não incluído):** temas personalizáveis, animações elaboradas, nova
  identidade. ✔️
