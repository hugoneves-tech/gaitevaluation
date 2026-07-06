import { describe, it, expect } from 'vitest'
import { createAngleSmoother } from './smoothing'

describe('createAngleSmoother', () => {
  it('devolve o primeiro valor tal como entra', () => {
    const s = createAngleSmoother(0.5)
    expect(s(100)).toBe(100)
  })

  it('aplica o filtro exponencial: novo = alpha*valor + (1-alpha)*anterior', () => {
    const s = createAngleSmoother(0.5)
    s(100)
    expect(s(200)).toBeCloseTo(150, 5)
  })

  it('propaga null sem alterar o estado anterior', () => {
    const s = createAngleSmoother(0.5)
    s(100)
    expect(s(null)).toBeNull()
    expect(s(200)).toBeCloseTo(150, 5)
  })
})
