import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DetectionProfileBar } from './DetectionProfileBar'

describe('DetectionProfileBar', () => {
  it('marca o método ativo e chama onChange ao clicar noutro', () => {
    const onChange = vi.fn()
    render(<DetectionProfileBar value="coordinate" onChange={onChange} />)
    const ativo = screen.getByRole('button', { name: /coordenadas/i })
    expect(ativo).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: /velocidade/i }))
    expect(onChange).toHaveBeenCalledWith('verticalVelocity')
  })
})
