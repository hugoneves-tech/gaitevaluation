import type { AngleValue } from '../types'

/**
 * Cria um filtro exponencial com memória para um único ângulo.
 * @param alpha peso do valor novo (0..1). Maior = menos suavização.
 * @returns função que recebe o valor atual e devolve o valor suavizado.
 *          null é propagado e não altera o estado.
 */
export function createAngleSmoother(alpha: number): (value: AngleValue) => AngleValue {
  let previous: number | null = null
  return (value: AngleValue): AngleValue => {
    if (value === null) return null
    if (previous === null) {
      previous = value
      return value
    }
    previous = alpha * value + (1 - alpha) * previous
    return previous
  }
}
