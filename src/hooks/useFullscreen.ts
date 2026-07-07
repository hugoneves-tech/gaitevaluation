import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Ecrã inteiro sobre um elemento, via Fullscreen API com fallback de estado.
 * `ref` deve ser aplicado ao contentor a expandir.
 */
export function useFullscreen<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const onChange = () => {
      if (document.fullscreenElement === null) setIsFullscreen(false)
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  useEffect(() => {
    if (!isFullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isFullscreen])

  const toggle = useCallback(() => {
    setIsFullscreen((prev) => {
      const next = !prev
      const el = ref.current
      if (next) {
        if (el && typeof el.requestFullscreen === 'function') el.requestFullscreen().catch(() => {})
      } else if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
        document.exitFullscreen().catch(() => {})
      }
      return next
    })
  }, [])

  return { ref, isFullscreen, toggle }
}
