# Camada de Interpretação com LLM (Gemini) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gerar uma interpretação pedagógica em texto das métricas de marcha via Gemini API, com a chave do próprio utilizador gerida num modal de perfil, sem backend.

**Architecture:** App 100% client-side. Serviços puros (`apiKeyStore`, `gemini`, `gaitSummary`) testáveis com `fetch`/storage mockados; componentes `ProfileModal` e `InterpretationPanel` integrados no `App` e `ClipReviewer`. Só saem números anónimos — nunca vídeo/landmarks.

**Tech Stack:** React 18, TypeScript, Vitest, React Testing Library. Gemini API (`generativelanguage.googleapis.com/v1beta`).

---

## Convenções

- Ordem preferida de modelos: `gemini-3.5-flash` → `gemini-3.1-flash-lite` → `gemini-2.5-flash`.
- Endpoints: `GET /v1beta/models?key=…` (lista); `POST /v1beta/models/{model}:generateContent?key=…`.
- Mensagens de erro: chave inválida (400/403) "Chave rejeitada — verifique no Perfil."; quota (429) "Limite do nível gratuito atingido — tente mais tarde."; outros "Nenhum modelo Gemini disponível para esta chave."; rede "Sem ligação ao serviço Gemini."

---

## Task 1: Tipos da camada LLM

**Files:**
- Modify: `src/types.ts` (acrescentar ao fim)

- [ ] **Step 1: Acrescentar os tipos**

Adicionar ao fim de `src/types.ts`:
```ts

// ----- Camada de interpretação LLM (Gemini) -----

/** 'auto' (fallback pela ordem preferida) ou um id de modelo específico. */
export type ModelChoice = 'auto' | string

export interface StoredKey {
  key: string
  remembered: boolean // true = localStorage; false = sessionStorage
}

export interface ModelAvailability {
  model: string
  available: boolean
}

export interface ConnectionTestResult {
  ok: boolean
  message: string
  models: ModelAvailability[]
}

export interface InterpretationResult {
  text: string
  modelUsed: string
}
```

- [ ] **Step 2: Verificar compilação**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add LLM interpretation types"
```

---

## Task 2: apiKeyStore (TDD)

**Files:**
- Create: `src/lib/apiKeyStore.ts`
- Test: `src/lib/apiKeyStore.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/apiKeyStore.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { saveKey, loadKey, clearKey, saveModel, loadModel } from './apiKeyStore'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('apiKeyStore', () => {
  it('guarda em localStorage quando "lembrar" é true', () => {
    saveKey('abc', true)
    expect(loadKey()).toEqual({ key: 'abc', remembered: true })
    expect(localStorage.getItem('gait-gemini-key')).toBe('abc')
    expect(sessionStorage.getItem('gait-gemini-key')).toBeNull()
  })

  it('guarda em sessionStorage quando "lembrar" é false', () => {
    saveKey('xyz', false)
    expect(loadKey()).toEqual({ key: 'xyz', remembered: false })
    expect(sessionStorage.getItem('gait-gemini-key')).toBe('xyz')
    expect(localStorage.getItem('gait-gemini-key')).toBeNull()
  })

  it('loadKey devolve null quando não há chave', () => {
    expect(loadKey()).toBeNull()
  })

  it('clearKey remove dos dois armazenamentos', () => {
    saveKey('abc', true)
    clearKey()
    expect(loadKey()).toBeNull()
  })

  it('guarda e lê a escolha de modelo (default auto)', () => {
    expect(loadModel()).toBe('auto')
    saveModel('gemini-2.5-flash')
    expect(loadModel()).toBe('gemini-2.5-flash')
  })
})
```

- [ ] **Step 2: Correr para confirmar que falha**

Run: `npx vitest run src/lib/apiKeyStore.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

