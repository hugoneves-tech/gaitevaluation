import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ModeTabs } from './ModeTabs'

describe('ModeTabs', () => {
  it('marca o modo ativo e alterna', () => {
    const onChange = vi.fn()
    render(<ModeTabs mode="live" onChange={onChange} />)
    expect(screen.getByRole('button', { name: /ao vivo/i })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: /rever/i }))
    expect(onChange).toHaveBeenCalledWith('review')
  })
})
