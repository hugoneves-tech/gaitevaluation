# Camada de Interpretação com LLM (Gemini) — Design

**Data:** 2026-07-07
**Contexto:** Extensão da app de análise de marcha (ferramenta pedagógica para mestrados de
enfermagem de reabilitação). Gera uma interpretação em texto das métricas e sinais de
compensação já calculados, usando a Gemini API com a chave do próprio utilizador. **Não é
dispositivo médico.**

## Objetivo

A partir das métricas anónimas já calculadas (Fase 1 + Fase 2 A/B/C), gerar um texto
pedagógico que ajude o estudante a interpretar a marcha (padrão antálgico, redução de
amplitude, possível Trendelenburg), em linguagem clara e com ressalva educativa.

## Decisão de arquitetura: sem backend, chave do utilizador (BYO key)

A app mantém-se **100% client-side**. O browser chama a Gemini API diretamente com a chave
do próprio utilizador, gerida num modal de perfil. Sem servidor, sem infraestrutura nova.

**Privacidade:** só saem **números anónimos** (as métricas). Nunca o vídeo, imagens ou
landmarks — a promessa de "o vídeo nunca sai da máquina" mantém-se. O que vai para o Google
é um pequeno resumo estatístico sem identificação.

**Segurança da chave:** a chave fica no `localStorage`/`sessionStorage` do navegador. É a
chave gratuita do próprio utilizador; o modal avisa para usar chave própria e apagá-la em
computadores partilhados. Trade-off aceitável para uma ferramenta de ensino.

## Âmbito

### Este projeto
- Modal de perfil: introdução da chave, instruções + link, seletor de modelo, teste de
  ligação, lembrar/apagar.
- Serviço Gemini: `listModels` (teste + descoberta), `generateInterpretation` com fallback.
- Resumo anónimo das métricas + prompt pedagógico em português.
- Painel de interpretação no modo Rever (botão, estado de carregamento, texto, ressalva).

### Fora de âmbito (YAGNI)
Backend/proxy; streaming da resposta; histórico de interpretações; outros providers além do
Gemini; tradução multi-idioma.

## Modelos e fallback

Ordem preferida (constante editável): `gemini-3.5-flash` → `gemini-3.1-flash-lite` →
`gemini-2.5-flash`.

- **`listModels(key)`** — `GET https://generativelanguage.googleapis.com/v1beta/models?key=…`.
  200 → chave válida; cruza os modelos devolvidos que suportam `generateContent` com a ordem
  preferida e marca ✓/✗. 400/403 → chave inválida.
- **`generateInterpretation(key, modelChoice, prompt)`** —
  - `modelChoice === 'auto'`: percorre a ordem preferida e usa o primeiro com sucesso.
  - modelo específico: tenta esse; se 404/429, desce pela ordem preferida nos restantes.
  - Devolve `{ text, modelUsed }`.
- **Erros** mapeados para mensagem específica: chave em falta/ inválida, quota (429), nenhum
  modelo disponível, falha de rede.

## Ficheiros

Novos:
- `src/lib/apiKeyStore.ts` — puro: `saveKey(key, remember)`, `loadKey()`, `clearKey()`,
  `saveModel(choice)`, `loadModel()`. localStorage (remember) vs sessionStorage.
- `src/lib/gemini.ts` — serviço: `listModels`, `generateInterpretation`, fallback, mapeamento
  de erros. `fetch` injetável para teste.
- `src/lib/gaitSummary.ts` — puro: `buildSummary(...)` (JSON anónimo) e `buildPrompt(summary)`.
- `src/components/ProfileModal.tsx` — modal de perfil/definições.
- `src/components/InterpretationPanel.tsx` — botão + apresentação do texto.

Alterados:
- `src/App.tsx` — botão de acesso ao Perfil no cabeçalho; estado do modal.
- `src/components/ClipReviewer.tsx` — renderizar o `InterpretationPanel` a seguir aos painéis
  de compensação, passando o resumo das métricas.
- `src/types.ts` — tipos novos (ver abaixo).

## Tipos (adições a `types.ts`)

