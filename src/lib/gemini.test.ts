import { describe, it, expect, vi } from 'vitest'
import { listModels, generateInterpretation } from './gemini'

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

const okBody = (text: string) => ({
  candidates: [{ content: { parts: [{ text }] } }],
})

describe('generateInterpretation', () => {
  it('devolve o texto e o modelo no sucesso', async () => {
    const fetchImpl = vi.fn(async () => fakeRes(true, 200, okBody('olá')))
    const r = await generateInterpretation('abc', 'auto', 'prompt', fetchImpl as unknown as typeof fetch)
    expect(r.text).toBe('olá')
    expect(r.modelUsed).toBe('gemini-3.5-flash')
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
