import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AnglePanel } from './AnglePanel'
import type { JointAngles } from '../types'

const angles: JointAngles = {
  hip: { left: 170.4, right: 168.9 },
  knee: { left: 155.2, right: null },
  ankle: { left: 90.0, right: 92.1 },
}

describe('AnglePanel', () => {
  it('mostra os ângulos arredondados a inteiro com o símbolo de grau', () => {
    render(<AnglePanel angles={angles} />)
    expect(screen.getByText('170°')).toBeInTheDocument()
    expect(screen.getByText('155°')).toBeInTheDocument()
  })

  it('mostra "—" quando o ângulo é null (baixa visibilidade)', () => {
    render(<AnglePanel angles={angles} />)
    expect(screen.getByTestId('knee-right')).toHaveTextContent('—')
  })
})
