import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card } from './Card'

describe('Card', () => {
  it('mostra o título e os filhos', () => {
    render(
      <Card title="Métricas">
        <p>conteúdo</p>
      </Card>,
    )
    expect(screen.getByRole('heading', { name: 'Métricas' })).toBeInTheDocument()
    expect(screen.getByText('conteúdo')).toBeInTheDocument()
  })

  it('sem título não renderiza cabeçalho', () => {
    render(<Card><p>só isto</p></Card>)
    expect(screen.queryByRole('heading')).toBeNull()
  })
})
