import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OperatedSideSelector } from './OperatedSideSelector'

describe('OperatedSideSelector', () => {
  it('mostra o lado ativo e alterna', () => {
    const onChange = vi.fn()
    render(<OperatedSideSelector value="left" onChange={onChange} />)
    expect(screen.getByRole('button', { name: /esquerda/i })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: /direita/i }))
    expect(onChange).toHaveBeenCalledWith('right')
  })
})
