import { describe, it, expect } from 'vitest'
import { createLiveCadence } from './liveCadence'

describe('createLiveCadence', () => {
  it('conta picos numa janela e devolve passos/min', () => {
    const cad = createLiveCadence(5000, 200)
    const values: number[] = []
    const step = [0.7, 0.9, 0.7]
    for (let k = 0; k < 12; k++) values.push(...step)
    let last: number | null = null
    let t = 0
    for (const v of values) {
      last = cad.push(v, t)
      t += 500 / step.length
    }
    expect(last).not.toBeNull()
    expect(last!).toBeGreaterThan(90)
    expect(last!).toBeLessThan(150)
  })

  it('devolve null antes de haver picos suficientes', () => {
    const cad = createLiveCadence(5000, 200)
    expect(cad.push(0.7, 0)).toBeNull()
  })
})
