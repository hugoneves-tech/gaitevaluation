import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFullscreen } from './useFullscreen'

describe('useFullscreen', () => {
  it('alterna o estado no fallback (sem Fullscreen API)', () => {
    const { result } = renderHook(() => useFullscreen<HTMLDivElement>())
    expect(result.current.isFullscreen).toBe(false)
    act(() => result.current.toggle())
    expect(result.current.isFullscreen).toBe(true)
    act(() => result.current.toggle())
    expect(result.current.isFullscreen).toBe(false)
  })

  it('chama exitFullscreen ao sair quando a API está ativa', () => {
    const exit = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(document, 'exitFullscreen', { value: exit, configurable: true })
    Object.defineProperty(document, 'fullscreenElement', { value: {}, configurable: true })
    const { result } = renderHook(() => useFullscreen<HTMLDivElement>())
    act(() => result.current.toggle())
    act(() => result.current.toggle())
    expect(exit).toHaveBeenCalled()
    Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true })
  })
})
