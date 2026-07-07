import type { Ref } from 'react'
import { CameraView } from './CameraView'
import { SkeletonOverlay } from './SkeletonOverlay'
import { MetricChips } from './MetricChips'
import { useFullscreen } from '../hooks/useFullscreen'
import type { JointAngles, PoseFrame } from '../types'

const WIDTH = 640
const HEIGHT = 480

export interface CameraStageProps {
  videoRef: Ref<HTMLVideoElement>
  frame: PoseFrame | null
  angles: JointAngles
  liveCadence: number | null
  facingMode: 'user' | 'environment'
  recording: boolean
  recordingSeconds: number
  onToggleRecording: () => void
  onSwitchCamera: () => void
  onCameraError: (message: string) => void
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export function CameraStage(props: CameraStageProps) {
  const { ref, isFullscreen, toggle } = useFullscreen<HTMLDivElement>()

  return (
    <div ref={ref} className={`camera-stage${isFullscreen ? ' stage-fullscreen' : ''}`}>
      <div className="stage-video">
        <CameraView
          ref={props.videoRef}
          width={WIDTH}
          height={HEIGHT}
          facingMode={props.facingMode}
          onError={props.onCameraError}
        />
        <SkeletonOverlay frame={props.frame} width={WIDTH} height={HEIGHT} />
        <MetricChips angles={props.angles} cadence={props.liveCadence} />

        {props.recording && (
          <span className="rec-badge">
            <span className="rec-blink" aria-hidden="true" /> REC {mmss(props.recordingSeconds)}
          </span>
        )}

        <div className="stage-controls">
          <button
            className="ctrl"
            onClick={props.onSwitchCamera}
            disabled={props.recording}
            aria-label="Rodar câmara"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12a8 8 0 0 1 13-6l3 2M20 12a8 8 0 0 1-13 6l-3-2" />
            </svg>
          </button>

          <button
            className={`ctrl-record${props.recording ? ' is-recording' : ''}`}
            onClick={props.onToggleRecording}
            aria-label={props.recording ? 'Parar gravação' : 'Gravar'}
          >
            <span className={props.recording ? 'rec-square' : 'rec-dot'} aria-hidden="true" />
          </button>

          <button
            className="ctrl"
            onClick={toggle}
            aria-label={isFullscreen ? 'Sair de ecrã inteiro' : 'Ecrã inteiro'}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
