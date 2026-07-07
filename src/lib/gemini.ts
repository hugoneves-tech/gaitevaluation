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