Criar `src/lib/apiKeyStore.ts`:
```ts
import type { ModelChoice, StoredKey } from '../types'

const KEY = 'gait-gemini-key'
const MODEL = 'gait-gemini-model'

/** Guarda a chave em localStorage (lembrar) ou sessionStorage (só a sessão). */
export function saveKey(key: string, remember: boolean): void {
  if (remember) {
    localStorage.setItem(KEY, key)
    sessionStorage.removeItem(KEY)
  } else {
    sessionStorage.setItem(KEY, key)
    localStorage.removeItem(KEY)
  }
}

/** Lê a chave (localStorage tem prioridade); null se não existir. */
export function loadKey(): StoredKey | null {
  const local = localStorage.getItem(KEY)
  if (local !== null) return { key: local, remembered: true }
  const session = sessionStorage.getItem(KEY)
  if (session !== null) return { key: session, remembered: false }
  return null
}

/** Remove a chave dos dois armazenamentos. */
export function clearKey(): void {
  localStorage.removeItem(KEY)
  sessionStorage.removeItem(KEY)
}

/** Guarda a escolha de modelo (persistente). */
export function saveModel(choice: ModelChoice): void {
  localStorage.setItem(MODEL, choice)
}

/** Lê a escolha de modelo; 'auto' por omissão. */
export function loadModel(): ModelChoice {
  return localStorage.getItem(MODEL) ?? 'auto'
}
```

- [ ] **Step 4: Correr para confirmar que passa**

Run: `npx vitest run src/lib/apiKeyStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/apiKeyStore.ts src/lib/apiKeyStore.test.ts
git commit -m "feat: add API key store (local/session, model choice)"
```

---

## Task 3: gaitSummary (TDD)

**Files:**
- Create: `src/lib/gaitSummary.ts`
- Test: `src/lib/gaitSummary.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/gaitSummary.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildSummary, buildPrompt } from './gaitSummary'
import type {
  AntalgicAssessment, GaitMetrics, PelvicObliquity, RomResult,
} from '../types'

const metrics: GaitMetrics = {
  cadenceStepsPerMin: 108,
  cyclesDetected: 3,
  operated: { stanceMs: 620, swingMs: 400, stepMs: 520, stanceSwingRatio: 1.55 },
  nonOperated: { stanceMs: 700, swingMs: 410, stepMs: 540, stanceSwingRatio: 1.71 },
  symmetryIndexPct: 12.1,
}
const antalgic: AntalgicAssessment = { evaluable: true, flagged: true, message: 'x' }
const rom: RomResult = {
  left: { hipDeg: 28, kneeDeg: 40, hipReduced: true, kneeReduced: true },
  right: { hipDeg: 34, kneeDeg: 58, hipReduced: false, kneeReduced: false },
}
const obliquity: PelvicObliquity = { series: [], peakDeg: 9.3, peakTimeMs: 800 }

describe('buildSummary', () => {
  it('inclui as métricas-chave e o lado/método, sem vídeo nem landmarks', () => {
    const s = buildSummary(metrics, antalgic, rom, obliquity, 'left', 'coordinate')
    expect(s.operatedSide).toBe('left')
    expect(s.detectionMethod).toBe('coordinate')
    expect(s.cadenceStepsPerMin).toBe(108)
    expect(s.symmetryIndexPct).toBeCloseTo(12.1, 1)
    expect(s.antalgic.flagged).toBe(true)
    expect(s.pelvicObliquityPeakDeg).toBeCloseTo(9.3, 1)
    const json = JSON.stringify(s)
    expect(json).not.toMatch(/landmark/i)
    expect(json).not.toMatch(/videoUrl/i)
  })
})

describe('buildPrompt', () => {
  it('produz um prompt em português com a ressalva e o JSON das métricas', () => {
    const s = buildSummary(metrics, antalgic, rom, obliquity, 'left', 'coordinate')
    const p = buildPrompt(s)
    expect(p).toMatch(/enfermagem de reabilitação/i)
    expect(p).toMatch(/não.*diagnóstico/i)
    expect(p).toContain('"cadenceStepsPerMin": 108')
  })
})
```

- [ ] **Step 2: Correr para confirmar que falha**

Run: `npx vitest run src/lib/gaitSummary.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

Criar `src/lib/gaitSummary.ts`:
```ts
import type {
  AntalgicAssessment, GaitEventMethod, GaitMetrics, OperatedSide,
  PelvicObliquity, RomResult, SideMetrics,
} from '../types'

/** Resumo anónimo (só números/flags/config) enviado ao LLM. Sem vídeo nem landmarks. */
export interface GaitSummary {
  operatedSide: OperatedSide
  detectionMethod: GaitEventMethod
  cadenceStepsPerMin: number | null
  cyclesDetected: number
  symmetryIndexPct: number | null
  operated: SideMetrics
  nonOperated: SideMetrics
  antalgic: { flagged: boolean; evaluable: boolean }
  rom: RomResult
  pelvicObliquityPeakDeg: number | null
}

