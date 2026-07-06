# Fase 2 (A+B) — Eventos do Ciclo de Marcha e Simetria/Cadência (Design)

**Data:** 2026-07-06
**Contexto:** Sub-projeto A+B da Fase 2 da app de análise de marcha (ferramenta pedagógica
para mestrados de enfermagem de reabilitação; ver
[MVP design](2026-07-06-analise-marcha-video-design.md)). Detetar os eventos do ciclo de
marcha e, a partir deles, calcular métricas de simetria e cadência. **Não é dispositivo
médico.**

## Objetivo

Sobre um clip gravado (que já contém os landmarks e timestamps de todos os frames),
detetar os eventos de marcha (contacto inicial e toe off) por um de três métodos
selecionáveis, e derivar métricas temporais e um índice de simetria entre a perna operada
e a não operada. Adicionalmente, mostrar uma cadência aproximada em tempo real no modo
Ao Vivo.

## Âmbito

### Este sub-projeto (A+B)
- Deteção de eventos por 3 métodos algorítmicos leves, selecionáveis numa barra de perfil.
- Métricas temporais (apoio, balanço, passo, rácio), cadência e índice de simetria.
- Marcação da perna operada pelo utilizador; métricas rotuladas operado/não operado.
- Marcadores de evento na timeline do modo Rever.
- Cadência aproximada em tempo real no modo Ao Vivo.

### Fora de âmbito (sub-projeto C, desenhado para encaixar, NÃO construído)
Trendelenburg (vista coronal), deteção dedicada de marcha antálgica, redução de amplitude
como sinal autónomo. O índice de simetria do lado operado já aponta o caminho para C.

### Fora de âmbito (YAGNI)
Modelo de deteção de eventos treinado (ML) — exigiria dados etiquetados e treino; a barra
de perfil fica preparada para receber um perfil adicional no futuro. Velocidade absoluta da
passada (exige calibração métrica indisponível numa câmara 2D única).

## Arquitetura

A análise pesada é **lógica pura** sobre o array `RecordedFrame[]` do clip (sem React, sem
rede), testável isoladamente.

```
Clip (RecordedFrame[])
      │
      ▼
gaitEvents.ts  ── método (Zeni | Velocidade | Distância) + direção ──►  GaitEvent[]
      │                                                                  (heelStrike/toeOff, lado, timeMs)
      ▼
gaitMetrics.ts ── + lado operado ──►  GaitMetrics
      │
      ▼
GaitMetricsPanel  +  marcadores de evento na timeline do ClipReviewer
```

No modo Ao Vivo, `liveCadence.ts` (contador de passos em streaming) mostra cadência
aproximada em tempo real.

### Ficheiros
Novos:
- `src/lib/gaitEvents.ts` — puro: `detectEvents(frames, method, direction)` → `GaitEvent[]`;
  contém as 3 estratégias e um utilitário comum de deteção de picos/vales.
- `src/lib/gaitMetrics.ts` — puro: `computeMetrics(events, operatedSide)` → `GaitMetrics`.
- `src/lib/liveCadence.ts` — puro/stateful: detetor de passos em streaming.
- `src/components/DetectionProfileBar.tsx` — seletor dos 3 métodos.
- `src/components/OperatedSideSelector.tsx` — seletor da perna operada.
- `src/components/GaitMetricsPanel.tsx` — mostra as métricas rotuladas operado/não operado.

Alterados:
- `src/types.ts` — novos tipos (ver abaixo).
- `src/components/ClipReviewer.tsx` — barra de perfil, seletor de lado, painel de métricas,
  marcadores de evento na timeline, nota de enquadramento.
- `src/App.tsx` — cadência aproximada em tempo real no modo Ao Vivo.

## Tipos (adições a `types.ts`)

```ts
export type GaitEventMethod = 'coordinate' | 'verticalVelocity' | 'ankleDistance'
export type Side = 'left' | 'right'
export type OperatedSide = Side
export type GaitEventType = 'heelStrike' | 'toeOff'

export interface GaitEvent {
  timeMs: number
  side: Side
  type: GaitEventType
}

export interface SideMetrics {
  stanceMs: number | null   // tempo de apoio médio
  swingMs: number | null    // tempo de balanço médio
  stepMs: number | null     // tempo de passo médio (contralateral)
  stanceSwingRatio: number | null
}

export interface GaitMetrics {
  cadenceStepsPerMin: number | null
  cyclesDetected: number
  operated: SideMetrics
  nonOperated: SideMetrics
  symmetryIndexPct: number | null  // sobre o tempo de apoio; 0 = simétrico
}
```

## Deteção de eventos

**Passo comum — direção da marcha:** a partir da deslocação horizontal global da anca ao
longo do clip, determina-se se a passagem é esquerda→direita ou direita→esquerda, para
orientar os sinais. Se a deslocação for quase nula, é sinalizado como não analisável
(ver Erros).

