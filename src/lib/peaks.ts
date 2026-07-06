/**
 * Índices dos máximos locais estritos de `values`, excluindo as extremidades.
 * Picos separados por menos de `minGapMs` são fundidos, mantendo o mais alto.
 * Para vales, negar o sinal antes de chamar.
 */
export function findPeaks(values: number[], times: number[], minGapMs: number): number[] {
  const raw: number[] = []
  for (let i = 1; i < values.length - 1; i++) {
    if (values[i] > values[i - 1] && values[i] > values[i + 1]) raw.push(i)
  }
  const kept: number[] = []
  for (const idx of raw) {
    const last = kept[kept.length - 1]
    if (last !== undefined && times[idx] - times[last] < minGapMs) {
      if (values[idx] > values[last]) kept[kept.length - 1] = idx
    } else {
      kept.push(idx)
    }
  }
  return kept
}