export function buildSummary(
  metrics: GaitMetrics,
  antalgic: AntalgicAssessment,
  rom: RomResult,
  obliquity: PelvicObliquity,
  operatedSide: OperatedSide,
  detectionMethod: GaitEventMethod,
): GaitSummary {
  return {
    operatedSide,
    detectionMethod,
    cadenceStepsPerMin: metrics.cadenceStepsPerMin,
    cyclesDetected: metrics.cyclesDetected,
    symmetryIndexPct: metrics.symmetryIndexPct,
    operated: metrics.operated,
    nonOperated: metrics.nonOperated,
    antalgic: { flagged: antalgic.flagged, evaluable: antalgic.evaluable },
    rom,
    pelvicObliquityPeakDeg: obliquity.peakDeg,
  }
}

export function buildPrompt(summary: GaitSummary): string {
  return [
    'És um assistente didático para estudantes de mestrado em enfermagem de reabilitação.',
    'Com base nas seguintes métricas de marcha (medições 2D aproximadas obtidas de vídeo) de',
    'um doente pós-artroplastia da coxofemoral, escreve uma interpretação pedagógica em',
    'português de Portugal. Explica o que as métricas sugerem — padrão antálgico, redução de',
    'amplitude (ROM) e possível sinal de Trendelenburg — em linguagem clara e formativa.',
    'Termina SEMPRE com uma ressalva de que é uma leitura educativa sobre medições 2D',
    'aproximadas e não constitui um diagnóstico clínico.',
    '',
    'Métricas (JSON):',
    JSON.stringify(summary, null, 2),
  ].join('\n')
}
```

- [ ] **Step 4: Correr para confirmar que passa**

Run: `npx vitest run src/lib/gaitSummary.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gaitSummary.ts src/lib/gaitSummary.test.ts
git commit -m "feat: add anonymous gait summary and LLM prompt builder"
```

---

## Task 4: gemini.listModels (TDD)

**Files:**
- Create: `src/lib/gemini.ts`
- Test: `src/lib/gemini.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/gemini.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { listModels } from './gemini'

const fakeRes = (ok: boolean, status: number, data: unknown) =>
  ({ ok, status, json: async () => data }) as Response

describe('listModels', () => {
  it('marca disponibilidade cruzando com a ordem preferida', async () => {
    const fetchImpl = vi.fn(async () =>
      fakeRes(true, 200, {
        models: [
          { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-embedding', supportedGenerationMethods: ['embedContent'] },
        ],
      }),
    )
    const r = await listModels('abc', fetchImpl as unknown as typeof fetch)
    expect(r.ok).toBe(true)
    const flash25 = r.models.find((m) => m.model === 'gemini-2.5-flash')
    expect(flash25?.available).toBe(true)
    const flash35 = r.models.find((m) => m.model === 'gemini-3.5-flash')
    expect(flash35?.available).toBe(false)
  })

  it('devolve chave rejeitada no 403', async () => {
    const fetchImpl = vi.fn(async () => fakeRes(false, 403, {}))
    const r = await listModels('bad', fetchImpl as unknown as typeof fetch)
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/rejeitada/i)
  })
})
```

- [ ] **Step 2: Correr para confirmar que falha**

Run: `npx vitest run src/lib/gemini.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar (base + listModels)**

Criar `src/lib/gemini.ts`:
```ts
import type { ConnectionTestResult } from '../types'

const BASE = 'https://generativelanguage.googleapis.com/v1beta'

export const PREFERRED_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
] as const

/** Mensagem de erro para um código HTTP. */
function messageForStatus(status: number): string {
  if (status === 400 || status === 403) return 'Chave rejeitada — verifique no Perfil.'
  if (status === 429) return 'Limite do nível gratuito atingido — tente mais tarde.'
  return 'Nenhum modelo Gemini disponível para esta chave.'
}

const allUnavailable = () =>
  PREFERRED_MODELS.map((model) => ({ model, available: false }))

/** Testa a chave e descobre quais dos modelos preferidos estão disponíveis. */
export async function listModels(
  key: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ConnectionTestResult> {
  if (!key) {
    return { ok: false, message: 'Configure a chave no Perfil.', models: allUnavailable() }
  }
  let res: Response
  try {
    res = await fetchImpl(`${BASE}/models?key=${encodeURIComponent(key)}`)
  } catch {
    return { ok: false, message: 'Sem ligação ao serviço Gemini.', models: allUnavailable() }
  }
  if (!res.ok) {
    return { ok: false, message: messageForStatus(res.status), models: allUnavailable() }
  }
  const data = (await res.json()) as {
    models?: { name?: string; supportedGenerationMethods?: string[] }[]
  }
  const available = new Set<string>()
  for (const m of data.models ?? []) {
    if ((m.supportedGenerationMethods ?? []).includes('generateContent') && m.name) {
      available.add(m.name.replace(/^models\//, ''))
    }
  }
  return {
    ok: true,
    message: 'Ligação válida.',
    models: PREFERRED_MODELS.map((model) => ({ model, available: available.has(model) })),
  }
}
```

