import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MetricChips } from './MetricChips'
import type { JointAngles } from '../types'

const angles: JointAngles = {
  hip: { left: 170, right: 168 },
  knee: { left: 158, right: null },
  ankle: { left: 90, right: 92 },
}

describe('MetricChips', () => {
  it('mostra os ângulos do joelho e a cadência, com "—" para null', () => {
    render(<MetricChips angles={angles} cadence={108} />)
    expect(screen.getByTestId('chip-knee-left')).toHaveTextContent('158°')
    expect(screen.getByTestId('chip-knee-right')).toHaveTextContent('—')
    expect(screen.getByTestId('chip-cadence')).toHaveTextContent('108')
  })
})