**Utilitário comum de picos/vales:** deteta máximos/mínimos locais de um sinal 1D, com uma
distância mínima entre eventos (em ms) para rejeitar duplos espúrios. Partilhado pelos 3
métodos; testado isoladamente.

**Método 1 — Coordenadas (Zeni et al., 2008):** por lado, sinal `s(t) = ankleₓ − hipₓ`
(orientado pela direção da marcha). Contacto inicial nos **máximos** de `s`; toe off nos
**mínimos**.

**Método 2 — Velocidade vertical do pé:** sinal `ankle_y(t)`. Contacto inicial quando o pé,
ao descer, atinge o ponto mais baixo (velocidade vertical cruza de negativa para ~0); toe
off quando começa a subir (velocidade passa a positiva).

**Método 3 — Distância entre tornozelos:** sinal `d(t) = |ankleₓ_E − ankleₓ_D|`. Máximos de
`d` marcam o contacto inicial; o pé da frente nesse instante recebe o heel strike.

Todos devolvem heurísticas 2D aproximadas; a barra de perfil expõe deliberadamente as
divergências entre métodos (valor pedagógico).

## Métricas

Derivadas dos eventos. Com múltiplos ciclos, cada métrica é a média dos ciclos (e reporta-se
`cyclesDetected`).

- **Apoio (stance):** contacto inicial → toe off do mesmo pé.
- **Balanço (swing):** toe off → contacto inicial seguinte do mesmo pé.
- **Passo (step):** contacto inicial de um pé → contacto inicial do pé contrário.
- **Rácio apoio/balanço** por lado.
- **Cadência** = (nº de passos ÷ tempo total) × 60 passos/min.
- **Índice de simetria** (sobre o tempo de apoio):

  `SI = |apoio_operado − apoio_não_operado| / (½·(apoio_operado + apoio_não_operado)) × 100 %`

  0% = simetria perfeita. Como o utilizador marca a perna operada, o painel rotula
  operado/não operado; apoio reduzido no lado operado sugere padrão antálgico (ponte para C).

## Cadência ao vivo

`liveCadence.ts` recebe, frame a frame no modo Ao Vivo, um sinal de passo (posição vertical
do tornozelo) e mantém um detetor de picos numa janela deslizante (trailing ~N s). Conta os
picos na janela → cadência aproximada. Exibida com etiqueta "aproximada" para a distinguir
do valor rigoroso do clip.

## UI/UX

**Modo Rever:**
- `DetectionProfileBar`: três segmentos (Coordenadas · Velocidade · Distância); trocar
  recalcula eventos e métricas (memoizado).
- `OperatedSideSelector`: Esquerda / Direita.
- Marcadores de evento na timeline do vídeo: traços por lado (verde=esq., vermelho=dir.),
  contacto inicial e toe off; alinham com o avanço quadro-a-quadro.
- `GaitMetricsPanel`: apoio/balanço/passo por lado (rotulados operado/não operado), rácio,
  cadência, nº de ciclos, índice de simetria em destaque.
- Nota de enquadramento fixa: "Para esta análise, filme de lado (plano sagital) o doente a
  caminhar vários passos a atravessar o enquadramento."

**Modo Ao Vivo:** cadência aproximada (passos/min) em tempo real, com etiqueta "aproximada".

## Erros e casos-limite
- **Passos insuficientes (< 2 ciclos):** painel mostra "Não foram detetados passos
  suficientes — filme uma passagem a caminhar de lado, com vários passos." em vez de
  métricas.
- **Deslocação global ~nula:** avisa que precisa de vista sagital com deslocação (pessoa
  parada ou a andar na direção da câmara não é analisável).
- **Muitos frames de baixa visibilidade** (tornozelos/ancas): ignorados na deteção; se em
  excesso, avisa qualidade insuficiente.
- **Divergência entre métodos:** não é erro; cada perfil mostra os seus eventos.

## Testes
- **Unitários (Vitest) — lógica pura (núcleo de valor):**
  - `gaitEvents.ts`: para cada método, sinal sintético de landmarks com eventos em instantes
    conhecidos → eventos detetados nos frames certos (dentro de tolerância). Utilitário de
    picos/vales testado à parte (rejeita duplos próximos).
  - `gaitMetrics.ts`: lista de eventos conhecida → cadência, apoio, balanço, rácio e índice
    de simetria com valores calculados à mão.
  - `liveCadence.ts`: sinal de passos sintético em streaming → cadência esperada.
- **Componente (RTL):** `GaitMetricsPanel` rotula operado/não operado e mostra aviso de
  passos insuficientes; `DetectionProfileBar` troca método; `OperatedSideSelector` alterna.
- **Manual:** validar com um clip real de marcha em vista sagital; comparar os 3 perfis.