- [ ] **Step 4: Correr para confirmar que passa**

Run: `npx vitest run src/lib/gemini.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gemini.ts src/lib/gemini.test.ts
git commit -m "feat: add Gemini listModels connection test"
```

---

## Task 5: gemini.generateInterpretation com fallback (TDD)

**Files:**
- Modify: `src/lib/gemini.ts`
- Test: `src/lib/gemini.test.ts` (acrescentar)

- [ ] **Step 1: Acrescentar o teste que falha**

Acrescentar a `src/lib/gemini.test.ts`:
```ts
import { generateInterpretation } from './gemini'

const okBody = (text: string) => ({
  candidates: [{ content: { parts: [{ text }] } }],
})

describe('generateInterpretation', () => {
  it('devolve o texto e o modelo no sucesso', async () => {
    const fetchImpl = vi.fn(async () => fakeRes(true, 200, okBody('olá')))
    const r = await generateInterpretation('abc', 'auto', 'prompt', fetchImpl as unknown as typeof fetch)
    expect(r.text).toBe('olá')
    expect(r.modelUsed).toBe('gemini-3.5-flash') // primeiro da ordem preferida
  })

  it('faz fallback para o modelo seguinte no 404', async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      url.includes('gemini-3.5-flash')
        ? fakeRes(false, 404, {})
        : fakeRes(true, 200, okBody('feito')),
    )
    const r = await generateInterpretation('abc', 'auto', 'prompt', fetchImpl as unknown as typeof fetch)
    expect(r.text).toBe('feito')
    expect(r.modelUsed).toBe('gemini-3.1-flash-lite')
  })

  it('lança "Chave rejeitada" no 403 sem tentar mais', async () => {
    const fetchImpl = vi.fn(async () => fakeRes(false, 403, {}))
    await expect(
      generateInterpretation('bad', 'auto', 'prompt', fetchImpl as unknown as typeof fetch),
    ).rejects.toThrow(/rejeitada/i)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('lança mensagem de quota quando todos dão 429', async () => {
    const fetchImpl = vi.fn(async () => fakeRes(false, 429, {}))
    await expect(
      generateInterpretation('abc', 'auto', 'prompt', fetchImpl as unknown as typeof fetch),
    ).rejects.toThrow(/nível gratuito/i)
  })
})
```

- [ ] **Step 2: Correr para confirmar que falha**

Run: `npx vitest run src/lib/gemini.test.ts`
Expected: FAIL — `generateInterpretation` não existe.

- [ ] **Step 3: Implementar**

