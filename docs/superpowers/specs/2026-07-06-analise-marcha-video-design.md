# Análise de Marcha em Vídeo — Ferramenta Pedagógica (Design)

**Data:** 2026-07-06
**Contexto:** Ferramenta de aprendizagem para estudantes de mestrado em enfermagem de
reabilitação. Objetivo pedagógico — ensinar a observar e analisar a marcha de doentes
pós-artroplastia da coxofemoral. **Não é dispositivo médico** nem se destina a decisão clínica.

## Objetivo

App web que, a partir de vídeo (câmara ao vivo ou clip gravado), deteta as articulações
do corpo e mostra a marcha com o esqueleto sobreposto e os ângulos articulares em tempo
real, permitindo depois rever um clip quadro-a-quadro em câmara lenta para análise.

## Âmbito

### MVP (esta especificação)
- Câmara ao vivo no browser com esqueleto e ângulos anca/joelho/tornozelo (esq. e dir.)
  em tempo real.
- Gravar um clip curto e revê-lo com controlo de tempo, avanço quadro-a-quadro e câmara
  lenta, com esqueleto e ângulos sincronizados.
- Aviso pedagógico permanente sobre as limitações da medição 2D.

### Fase 2 (desenhado para encaixar, NÃO construído agora)
- Simetria e cadência (lado operado vs. não operado; comprimento do passo, tempo de apoio).
- Deteção de fases do ciclo de marcha (apoio, balanço, contacto inicial, etc.).
- Sinais de compensação (marcha antálgica, Trendelenburg, redução de amplitude, assimetria
  de braços).

### Fora de âmbito (YAGNI)
Contas de utilizador, base de dados, exportação de relatórios, comparação entre sessões,
backend/servidor.

## Arquitetura

Aplicação **web estática, 100% no browser**, sem servidor nem backend. O vídeo do doente
**nunca sai da máquina** — privacidade garantida sem infraestrutura.

```
Câmara / Vídeo  ──►  MediaPipe Pose  ──►  Landmarks (33 pontos)
                                              │
              ┌───────────────────────────────┼───────────────────────────────┐
              ▼                                ▼                               ▼
        Cálculo de ângulos           Desenho do esqueleto              Gravador de clip
              │                                │                               │
              └────────────────────────────────┴───────────────────────────────┘
                                              ▼
                            Ecrã (vídeo + overlay + valores)
```

### Stack
- **React + Vite + TypeScript**
- **@mediapipe/tasks-vision** (Pose Landmarker) — 33 landmarks incl. anca, joelho,
  tornozelo, pé; corre no browser via WebGL/WASM; ~30 fps; on-device.
- **Canvas HTML5** para o esqueleto e arcos de ângulo sobre o `<video>`.
- **MediaRecorder API** para gravar o clip localmente.

### Escolha do motor de pose
MediaPipe Pose Landmarker foi escolhido face a MoveNet (só 17 pontos, sem pé/profundidade)
e BlazePose/TF.js (API mais antiga), pela cobertura articular do tornozelo/pé — essencial
para os ângulos e para a Fase 2 — e por ser o mais mantido.

## Componentes

| Componente | Responsabilidade | Depende de |
|---|---|---|
| `usePoseEngine` (hook) | Carrega o MediaPipe, recebe frames, devolve landmarks por frame. Sem UI. | @mediapipe/tasks-vision |
| `CameraView` | Mostra vídeo ao vivo ou clip gravado num `<video>`. | — |
| `SkeletonOverlay` | Desenha esqueleto e arcos de ângulo no `<canvas>` sobre o vídeo. | landmarks |
| `angles.ts` (lógica pura) | Calcula ângulos da anca, joelho, tornozelo a partir de 3 pontos. Sem React, 100% testável. | — |
| `smoothing.ts` (lógica pura) | Suavizador dos ângulos (média móvel / filtro exponencial). Configurável e testável. | — |
| `AnglePanel` | Mostra valores numéricos em tempo real (anca/joelho/tornozelo, esq./dir.). | angles |
| `ClipRecorder` (hook) | Grava clip via MediaRecorder e guarda os landmarks frame-a-frame em paralelo. | MediaRecorder |
| `ClipReviewer` | Reprodução do clip com barra de tempo, avanço quadro-a-quadro e câmara lenta, esqueleto e ângulos sincronizados. | landmarks guardados |
| `App` | Alterna entre modo **Ao Vivo** e **Rever**; liga tudo. | todos |

**Princípio-chave:** a matemática dos ângulos (`angles.ts`) é lógica pura e isolada —
recebe pontos, devolve graus. É onde está o valor didático e onde os testes têm de ser
sólidos, sem depender de câmara nem de React.

## Fluxo de dados

**Por frame (modo Ao Vivo):**
1. O `<video>` fornece um frame → `usePoseEngine` passa-o ao MediaPipe.
2. MediaPipe devolve 33 landmarks normalizados (x, y, z, visibilidade).
3. `angles.ts` calcula os ângulos a partir de trios de pontos.
4. `SkeletonOverlay` desenha; `AnglePanel` mostra os números. Repete a ~30 fps.

**Modo Rever:** durante a gravação guardam-se os landmarks já calculados (leve, rápido)
em vez de re-processar o vídeo depois → revisão instantânea e suave.

## Definição dos ângulos (vista sagital)

Cada ângulo é o ângulo entre dois segmentos que partilham a articulação, obtido pelo
`arccos` do produto escalar dos dois vetores normalizados (determinístico e testável):
- **Joelho:** anca–joelho–tornozelo. 180° = perna reta; menos = flexão.
- **Anca:** ombro–anca–joelho.
- **Tornozelo:** joelho–tornozelo–pé.

**Suavização:** filtro ligeiro (média móvel curta ou exponencial) aplicado aos ângulos
antes de mostrar, para reduzir o tremor dos landmarks. Configurável.

**Esquerdo/direito:** o MediaPipe rotula os lados; mostram-se ambos em simultâneo com cores
distintas, preparando a métrica de simetria da Fase 2 sem a implementar agora.

## Erros e casos-limite
- **Sem permissão/câmara:** mensagem clara + alternativa de carregar ficheiro de vídeo.
- **Baixa visibilidade de um landmark:** o ângulo aparece a cinzento/"—" em vez de valor
  errado. Honestidade > número falso.
- **Desempenho fraco (fps baixo):** aviso discreto a sugerir menor resolução; degradação
  suave (baixa a taxa de processamento) em vez de bloquear.
- **Aviso pedagógico permanente e visível:** "medições 2D no plano sagital; aproximações
  para fins de ensino, não para decisão clínica".

## Limitação assumida (e lição pedagógica)
Uma câmara única dá medidas **2D no plano sagital**. São ótimas para ensino mas são
aproximações — ângulos e comprimentos reais exigem sistemas multi-câmara. A app torna
isto explícito aos estudantes, o que é em si uma lição.

## Testes
- **Unitários (Vitest)** sobre `angles.ts` e `smoothing.ts` — o núcleo de valor. Casos com
  pontos conhecidos: perna reta = 180°, ângulo reto = 90°, etc. Blindado.
- **Componente (React Testing Library):** `AnglePanel` mostra "—" com baixa visibilidade;
  lógica de alternância Ao Vivo/Rever.
- **Manual:** câmara/MediaPipe validam-se por checklist e, idealmente, 1–2 vídeos de marcha
  de referência para regressão visual.
