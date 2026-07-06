import { useEffect, useRef, useState } from 'react'
import { usePoseEngine } from './hooks/usePoseEngine'
import { useClipRecorder } from './hooks/useClipRecorder'
import { CameraView } from './components/CameraView'
import { SkeletonOverlay } from './components/SkeletonOverlay'
import { AnglePanel } from './components/AnglePanel'
import { ClipReviewer } from './components/ClipReviewer'
import { PedagogicalNotice } from './components/PedagogicalNotice'
import { computeAngles } from './lib/angles'
import { createAngleSmoother } from './lib/smoothing'
import type { JointAngles, PoseFrame } from './types'
import './index.css'

const WIDTH = 640
const HEIGHT = 480
const MIN_VIS = 0.5

type Mode = 'live' | 'review'

const emptyAngles: JointAngles = {
  hip: { left: null, right: null },
  knee: { left: null, right: null },
  ankle: { left: null, right: null },
}

export default function App() {
  const [mode, setMode] = useState<Mode>('live')
  const [error, setError] = useState<string | null>(null)
  const [frame, setFrame] = useState<PoseFrame | null>(null)
  const [angles, setAngles] = useState<JointAngles>(emptyAngles)

  const videoRef = useRef<HTMLVideoElement>(null)
  const rafRef = useRef<number>(0)
  const { ready, error: engineError, detect } = usePoseEngine()
  const { recording, clip, start, stop, captureFrame } = useClipRecorder()

  // Suavizadores por articulação/lado (persistem entre frames).
  const smoothers = useRef({
    hipL: createAngleSmoother(0.4), hipR: createAngleSmoother(0.4),
    kneeL: createAngleSmoother(0.4), kneeR: createAngleSmoother(0.4),
    ankleL: createAngleSmoother(0.4), ankleR: createAngleSmoother(0.4),
  })

  // Loop de deteção no modo Ao Vivo.
  useEffect(() => {
    if (mode !== 'live' || !ready) return
    let running = true
    const tick = () => {
      if (!running) return
      const video = videoRef.current
      if (video && video.readyState >= 2) {
        const lm = detect(video, performance.now())
        setFrame(lm)
        if (lm) {
          const raw = computeAngles(lm, MIN_VIS)
          const s = smoothers.current
          setAngles({
            hip: { left: s.hipL(raw.hip.left), right: s.hipR(raw.hip.right) },
            knee: { left: s.kneeL(raw.knee.left), right: s.kneeR(raw.knee.right) },
            ankle: { left: s.ankleL(raw.ankle.left), right: s.ankleR(raw.ankle.right) },
          })
          if (recording) captureFrame(lm)
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      running = false
      cancelAnimationFrame(rafRef.current)
    }
  }, [mode, ready, detect, recording, captureFrame])

  const toggleRecording = () => {
    const video = videoRef.current
    if (!video?.srcObject) return
    if (recording) stop()
    else start(video.srcObject as MediaStream)
  }

  const displayError = error ?? engineError

  return (
    <main className="app">
      <h1>Análise de Marcha — Ferramenta Pedagógica</h1>
      <PedagogicalNotice />

      <nav className="mode-tabs">
        <button
          aria-pressed={mode === 'live'}
          onClick={() => setMode('live')}
        >
          Ao Vivo
        </button>
        <button
          aria-pressed={mode === 'review'}
          onClick={() => setMode('review')}
        >
          Rever
        </button>
      </nav>

      {displayError && <p className="error">{displayError}</p>}
      {!ready && mode === 'live' && <p>A carregar o modelo de pose…</p>}

      {mode === 'live' && (
        <>
          <div style={{ position: 'relative', width: WIDTH, height: HEIGHT }}>
            <CameraView ref={videoRef} width={WIDTH} height={HEIGHT} onError={setError} />
            <SkeletonOverlay frame={frame} width={WIDTH} height={HEIGHT} />
          </div>
          <button onClick={toggleRecording}>
            {recording ? '■ Parar gravação' : '● Gravar clip'}
          </button>
          <AnglePanel angles={angles} />
        </>
      )}

      {mode === 'review' && (
        clip
          ? <ClipReviewer clip={clip} />
          : <p>Grave um clip primeiro no modo Ao Vivo.</p>
      )}
    </main>
  )
}