Acrescentar a `src/lib/gemini.ts` (juntar `InterpretationResult`, `ModelChoice` ao import de tipos e a função no fim):
```ts
import type { InterpretationResult, ModelChoice } from '../types'

/** Lista de modelos a tentar, começando pelo escolhido (ou a ordem preferida se 'auto'). */
function candidatesFor(modelChoice: ModelChoice): string[] {
  if (modelChoice === 'auto') return [...PREFERRED_MODELS]
  return [modelChoice, ...PREFERRED_MODELS.filter((m) => m !== modelChoice)]
}

/**
 * Gera a interpretação, tentando os modelos por ordem e fazendo fallback no 404/429.
 * Lança Error com mensagem específica se a chave for rejeitada ou todos falharem.
 */
export async function generateInterpretation(
  key: string,
  modelChoice: ModelChoice,
  prompt: string,
  fetchImpl: typeof fetch = fetch,
): Promise<InterpretationResult> {
  if (!key) throw new Error('Configure a chave no Perfil.')
  let lastMessage = 'Nenhum modelo Gemini disponível para esta chave.'
  for (const model of candidatesFor(modelChoice)) {
    let res: Response
    try {
      res = await fetchImpl(
        `${BASE}/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        },
      )
    } catch {
      lastMessage = 'Sem ligação ao serviço Gemini.'
      continue
    }
    if (res.ok) {
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[]
      }
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      return { text, modelUsed: model }
    }
    if (res.status === 400 || res.status === 403) {
      throw new Error('Chave rejeitada — verifique no Perfil.')
    }
    lastMessage = messageForStatus(res.status)
  }
  throw new Error(lastMessage)
}
```

- [ ] **Step 4: Correr para confirmar que passa**

Run: `npx vitest run src/lib/gemini.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gemini.ts src/lib/gemini.test.ts
git commit -m "feat: add Gemini interpretation with model fallback"
```

---

## Task 6: ProfileModal (TDD)

**Files:**
- Create: `src/components/ProfileModal.tsx`
- Test: `src/components/ProfileModal.test.tsx`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/components/ProfileModal.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ProfileModal } from './ProfileModal'
import * as store from '../lib/apiKeyStore'
import * as gemini from '../lib/gemini'

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(store, 'loadKey').mockReturnValue(null)
  vi.spyOn(store, 'loadModel').mockReturnValue('auto')
})

describe('ProfileModal', () => {
  it('não renderiza quando fechado', () => {
    const { container } = render(<ProfileModal open={false} onClose={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('guarda a chave ao clicar em Guardar', () => {
    const saveKey = vi.spyOn(store, 'saveKey').mockImplementation(() => {})
    vi.spyOn(store, 'saveModel').mockImplementation(() => {})
    render(<ProfileModal open onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText(/chave de api/i), { target: { value: 'minha-chave' } })
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }))
    expect(saveKey).toHaveBeenCalledWith('minha-chave', true)
  })

  it('testa a ligação e mostra a disponibilidade', async () => {
    vi.spyOn(gemini, 'listModels').mockResolvedValue({
      ok: true,
      message: 'Ligação válida.',
      models: [{ model: 'gemini-2.5-flash', available: true }],
    })
    render(<ProfileModal open onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText(/chave de api/i), { target: { value: 'k' } })
    fireEvent.click(screen.getByRole('button', { name: /testar liga/i }))
    await waitFor(() => expect(screen.getByText(/Ligação válida/i)).toBeInTheDocument())
    expect(screen.getByText(/gemini-2.5-flash/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Correr para confirmar que falha**

Run: `npx vitest run src/components/ProfileModal.test.tsx`
Expected: FAIL — componente não existe.

- [ ] **Step 3: Implementar**

Criar `src/components/ProfileModal.tsx`:
```tsx
import { useState } from 'react'
import { loadKey, saveKey, clearKey, loadModel, saveModel } from '../lib/apiKeyStore'
import { listModels } from '../lib/gemini'
import type { ConnectionTestResult, ModelChoice } from '../types'

const AI_STUDIO_URL = 'https://aistudio.google.com/apikey'

