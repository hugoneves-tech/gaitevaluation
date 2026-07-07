import { useMemo, useRef, useState } from 'react'
import type { GaitEventMethod, OperatedSide, RecordedClip } from '../types'
import { computeAngles } from '../lib/angles'
import { detectEvents } from '../lib/gaitEvents'
import { computeMetrics } from '../lib/gaitMetrics'
import { SkeletonOverlay } from './SkeletonOverlay'
import { AnglePanel } from './AnglePanel'
import { DetectionProfileBar } from './DetectionProfileBar'
import { OperatedSideSelector } from './OperatedSideSelector'
import { GaitMetricsPanel } from './GaitMetricsPanel'
import { assessAntalgic, computeRom, pelvicObliquitySeries } from '../lib/compensation'
import { CompensationPanel } from './CompensationPanel'
import { TrendelenburgPanel } from './TrendelenburgPanel'
import { buildSummary } from '../lib/gaitSummary'
import { InterpretationPanel } from './InterpretationPanel'

const WIDTH = 640
const HEIGHT = 480
const STEP_MS = 1000 / 30 // um frame a 30 fps

const EVENT_COLOR = { left: '#2ecc71', right: '#e74c3c' } as const

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
  const [method, setMethod] = useState<GaitEventMethod>('coordinate')
  const [operated, setOperated] = useState<OperatedSide>('left')

  const frame = useMemo(
    () => (clip.frames.length ? nearestFrame(clip, timeMs) : null),
    [clip, timeMs],
  )
  const angles = useMemo(
    () => (frame ? computeAngles(frame.landmarks, 0.5) : null),
    [frame],
  )
  const events = useMemo(() => detectEvents(clip.frames, method), [clip, method])
  const metrics = useMemo(() => computeMetrics(events, operated), [events, operated])
  const antalgic = useMemo(() => assessAntalgic(metrics), [metrics])
  const rom = useMemo(() => computeRom(clip.frames), [clip])
  const obliquity = useMemo(() => pelvicObliquitySeries(clip.frames), [clip])
  const summary = useMemo(
    () => buildSummary(metrics, antalgic, rom, obliquity, operated, method),
    [metrics, antalgic, rom, obliquity, operated, method],
  )

  const durationMs = clip.frames.length
    ? clip.frames[clip.frames.length - 1].timeMs
    : 0

  const seek = (deltaMs: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = Math.max(0, video.currentTime + deltaMs / 1000)
  }

  const seekTo = (timeMs: number) => {
    if (videoRef.current) videoRef.current.currentTime = timeMs / 1000
  }

  const setRate = (rate: number) => {
    if (videoRef.current) videoRef.current.playbackRate = rate
  }

  return (
    <div>
      <p className="pedagogical-notice" role="note">
        Para esta análise, filme de lado (plano sagital) o doente a caminhar vários passos a
        atravessar o enquadramento.
      </p>

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

      {durationMs > 0 && (
        <div className="event-timeline" aria-label="Marcadores de evento">
          {events.map((ev, i) => (
            <span
              key={i}
              className="event-marker"
              title={`${ev.type === 'heelStrike' ? 'Contacto inicial' : 'Toe off'} (${ev.side})`}
              style={{
                left: `${(ev.timeMs / durationMs) * 100}%`,
                background: EVENT_COLOR[ev.side],
                opacity: ev.type === 'heelStrike' ? 1 : 0.4,
              }}
            />
          ))}
        </div>
      )}

      <div className="controls">
        <button onClick={() => seek(-STEP_MS)}>◀ Frame</button>
        <button onClick={() => seek(STEP_MS)}>Frame ▶</button>
        <button onClick={() => setRate(0.25)}>0.25×</button>
        <button onClick={() => setRate(0.5)}>0.5×</button>
        <button onClick={() => setRate(1)}>1×</button>
      </div>

      <DetectionProfileBar value={method} onChange={setMethod} />
      <OperatedSideSelector value={operated} onChange={setOperated} />
      <GaitMetricsPanel metrics={metrics} />
      <CompensationPanel antalgic={antalgic} rom={rom} operatedSide={operated} />
      <TrendelenburgPanel obliquity={obliquity} currentTimeMs={timeMs} onSeek={seekTo} />
      <InterpretationPanel summary={summary} />

      {angles && <AnglePanel angles={angles} />}
    </div>
  )
}
