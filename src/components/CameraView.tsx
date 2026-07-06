import { forwardRef, useEffect, useState } from 'react'

interface CameraViewProps {
  width: number
  height: number
  onError: (message: string) => void
}

export const CameraView = forwardRef<HTMLVideoElement, CameraViewProps>(
  function CameraView({ width, height, onError }, ref) {
    const [streaming, setStreaming] = useState(false)

    useEffect(() => {
      let stream: MediaStream | null = null
      ;(async () => {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width, height },
            audio: false,
          })
          const video = (ref as React.RefObject<HTMLVideoElement>).current
          if (video) {
            video.srcObject = stream
            await video.play()
            setStreaming(true)
          }
        } catch (e) {
          onError(
            e instanceof DOMException && e.name === 'NotAllowedError'
              ? 'Permissão de câmara negada. Autorize o acesso ou carregue um vídeo.'
              : 'Câmara indisponível. Carregue um ficheiro de vídeo em alternativa.',
          )
        }
      })()
      return () => {
        stream?.getTracks().forEach((t) => t.stop())
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [width, height])

    return (
      <video
        ref={ref}
        width={width}
        height={height}
        playsInline
        muted
        style={{ display: streaming ? 'block' : 'none' }}
      />
    )
  },
)