export function ProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const stored = loadKey()
  const [key, setKey] = useState(stored?.key ?? '')
  const [remember, setRemember] = useState(stored?.remembered ?? true)
  const [show, setShow] = useState(false)
  const [model, setModel] = useState<ModelChoice>(loadModel())
  const [test, setTest] = useState<ConnectionTestResult | null>(null)
  const [testing, setTesting] = useState(false)

  if (!open) return null

  const onSave = () => {
    saveKey(key, remember)
    saveModel(model)
    onClose()
  }
  const onClear = () => {
    clearKey()
    setKey('')
    setTest(null)
  }
  const onTest = async () => {
    setTesting(true)
    setTest(await listModels(key))
    setTesting(false)
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-label="Perfil">
      <div className="modal">
        <h2>Perfil — chave Gemini</h2>
        <p>
          Obtenha uma chave gratuita no{' '}
          <a href={AI_STUDIO_URL} target="_blank" rel="noreferrer">Google AI Studio</a>. O
          nível gratuito chega para uso pedagógico.
        </p>

        <label>
          Chave de API
          <input
            type={show ? 'text' : 'password'}
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
        </label>
        <button onClick={() => setShow((s) => !s)}>{show ? 'Ocultar' : 'Mostrar'}</button>

        <label>
          Modelo
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            <option value="auto">Automático (fallback)</option>
            <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
            <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash-Lite</option>
            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
          </select>
        </label>

        <button onClick={onTest} disabled={testing || !key}>
          {testing ? 'A testar…' : 'Testar ligação'}
        </button>
        {test && (
          <div className="test-result">
            <p>{test.message}</p>
            <ul>
              {test.models.map((m) => (
                <li key={m.model}>{m.available ? '✓' : '✗'} {m.model}</li>
              ))}
            </ul>
          </div>
        )}

        <label className="remember">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          Lembrar chave neste dispositivo
        </label>

        <p className="modal-security">
          A chave fica guardada neste navegador. Use a sua própria chave e apague-a em
          computadores partilhados.
        </p>

        <div className="modal-actions">
          <button onClick={onSave}>Guardar</button>
          <button onClick={onClear}>Apagar chave</button>
          <button onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Correr para confirmar que passa**

Run: `npx vitest run src/components/ProfileModal.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ProfileModal.tsx src/components/ProfileModal.test.tsx
git commit -m "feat: add profile modal for Gemini key management"
```

---

## Task 7: InterpretationPanel (TDD)

**Files:**
- Create: `src/components/InterpretationPanel.tsx`
- Test: `src/components/InterpretationPanel.test.tsx`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/components/InterpretationPanel.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { InterpretationPanel } from './InterpretationPanel'
import * as store from '../lib/apiKeyStore'
import * as gemini from '../lib/gemini'
import type { GaitSummary } from '../lib/gaitSummary'

const summary: GaitSummary = {
  operatedSide: 'left',
  detectionMethod: 'coordinate',
  cadenceStepsPerMin: 108,
  cyclesDetected: 3,
  symmetryIndexPct: 12,
  operated: { stanceMs: 620, swingMs: 400, stepMs: 520, stanceSwingRatio: 1.5 },
  nonOperated: { stanceMs: 700, swingMs: 410, stepMs: 540, stanceSwingRatio: 1.7 },
  antalgic: { flagged: true, evaluable: true },
  rom: {
    left: { hipDeg: 28, kneeDeg: 40, hipReduced: true, kneeReduced: true },
    right: { hipDeg: 34, kneeDeg: 58, hipReduced: false, kneeReduced: false },
  },
  pelvicObliquityPeakDeg: 9,
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(store, 'loadModel').mockReturnValue('auto')
})

