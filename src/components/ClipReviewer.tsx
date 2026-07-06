import { useMemo, useRef, useState } from 'react'
import type { RecordedClip } from '../types'
import { computeAngles } from '../lib/angles'
import { SkeletonOverlay } from './SkeletonOverlay'
import { AnglePanel } from './AnglePanel'

const WIDTH = 640
const HEIGHT = 480
const STEP_MS = 1000 / 30 // um frame a 30 fps

function nearestFrame(clip: RecordedClip, timeMs: number) {
  let best = clip.frames[0]
  let bestDelta = Infinity
  for (const f of clip.frames) {
    const d = Math.abs(f.timeMs - timeMs)
    if (d < bestDelta) {
      bestDelta = d
      best = f
    }
  }
  return best ?? null
}

export function ClipReviewer({ clip }: { clip: RecordedClip }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [timeMs, setTimeMs] = useState(0)

  const frame = useMemo(
    () => (clip.frames.length ? nearestFrame(clip, timeMs) : null),
    [clip, timeMs],
  )
  const angles = useMemo(
    () => (frame ? computeAngles(frame.landmarks, 0.5) : null),
    [frame],
  )

  const seek = (deltaMs: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = Math.max(0, video.currentTime + deltaMs / 1000)
  }

  const setRate = (rate: number) => {
    if (videoRef.current) videoRef.current.playbackRate = rate
  }

  return (
    <div>
      <div style={{ position: 'relative', width: WIDTH, height: HEIGHT }}>
        <video
          ref={videoRef}
          src={clip.videoUrl}
          width={WIDTH}
          height={HEIGHT}
          onTimeUpdate={(e) => setTimeMs(e.currentTarget.currentTime * 1000)}
          controls
        />
        <SkeletonOverlay frame={frame?.landmarks ?? null} width={WIDTH} height={HEIGHT} />
      </div>

      <div className="controls">
        <button onClick={() => seek(-STEP_MS)}>◀ Frame</button>
        <button onClick={() => seek(STEP_MS)}>Frame ▶</button>
        <button onClick={() => setRate(0.25)}>0.25×</button>
        <button onClick={() => setRate(0.5)}>0.5×</button>
        <button onClick={() => setRate(1)}>1×</button>
      </div>

      {angles && <AnglePanel angles={angles} />}
    </div>
  )
}
