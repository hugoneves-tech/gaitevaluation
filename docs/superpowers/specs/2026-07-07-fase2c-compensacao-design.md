# Fase 2 (C) — Sinais de Compensação (Design)

**Data:** 2026-07-07
**Contexto:** Sub-projeto C da Fase 2 da app de análise de marcha (ferramenta pedagógica
para mestrados de enfermagem de reabilitação). Acrescenta a interpretação de sinais de
compensação pós-artroplastia. Depende da Fase 1 (ângulos) e da Fase 2 A+B (eventos e
métricas). **Não é dispositivo médico.**

## Objetivo

Detetar/apoiar a leitura de três sinais de compensação: marcha antálgica e redução de
amplitude (ROM) na análise sagital existente, e o sinal de Trendelenburg por leitura
assistida da obliquidade pélvica numa vista coronal.

## Âmbito

### Este sub-projeto (C)
- **Antálgica:** flag interpretativo derivado das `GaitMetrics` (apoio do lado operado
  reduzido acima de um limiar).
- **Redução de ROM:** amplitude (máx−mín) da anca e do joelho por lado, a partir dos ângulos
  da Fase 1, com flag por limiar pedagógico.
- **Trendelenburg (leitura assistida):** série temporal da obliquidade pélvica + pico, com
  a linha das ancas desenhada no esqueleto; a interpretação é do estudante.

### Fora de âmbito (YAGNI)
Deteção automática do apoio unipodal em vista coronal; normas clínicas reais de ROM (usam-se
limiares pedagógicos); gestão de múltiplos clips/vistas em simultâneo.

## Limiares (pedagógicos, documentados — não são normas clínicas)
- **Antálgica:** apoio do lado operado menor que o não operado E índice de simetria ≥ **10%**.
- **ROM reduzida:** amplitude da **anca < 30°** ou do **joelho < 45°**.

## Coexistência de vistas (sem gestão de clips nova)

O mesmo `ClipReviewer` mostra todos os painéis. Num clip **sagital**, as métricas da Fase 2
e a antálgica/ROM fazem sentido; o painel de Trendelenburg mostra a sua nota de vista
coronal. Num clip **coronal**, a obliquidade pélvica é significativa e as métricas sagitais
mostram o aviso de "passos insuficientes" já existente. Cada painel tem a sua nota de
enquadramento; nenhum tenta adivinhar a vista. O estudante grava o clip da vista que quer
analisar.

## Arquitetura

Lógica pura em `src/lib/compensation.ts`, testável isoladamente. Componentes de
apresentação novos no modo Rever. Reutiliza `computeAngles` (Fase 1) e `GaitMetrics`
(Fase 2).

### Ficheiros
Novos:
- `src/lib/compensation.ts` — puro: `assessAntalgic`, `computeRom`, `pelvicObliquitySeries`.
- `src/components/CompensationPanel.tsx` — antálgica + ROM (sagital).
- `src/components/TrendelenburgPanel.tsx` — obliquidade pélvica + pico (coronal).

Alterados:
- `src/types.ts` — novos tipos (ver abaixo).
- `src/components/SkeletonOverlay.tsx` — desenhar a linha das ancas (23–24).
- `src/components/ClipReviewer.tsx` — integrar os dois painéis; passar o tempo atual ao
  `TrendelenburgPanel` e o "ir para o pico".

## Tipos (adições a `types.ts`)

```ts
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
  angleDeg: number | null // null se ancas pouco visíveis
}

export interface PelvicObliquity {
  series: ObliquitySample[]
  peakDeg: number | null   // maior |ângulo| fiável
  peakTimeMs: number | null
}
```

## Medidas

### Antálgica — `assessAntalgic(metrics: GaitMetrics): AntalgicAssessment`
- Se `metrics.operated.stanceMs` ou `nonOperated.stanceMs` for null, ou
  `symmetryIndexPct` null → `evaluable: false`, mensagem "Não avaliável — sem métricas de
  apoio suficientes".
- Senão, `flagged = operated.stanceMs < nonOperated.stanceMs && symmetryIndexPct >= 10`.
- Mensagem quando flagged: "⚠️ Apoio do lado operado reduzido em {round(symmetryIndexPct)}%
  — sugestivo de padrão antálgico." Caso contrário: "Sem assimetria de apoio relevante."

### ROM — `computeRom(frames: RecordedFrame[], minVisibility = 0.5): RomResult`
- Por lado, para cada frame corre `computeAngles(frame.landmarks, minVisibility)` e recolhe
  os valores não-null da anca e do joelho.
- Amplitude = máx − mín dos valores recolhidos; se houver < 2 valores fiáveis → null.
- `hipReduced = hipDeg !== null && hipDeg < 30`; `kneeReduced = kneeDeg !== null && kneeDeg < 45`.

### Obliquidade pélvica — `pelvicObliquitySeries(frames, minVisibility = 0.5): PelvicObliquity`
- Por frame: se as ancas 23 e 24 tiverem visibilidade ≥ limiar,
  `angleDeg = atan2(hipR.y − hipL.y, hipR.x − hipL.x) * 180/π`; senão null.
  (0° = pélvis nivelada; sinal indica que lado desce.)
- `peakDeg` = maior `|angleDeg|` entre as amostras fiáveis; `peakTimeMs` = o seu tempo.
- Se não houver amostras fiáveis → `peakDeg`/`peakTimeMs` null.

## UI/UX (modo Rever)

A seguir ao `GaitMetricsPanel`:

**`CompensationPanel`** (usa `operatedSide` já selecionado):
- Linha da antálgica com o veredito (destacado se flagged).
- Tabela de ROM: amplitude da anca e do joelho por lado (operado/não operado), célula
  destacada se abaixo do limiar; "—" se não fiável.

**`TrendelenburgPanel`** (recebe a série, o tempo atual e um `onSeek`):
- Nota: "Para o Trendelenburg, filme de frente (vista coronal) o doente a caminhar na sua
  direção."
- Obliquidade no frame atual (do `timeMs`) e o pico ao longo do clip, com botão "ir para o
  pico" (`onSeek(peakTimeMs)`).

**`SkeletonOverlay`**: desenhar a linha entre as ancas (23–24) quando ambas visíveis, para
visualizar a inclinação.

## Erros e casos-limite
- **Antálgica não avaliável:** mensagem clara em vez de veredito falso.
- **ROM com poucos frames fiáveis:** "—" e nota de qualidade insuficiente.
- **Obliquidade com ancas pouco visíveis:** "—" no frame; o pico ignora frames não fiáveis.
- **Vista errada:** cada painel tem a sua nota de enquadramento; degradam com honestidade.

## Testes
- **Unitários (Vitest) — lógica pura:**
  - `assessAntalgic`: apoio operado reduzido acima/abaixo do limiar → flagged/não; métricas
    nulas → não avaliável.
  - `computeRom`: frames com amplitude conhecida de anca/joelho → amplitude e flags corretas;
    frames de baixa visibilidade ignorados.
  - `pelvicObliquitySeries`: ancas a alturas dadas → ângulo, sinal e pico corretos;
    frame com baixa visibilidade → null.
- **Componente (RTL):** `CompensationPanel` mostra o veredito antálgico e destaca ROM abaixo
  do limiar; `TrendelenburgPanel` mostra obliquidade/pico e aciona `onSeek` no "ir para o pico".
- **Manual:** clip coronal real → ver a linha das ancas inclinar no apoio unipodal e ler o pico.
