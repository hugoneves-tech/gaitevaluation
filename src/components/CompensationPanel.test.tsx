import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CompensationPanel } from './CompensationPanel'
import type { AntalgicAssessment, RomResult } from '../types'

const antalgic: AntalgicAssessment = {
  evaluable: true,
  flagged: true,
  message: '⚠️ Apoio do lado operado reduzido em 18% — sugestivo de padrão antálgico.',
}

const rom: RomResult = {
  left: { hipDeg: 25, kneeDeg: 40, hipReduced: true, kneeReduced: true },
  right: { hipDeg: 35, kneeDeg: 55, hipReduced: false, kneeReduced: false },
}

describe('CompensationPanel', () => {
  it('mostra o veredito antálgico', () => {
    render(<CompensationPanel antalgic={antalgic} rom={rom} operatedSide="left" />)
    expect(screen.getByText(/antálgico/i)).toBeInTheDocument()
  })

  it('destaca a ROM abaixo do limiar do lado operado', () => {
    render(<CompensationPanel antalgic={antalgic} rom={rom} operatedSide="left" />)
    expect(screen.getByTestId('rom-operated-knee')).toHaveClass('rom-reduced')
    expect(screen.getByTestId('rom-nonOperated-knee')).not.toHaveClass('rom-reduced')
  })
})
