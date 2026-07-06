import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import App from './App'

// Mock do motor de pose e câmara (dependem de WebGL/hardware).
vi.mock('./hooks/usePoseEngine', () => ({
  usePoseEngine: () => ({ ready: true, error: null, detect: () => null }),
}))
vi.mock('./components/CameraView', () => ({
  CameraView: () => <div data-testid="camera-view" />,
}))

describe('App', () => {
  it('começa no modo Ao Vivo', () => {
    render(<App />)
    expect(screen.getByTestId('camera-view')).toBeInTheDocument()
  })

  it('mostra sempre o aviso pedagógico', () => {
    render(<App />)
    expect(screen.getByRole('note')).toHaveTextContent(/fins de ensino/i)
  })

  it('alterna para o modo Rever quando não há clip mostra aviso', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /rever/i }))
    expect(screen.getByText(/grave um clip primeiro/i)).toBeInTheDocument()
  })
})
