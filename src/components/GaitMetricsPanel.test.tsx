import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GaitMetricsPanel } from './GaitMetricsPanel'
import type { GaitMetrics } from '../types'

const metrics: GaitMetrics = {
  cadenceStepsPerMin: 110,
  cyclesDetected: 3,
  operated: { stanceMs: 700, swingMs: 400, stepMs: 550, stanceSwingRatio: 1.75 },
  nonOperated: { stanceMs: 600, swingMs: 420, stepMs: 540, stanceSwingRatio: 1.43 },
  symmetryIndexPct: 15.4,
}

describe('GaitMetricsPanel', () => {
  it('mostra cadência, simetria e rótulos operado/não operado', () => {
    render(<GaitMetricsPanel metrics={metrics} />)
    expect(screen.getByText(/110/)).toBeInTheDocument()
    expect(screen.getByText(/15/)).toBeInTheDocument()
    expect(screen.getByText(/operado/i)).toBeInTheDocument()
  })

  it('mostra aviso de passos insuficientes quando não há ciclos', () => {
    const empty: GaitMetrics = {
      cadenceStepsPerMin: null,
      cyclesDetected: 0,
      operated: { stanceMs: null, swingMs: null, stepMs: null, stanceSwingRatio: null },
      nonOperated: { stanceMs: null, swingMs: null, stepMs: null, stanceSwingRatio: null },
      symmetryIndexPct: null,
    }
    render(<GaitMetricsPanel metrics={empty} />)
    expect(screen.getByText(/passos suficientes/i)).toBeInTheDocument()
  })
})
