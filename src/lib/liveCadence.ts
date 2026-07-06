/**
 * Contador de passos em streaming para o modo Ao Vivo.
 * Deteta máximos locais do sinal (altura do tornozelo) e conta os que caem
 * numa janela deslizante para estimar a cadência (passos/min).
 * @param windowMs largura da janela deslizante.
 * @param minGapMs intervalo mínimo entre picos (rejeita duplos).
 */
export function createLiveCadence(windowMs: number, minGapMs: number) {
  const peakTimes: number[] = []
  let p2: number | null = null
  let p1: number | null = null
  let t1 = 0

  return {
    /** Recebe uma amostra; devolve a cadência estimada (passos/min) ou null. */
    push(value: number, timeMs: number): number | null {
      if (p2 !== null && p1 !== null && p1 > p2 && p1 > value) {
        const last = peakTimes[peakTimes.length - 1]
        if (last === undefined || t1 - last >= minGapMs) peakTimes.push(t1)
      }
      p2 = p1
      p1 = value
      t1 = timeMs

      const cutoff = timeMs - windowMs
      while (peakTimes.length && peakTimes[0] < cutoff) peakTimes.shift()

      if (peakTimes.length < 2) return null
      return peakTimes.length * (60000 / windowMs)
    },
  }
}
