import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { createRef } from 'react'
import { CameraStage } from './CameraStage'
import type { JointAngles } from '../types'

vi.mock('./CameraView', () => ({ CameraView: () => <div data-testid="camera-view" /> }))
vi.mock('./SkeletonOverlay', () => ({ SkeletonOverlay: () => <div data-testid="skeleton" /> }))

const angles: JointAngles = {
  hip: { left: null, right: null },
  knee: { left: 158, right: 150 },
  ankle: { left: null, right: null },
}

function setup(overrides: Partial<Parameters<typeof CameraStage>[0]> = {}) {
  const props = {
    videoRef: createRef<HTMLVideoElement>(),
    frame: null,
    angles,
    liveCadence: 108,
    facingMode: 'environment' as const,
    recording: false,
    recordingSeconds: 0,
    onToggleRecording: vi.fn(),
    onSwitchCamera: vi.fn(),
    onCameraError: vi.fn(),
    ...overrides,
  }
  render(<CameraStage {...props} />)
  return props
}

describe('CameraStage', () => {
  it('mostra a câmara, os chips e a barra de comandos', () => {
    setup()
    expect(screen.getByTestId('camera-view')).toBeInTheDocument()
    expect(screen.getByTestId('chip-knee-left')).toHaveTextContent('158°')
    expect(screen.getByRole('button', { name: /gravar/i })).toBeInTheDocument()
  })

  it('aciona os callbacks de gravar e rodar câmara', () => {
    const props = setup()
    fireEvent.click(screen.getByRole('button', { name: /gravar/i }))
    expect(props.onToggleRecording).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /rodar câmara/i }))
    expect(props.onSwitchCamera).toHaveBeenCalled()
  })

  it('a gravar, mostra o indicador REC e desativa rodar câmara', () => {
    setup({ recording: true, recordingSeconds: 5 })
    expect(screen.getByText(/REC/)).toHaveTextContent('0:05')
    expect(screen.getByRole('button', { name: /rodar câmara/i })).toBeDisabled()
  })
})
