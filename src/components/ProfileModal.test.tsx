import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ProfileModal } from './ProfileModal'
import * as store from '../lib/apiKeyStore'
import * as gemini from '../lib/gemini'

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(store, 'loadKey').mockReturnValue(null)
  vi.spyOn(store, 'loadModel').mockReturnValue('auto')
})

describe('ProfileModal', () => {
  it('não renderiza quando fechado', () => {
    const { container } = render(<ProfileModal open={false} onClose={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('guarda a chave ao clicar em Guardar', () => {
    const saveKey = vi.spyOn(store, 'saveKey').mockImplementation(() => {})
    vi.spyOn(store, 'saveModel').mockImplementation(() => {})
    render(<ProfileModal open onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText(/chave de api/i), { target: { value: 'minha-chave' } })
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }))
    expect(saveKey).toHaveBeenCalledWith('minha-chave', true)
  })

  it('testa a ligação e mostra a disponibilidade', async () => {
    vi.spyOn(gemini, 'listModels').mockResolvedValue({
      ok: true,
      message: 'Ligação válida.',
      models: [{ model: 'gemini-2.5-flash', available: true }],
    })
    render(<ProfileModal open onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText(/chave de api/i), { target: { value: 'k' } })
    fireEvent.click(screen.getByRole('button', { name: /testar liga/i }))
    await waitFor(() => expect(screen.getByText(/Ligação válida/i)).toBeInTheDocument())
    expect(screen.getByText(/gemini-2.5-flash/)).toBeInTheDocument()
  })
})