describe('InterpretationPanel', () => {
  it('desativa o botão e mostra a dica quando não há chave', () => {
    vi.spyOn(store, 'loadKey').mockReturnValue(null)
    render(<InterpretationPanel summary={summary} />)
    expect(screen.getByRole('button', { name: /gerar interpretação/i })).toBeDisabled()
    expect(screen.getByText(/configure a chave no perfil/i)).toBeInTheDocument()
  })

  it('gera e mostra o texto e o modelo usado', async () => {
    vi.spyOn(store, 'loadKey').mockReturnValue({ key: 'k', remembered: true })
    vi.spyOn(gemini, 'generateInterpretation').mockResolvedValue({
      text: 'Interpretação exemplo.',
      modelUsed: 'gemini-2.5-flash',
    })
    render(<InterpretationPanel summary={summary} />)
    fireEvent.click(screen.getByRole('button', { name: /gerar interpretação/i }))
    await waitFor(() => expect(screen.getByText(/Interpretação exemplo/)).toBeInTheDocument())
    expect(screen.getByText(/gemini-2.5-flash/)).toBeInTheDocument()
  })

  it('mostra a mensagem de erro quando a geração falha', async () => {
    vi.spyOn(store, 'loadKey').mockReturnValue({ key: 'k', remembered: true })
    vi.spyOn(gemini, 'generateInterpretation').mockRejectedValue(
      new Error('Limite do nível gratuito atingido — tente mais tarde.'),
    )
    render(<InterpretationPanel summary={summary} />)
    fireEvent.click(screen.getByRole('button', { name: /gerar interpretação/i }))
    await waitFor(() => expect(screen.getByText(/nível gratuito/i)).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Correr para confirmar que falha**

Run: `npx vitest run src/components/InterpretationPanel.test.tsx`
Expected: FAIL — componente não existe.

- [ ] **Step 3: Implementar**

Criar `src/components/InterpretationPanel.tsx`:
```tsx
import { useEffect, useState } from 'react'
import { loadKey, loadModel } from '../lib/apiKeyStore'
import { generateInterpretation } from '../lib/gemini'
import { buildPrompt, type GaitSummary } from '../lib/gaitSummary'

export function InterpretationPanel({ summary }: { summary: GaitSummary | null }) {
  const [text, setText] = useState<string | null>(null)
  const [modelUsed, setModelUsed] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const stored = loadKey()
  const hasKey = !!stored?.key

  // Se a análise mudar, limpa o texto anterior para não enganar.
  useEffect(() => {
    setText(null)
    setModelUsed(null)
    setError(null)
  }, [summary])

  const generate = async () => {
    if (!summary || !stored) return
    setLoading(true)
    setError(null)
    try {
      const res = await generateInterpretation(stored.key, loadModel(), buildPrompt(summary))
      setText(res.text)
      setModelUsed(res.modelUsed)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado.')
      setText(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="interpretation">
      <h3>Interpretação (IA)</h3>
      <p className="privacy-note">
        Ao gerar, é enviado para o Google (Gemini) um resumo numérico anónimo da marcha —
        nunca o vídeo nem imagens.
      </p>
      <button onClick={generate} disabled={!hasKey || !summary || loading}>
        {loading ? 'A interpretar…' : text ? 'Regenerar' : 'Gerar interpretação'}
      </button>
      {!hasKey && <p className="interpretation-hint">Configure a chave no Perfil.</p>}
      {error && <p className="error">{error}</p>}
      {text && (
        <div className="interpretation-text">
          <p>{text}</p>
          {modelUsed && <p className="model-used">gerado com {modelUsed}</p>}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Correr para confirmar que passa**

Run: `npx vitest run src/components/InterpretationPanel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/InterpretationPanel.tsx src/components/InterpretationPanel.test.tsx
git commit -m "feat: add interpretation panel"
```

---

## Task 8: Botão de Perfil no App

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Adicionar imports e estado**

No topo de `src/App.tsx`, juntar aos imports:
```tsx
import { ProfileModal } from './components/ProfileModal'
```
A seguir à linha `const [liveCadence, setLiveCadence] = useState<number | null>(null)`, adicionar:
```tsx
  const [profileOpen, setProfileOpen] = useState(false)
```

- [ ] **Step 2: Adicionar o botão e o modal no JSX**

Em `src/App.tsx`, localizar `<PedagogicalNotice />` e substituí-lo por:
```tsx
      <div className="header-row">
        <PedagogicalNotice />
        <button className="profile-button" onClick={() => setProfileOpen(true)}>
          ⚙️ Perfil
        </button>
      </div>
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
```

- [ ] **Step 3: Verificar compilação e testes**

Run: `npx tsc --noEmit && npm test`
Expected: sem erros; todos os testes passam (o App.test não referencia o Perfil).

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add profile button and modal to header"
```

---

## Task 9: Integrar InterpretationPanel no ClipReviewer

**Files:**
- Modify: `src/components/ClipReviewer.tsx`

- [ ] **Step 1: Adicionar imports**

Em `src/components/ClipReviewer.tsx`, juntar aos imports:
```tsx
import { buildSummary } from '../lib/gaitSummary'
import { InterpretationPanel } from './InterpretationPanel'
```

- [ ] **Step 2: Construir o resumo memoizado**

A seguir à linha `const obliquity = useMemo(() => pelvicObliquitySeries(clip.frames), [clip])`, adicionar:
```tsx
  const summary = useMemo(
    () => buildSummary(metrics, antalgic, rom, obliquity, operated, method),
    [metrics, antalgic, rom, obliquity, operated, method],
  )
```

- [ ] **Step 3: Renderizar o painel**

A seguir a `<TrendelenburgPanel obliquity={obliquity} currentTimeMs={timeMs} onSeek={seekTo} />`, adicionar:
```tsx
      <InterpretationPanel summary={summary} />
```

- [ ] **Step 4: Verificar compilação e testes**

Run: `npx tsc --noEmit && npm test`
Expected: sem erros; todos os testes passam.

- [ ] **Step 5: Commit**

```bash
git add src/components/ClipReviewer.tsx
git commit -m "feat: integrate interpretation panel into ClipReviewer"
```

---

## Task 10: Estilos

**Files:**
- Modify: `src/index.css` (acrescentar ao fim)

- [ ] **Step 1: Acrescentar estilos**

Adicionar ao fim de `src/index.css`:
```css
.header-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}

.profile-button {
  padding: 0.35rem 0.8rem;
  cursor: pointer;
  white-space: nowrap;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  background: #fff;
  color: #1a1a1a;
  border-radius: 8px;
  padding: 1.25rem;
  max-width: 420px;
  width: 90%;
  max-height: 90vh;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.modal label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.9rem;
}

.modal label.remember {
  flex-direction: row;
  align-items: center;
  gap: 0.4rem;
}

.modal input[type='password'],
.modal input[type='text'],
.modal select {
  padding: 0.4rem;
}

.modal-security {
  font-size: 0.8rem;
  color: #664d03;
  background: #fff3cd;
  border-radius: 6px;
  padding: 0.4rem 0.6rem;
}

.modal-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.test-result ul {
  list-style: none;
  padding-left: 0;
  margin: 0.25rem 0;
}

.interpretation {
  margin-top: 1.25rem;
}

.privacy-note {
  font-size: 0.85rem;
  color: #6b6375;
}

.interpretation-text {
  margin-top: 0.6rem;
  white-space: pre-wrap;
  background: #f7f7f9;
  border-radius: 6px;
  padding: 0.75rem;
}

.model-used {
  margin-top: 0.4rem;
  font-size: 0.8rem;
  color: #6b6375;
}
```

- [ ] **Step 2: Verificar o build**

Run: `npm run build`
Expected: build sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "style: add styling for profile modal and interpretation"
```

---

## Task 11: Validação manual (checklist)

Sem código. É preciso uma chave gratuita do Google AI Studio. Correr `npm run dev` e confirmar:

- [ ] **Perfil:** o botão "⚙️ Perfil" abre o modal; introduzir a chave e "Testar ligação" mostra ✓/✗ por modelo e "Ligação válida".
- [ ] **Guardar/lembrar:** com "lembrar" marcado, a chave persiste após recarregar; sem marcar, desaparece ao reabrir o separador; "Apagar chave" limpa.
- [ ] **Gerar interpretação:** num clip com métricas, "Gerar interpretação" produz um texto pedagógico em português com a etiqueta do modelo e a ressalva; "Regenerar" refaz.
- [ ] **Fallback:** com um modelo indisponível selecionado, a geração recai noutro e mostra o modelo efetivamente usado.
- [ ] **Erros:** chave inválida → "Chave rejeitada"; sem chave → botão desativado + dica.
- [ ] **Privacidade:** confirmar (no separador de rede do browser) que o corpo enviado ao Gemini só contém números/métricas — nunca vídeo, imagens ou landmarks.

Registar problemas como tarefas de correção antes de concluir.

---

## Notas de verificação do plano (self-review)

- **Cobertura da spec:** BYO key sem backend (todo o plano), apiKeyStore local/session + modelo (Task 2), resumo anónimo + prompt com ressalva (Task 3), listModels/teste (Task 4), generateInterpretation + fallback + erros (Task 5), ProfileModal com chave/instruções/link/seletor/teste/lembrar/apagar/aviso (Task 6), InterpretationPanel com desativação/carregamento/texto/erro/privacidade (Task 7), botão Perfil no cabeçalho (Task 8), integração no ClipReviewer com resumo (Task 9), estilos (Task 10). ✔️
- **Consistência de tipos:** `ModelChoice`, `StoredKey`, `ModelAvailability`, `ConnectionTestResult`, `InterpretationResult` (Task 1) usados coerentemente; `GaitSummary` definido em `gaitSummary.ts` (Task 3) e usado nas Tasks 7 e 9; `listModels(key, fetchImpl?)` e `generateInterpretation(key, modelChoice, prompt, fetchImpl?)` (Tasks 4-5) usados nos componentes (Tasks 6-7); `apiKeyStore` API (`saveKey`/`loadKey`/`clearKey`/`saveModel`/`loadModel`) consistente entre Task 2 e Tasks 6-7; `buildSummary(metrics, antalgic, rom, obliquity, operatedSide, method)` (Task 3) usado na Task 9 com os valores já calculados no ClipReviewer. ✔️
- **Fora de âmbito (não incluído):** backend/proxy, streaming, histórico, outros providers, multi-idioma. ✔️
