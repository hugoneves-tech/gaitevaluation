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
