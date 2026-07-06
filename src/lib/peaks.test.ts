import { describe, it, expect } from 'vitest'
import { findPeaks } from './peaks'

const times = (n: number, stepMs = 100) =>
  Array.from({ length: n }, (_, i) => i * stepMs)

describe('findPeaks', () => {
  it('encontra máximos locais estritos', () => {
    const v = [0, 1, 0, 1, 2, 1, 0]
    expect(findPeaks(v, times(v.length), 0)).toEqual([1, 4])
  })

  it('ignora as extremidades', () => {
    const v = [5, 1, 0, 1, 5]
    expect(findPeaks(v, times(v.length), 0)).toEqual([])
  })

  it('funde picos demasiado próximos mantendo o mais alto', () => {
    const v = [0, 1, 0, 2, 0]
    expect(findPeaks(v, times(v.length), 250)).toEqual([3])
  })
})
