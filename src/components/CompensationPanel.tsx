import type { AntalgicAssessment, JointRom, OperatedSide, RomResult } from '../types'

const deg = (v: number | null): string => (v === null ? '—' : `${Math.round(v)}°`)

export function CompensationPanel({
  antalgic,
  rom,
  operatedSide,
}: {
  antalgic: AntalgicAssessment
  rom: RomResult
  operatedSide: OperatedSide
}) {
  const nonOperatedSide = operatedSide === 'left' ? 'right' : 'left'
  const opRom: JointRom = rom[operatedSide]
  const nonRom: JointRom = rom[nonOperatedSide]

  const cell = (
    key: string,
    value: number | null,
    reduced: boolean,
  ) => (
    <td data-testid={key} className={reduced ? 'rom-reduced' : undefined}>
      {deg(value)}
    </td>
  )

  return (
    <div className="compensation">
      <h3>Sinais de compensação</h3>
      <p className={antalgic.flagged ? 'antalgic-flagged' : 'antalgic-ok'} role="status">
        {antalgic.message}
      </p>
      <table className="angle-panel">
        <thead>
          <tr>
            <th>Amplitude</th>
            <th>Operado</th>
            <th aria-label="Não operado">Não op.</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Anca</td>
            {cell('rom-operated-hip', opRom.hipDeg, opRom.hipReduced)}
            {cell('rom-nonOperated-hip', nonRom.hipDeg, nonRom.hipReduced)}
          </tr>
          <tr>
            <td>Joelho</td>
            {cell('rom-operated-knee', opRom.kneeDeg, opRom.kneeReduced)}
            {cell('rom-nonOperated-knee', nonRom.kneeDeg, nonRom.kneeReduced)}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