```ts
export type ModelChoice = 'auto' | string // 'auto' ou um id de modelo

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

## Serviço Gemini (`gemini.ts`)

- Endpoints:
  - Lista: `GET /v1beta/models?key=KEY`.
  - Geração: `POST /v1beta/models/{model}:generateContent?key=KEY` com corpo
    `{ contents: [{ parts: [{ text: prompt }] }] }`; a resposta lê-se em
    `candidates[0].content.parts[0].text`.
- `PREFERRED_MODELS = ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash']`.
- `listModels(key, fetchImpl = fetch): Promise<ConnectionTestResult>` — parse de
  `models[].name` (formato `models/<id>`) filtrando os que têm `generateContent` em
  `supportedGenerationMethods`; devolve disponibilidade dos preferidos.
- `generateInterpretation(key, modelChoice, prompt, fetchImpl = fetch): Promise<InterpretationResult>` —
  constrói a lista de tentativas (modelo escolhido primeiro, depois preferidos restantes; ou
  só preferidos se `auto`), tenta em sequência, devolve o primeiro sucesso; se todos falham,
  lança erro com a mensagem mapeada.

## Resumo e prompt (`gaitSummary.ts`)

- `buildSummary(metrics, antalgic, rom, obliquity, operatedSide, method)` → objeto simples só
  com números/flags/strings de configuração (sem landmarks, sem URLs de vídeo).
- `buildPrompt(summary)` → string em português: papel de assistente didático para enfermagem
  de reabilitação; pede interpretação das métricas (antálgica, ROM, possível Trendelenburg) em
  linguagem clara; termina **sempre** com ressalva de leitura educativa sobre medições 2D
  aproximadas, não diagnóstico. Inclui o resumo em JSON no corpo do prompt.

## UI/UX

**Cabeçalho (`App.tsx`):** botão "⚙️ Perfil" abre o `ProfileModal`.

**`ProfileModal`:**
- Campo da chave (password + mostrar/ocultar).
- Instruções + link `https://aistudio.google.com/apikey` e nota do nível gratuito.
- Seletor de modelo (opção "Automático (fallback)" + os preferidos).
- "Testar ligação" → `listModels`; mostra ✓/✗ por modelo e valida a chave.
- Checkbox "Lembrar chave neste dispositivo" (local vs session).
- "Apagar chave" (remove dos dois stores).
- Aviso de segurança sobre chave no navegador.

**`InterpretationPanel` (modo Rever, após compensação):**
- Nota de privacidade antes de gerar: envia-se um resumo numérico anónimo, nunca vídeo/imagens.
- Botão "Gerar interpretação" (desativado sem chave → dica para o Perfil).
- Estado "a interpretar…"; depois o texto + etiqueta "gerado com {modelo}" + ressalva.
- Botão "regenerar". Se método/lado/clip mudarem, o texto anterior é limpo (evitar enganar).

## Erros e casos-limite
- Sem chave → botão desativado + dica.
- Chave inválida (400/403) → "Chave rejeitada — verifique no Perfil."
- Quota (429) → "Limite do nível gratuito atingido — tente mais tarde."
- Nenhum modelo disponível/todos falharam → "Nenhum modelo Gemini disponível para esta chave."
- Falha de rede → "Sem ligação ao serviço Gemini."

## Testes
- **Unitários (Vitest, `fetch` mockado):**
  - `apiKeyStore`: local vs session conforme "lembrar"; ler; apagar remove dos dois.
  - `gaitSummary`: o resumo/prompt contêm os campos certos e **não** contêm vídeo/landmarks.
  - `gemini`: `listModels` faz parse e marca disponibilidade; `generateInterpretation` devolve
    texto no sucesso, faz fallback no 404/429, e mapeia cada erro para a mensagem certa.
- **Componente (RTL):** `ProfileModal` guarda/testa/apaga a chave; `InterpretationPanel`
  desativa sem chave, mostra carregamento e o texto/erro (com `gemini` mockado).
- **Manual:** com uma chave real do Google AI Studio, testar ligação, gerar interpretação e
  ver o fallback quando um modelo não está disponível.
