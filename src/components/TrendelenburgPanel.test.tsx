import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TrendelenburgPanel } from './TrendelenburgPanel'
import type { PelvicObliquity } from '../types'

const obliquity: PelvicObliquity = {
  series: [
    { timeMs: 0, angleDeg: 2 },
    { timeMs: 100, angleDeg: 12 },
    { timeMs: 200, angleDeg: 5 },
  ],
  peakDeg: 12,
  peakTimeMs: 100,
}

describe('TrendelenburgPanel', () => {
  it('mostra a obliquidade do frame atual e o pico', () => {
    render(<TrendelenburgPanel obliquity={obliquity} currentTimeMs={200} onSeek={() => {}} />)
    expect(screen.getByTestId('obliquity-current')).toHaveTextContent('5')
    expect(screen.getByTestId('obliquity-peak')).toHaveTextContent('12')
  })

  it('o botão "ir para o pico" aciona onSeek com o tempo do pico', () => {
    const onSeek = vi.fn()
    render(<TrendelenburgPanel obliquity={obliquity} currentTimeMs={0} onSeek={onSeek} />)
    fireEvent.click(screen.getByRole('button', { name: /pico/i }))
    expect(onSeek).toHaveBeenCalledWith(100)
  })
})
