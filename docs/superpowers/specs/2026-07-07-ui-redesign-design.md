# Redesenho Visual e Modo Câmara — Design

**Data:** 2026-07-07
**Contexto:** A app de análise de marcha funciona, mas a interface é básica e pouco apelativa.
Este projeto é um **redesenho visual** (não muda a lógica) ao estilo Google AI Studio, com
tema automático (claro/escuro) e um modo câmara em ecrã inteiro para gravar clips no
telemóvel/tablet. Referência do utilizador: Google AI Studio.

## Objetivo

Tornar a app visualmente moderna e coerente, com o vídeo como protagonista e uma experiência
"de câmara" no modo Ao Vivo (comandos e métricas sobrepostos, ecrã inteiro), mantendo todo o
comportamento funcional atual.

## Âmbito

### Este projeto (só apresentação)
- Sistema de tokens de tema (claro + escuro via `prefers-color-scheme`).
- Shell da app (cabeçalho, separadores em pílula).
- Modo Ao Vivo centrado no vídeo, com chips de métricas e barra de comandos de câmara.
- Modo câmara em ecrã inteiro (Fullscreen API + fallback CSS).
- Modo Rever com painéis em cartões consistentes.
- Modal de Perfil restilizado.

### Fora de âmbito (YAGNI)
Temas personalizáveis além de claro/escuro; animações elaboradas; nova identidade/logótipo
(basta um ícone simples); qualquer alteração de lógica (pose, métricas, eventos, Gemini).

### Invariante
Toda a lógica em `src/lib/` e `src/hooks/` (exceto o novo `useFullscreen`) e o comportamento
funcional mantêm-se. **Todos os testes existentes têm de continuar verdes.**

## Sistema de design (tokens)

Novo `src/theme.css` importado no topo (antes de `index.css`), com variáveis CSS para os dois
modos:
- **Superfícies:** `--bg` (página), `--surface` (cartão), `--surface-2` (elevado), com valores
  grafite no escuro e branco/cinza-claro no claro.
- **Texto:** `--text`, `--text-muted`.
- **Acento:** `--accent` (azul AI-Studio), `--accent-contrast`.
- **Semânticos:** `--danger`, `--success`, `--warning` (+ variantes de fundo).
- **Traço/raio/espaço:** `--border`, `--radius` (10px controlos), `--radius-card` (14px),
  `--shadow` subtil.
- **Lados da marcha** (mantêm-se): esquerdo `#2ecc71`, direito `#e74c3c`.

`prefers-color-scheme: dark` redefine as superfícies/texto. Os componentes deixam de usar
cores fixas e passam a estes tokens.

## Componentes

Novos (apresentação, sem lógica de domínio salvo indicado):
- `src/components/AppHeader.tsx` — logótipo/título + botão Perfil.
- `src/components/ModeTabs.tsx` — separadores Ao Vivo/Rever em pílula.
- `src/components/Card.tsx` — wrapper de cartão (título opcional + filhos).
- `src/components/MetricChips.tsx` — chips de métricas sobre o vídeo (ângulos esq/dir,
  cadência); "—" quando null.
- `src/components/CameraStage.tsx` — junta `<video>` (via ref recebido), `SkeletonOverlay`,
  `MetricChips` e a barra de comandos (gravar/parar, rodar câmara, ecrã inteiro). Reutilizado
  em janela e em ecrã inteiro.
- `src/hooks/useFullscreen.ts` — **com lógica**: entra/sai de fullscreen (Fullscreen API +
  fallback de estado), expõe `{ isFullscreen, toggle, ref }`.

Alterados:
- `src/App.tsx` — usa `AppHeader`, `ModeTabs`, `CameraStage`; mantém o loop de pose e os
  estados; passa props ao `CameraStage`.
- `src/components/ClipReviewer.tsx` — painéis embrulhados em `Card`; controlos em barra;
  seletores em pílula.
- `src/components/GaitMetricsPanel.tsx`, `CompensationPanel.tsx`, `TrendelenburgPanel.tsx`,
  `InterpretationPanel.tsx`, `AnglePanel.tsx` — usar `Card`/tokens (ajuste de classes; sem
  mudar comportamento nem `data-testid`).
- `src/components/ProfileModal.tsx`, `DetectionProfileBar.tsx`, `OperatedSideSelector.tsx` —
  reestilizar com tokens/pílulas.
- `src/index.css` — passa a conter só o específico dos componentes, referenciando os tokens.

## useFullscreen (interface)

```ts
export function useFullscreen<T extends HTMLElement>(): {
  ref: React.RefObject<T>
  isFullscreen: boolean
  toggle: () => void
}
```
- `toggle()`: se não está em fullscreen, tenta `ref.current.requestFullscreen()`; se o método
  não existir, ativa o fallback (estado `isFullscreen = true`, o contentor recebe classe
  `.stage-fullscreen` com `position: fixed; inset: 0`). Se está, `document.exitFullscreen()` ou
  desativa o fallback.
- Ouve `fullscreenchange` para sincronizar `isFullscreen` quando a API é usada (ex.: sair com
  Esc). O fallback também sai com Esc (listener de teclado) e com o botão.

## CameraStage (interface)

```ts
interface CameraStageProps {
  videoRef: React.Ref<HTMLVideoElement>
  frame: PoseFrame | null
  angles: JointAngles
  liveCadence: number | null
  facingMode: 'user' | 'environment'
  recording: boolean
  recordingSeconds: number
  onToggleRecording: () => void
  onSwitchCamera: () => void
}
```
- Renderiza o `<video>` (o `App` liga a câmara via o `CameraView` atual ou o `videoRef`),
  o `SkeletonOverlay`, os `MetricChips` (de `angles`/`liveCadence`) e a barra de comandos.
- O botão de ecrã inteiro vem do `useFullscreen` aplicado ao contentor do stage.
- Indicador REC + `recordingSeconds` quando `recording`.
- Rodar câmara desativado durante a gravação.

Nota de integração: o `App` mantém o `CameraView` (que gere o stream e erros) dentro do
`CameraStage`, ou passa o `videoRef`; o plano define o encaixe exato preservando o
`data-testid="camera-view"` mockado nos testes.

## Modo Rever

- Vídeo do clip com o mesmo tratamento visual; controlos (quadro-a-quadro, câmara lenta) numa
  barra consistente.
- Painéis (`GaitMetricsPanel`, `CompensationPanel`, `TrendelenburgPanel`,
  `InterpretationPanel`, `AnglePanel`) em `Card`.
- `DetectionProfileBar` e `OperatedSideSelector` em segmentos-pílula.

## Erros e casos-limite
- **Fullscreen recusado/indisponível** (ex.: iOS) → fallback CSS a 100%; documentado.
- **Legibilidade em modo escuro** → todos os pares texto/fundo saem de tokens; validado nos
  dois modos.
- **Métricas nulas nos chips** → "—" (mesma regra do `AnglePanel`).
- Comportamentos de erro existentes (câmara, chave Gemini, etc.) mantêm-se.

## Testes
- **Regressão:** toda a suite atual continua verde; rótulos/`data-testid` consultados pelos
  testes são preservados.
- **Novos (Vitest/RTL):**
  - `useFullscreen`: alterna `isFullscreen` no fallback; chama `requestFullscreen`/
    `exitFullscreen` quando existem (mockados).
  - `MetricChips`: mostra valores e "—" com null.
  - `Card`: renderiza título e filhos.
- **Visual (browser):** capturas em claro e escuro, viewport de telemóvel e tablet — shell,
  chips, barra de comandos, e ecrã inteiro.
