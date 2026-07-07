import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { InterpretationPanel } from './InterpretationPanel'
import * as store from '../lib/apiKeyStore'
import * as gemini from '../lib/gemini'
import type { GaitSummary } from '../lib/gaitSummary'

const summary: GaitSummary = {
  operatedSide: 'left',
  detectionMethod: 'coordinate',
  cadenceStepsPerMin: 108,
  cyclesDetected: 3,
  symmetryIndexPct: 12,
  operated: { stanceMs: 620, swingMs: 400, stepMs: 520, stanceSwingRatio: 1.5 },
  nonOperated: { stanceMs: 700, swingMs: 410, stepMs: 540, stanceSwingRatio: 1.7 },
  antalgic: { flagged: true, evaluable: true },
  rom: {
    left: { hipDeg: 28, kneeDeg: 40, hipReduced: true, kneeReduced: true },
    right: { hipDeg: 34, kneeDeg: 58, hipReduced: false, kneeReduced: false },
  },
  pelvicObliquityPeakDeg: 9,
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(store, 'loadModel').mockReturnValue('auto')
})

describe('InterpretationPanel', () => {
  it('desativa o botão e mostra a dica quando não há chave', () => {
    vi.spyOn(store, 'loadKey').mockReturnValue(null)
    render(<InterpretationPanel summary={summary} />)
    expect(screen.getByRole('button', { name: /gerar interpretação/i })).toBeDisabled()
    expect(screen.getByText(/configure a chave no perfil/i)).toBeInTheDocument()
  })

  it('gera e mostra o texto e o modelo usado', async () => {
    vi.spyOn(store, 'loadKey').mockReturnValue({ key: 'k', remembered: true })
    vi.spyOn(gemini, 'generateInterpretation').mockResolvedValue({
      text: 'Interpretação exemplo.',
      modelUsed: 'gemini-2.5-flash',
    })
    render(<InterpretationPanel summary={summary} />)
    fireEvent.click(screen.getByRole('button', { name: /gerar interpretação/i }))
    await waitFor(() => expect(screen.getByText(/Interpretação exemplo/)).toBeInTheDocument())
    expect(screen.getByText(/gemini-2.5-flash/)).toBeInTheDocument()
  })

  it('mostra a mensagem de erro quando a geração falha', async () => {
    vi.spyOn(store, 'loadKey').mockReturnValue({ key: 'k', remembered: true })
    vi.spyOn(gemini, 'generateInterpretation').mockRejectedValue(
      new Error('Limite do nível gratuito atingido — tente mais tarde.'),
    )
    render(<InterpretationPanel summary={summary} />)
    fireEvent.click(screen.getByRole('button', { name: /gerar interpretação/i }))
    await waitFor(() => expect(screen.getByText(/nível gratuito/i)).toBeInTheDocument())
  })
})
