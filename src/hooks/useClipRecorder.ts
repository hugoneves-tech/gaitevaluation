import { useRef, useState } from 'react'
import type { PoseFrame, RecordedClip, RecordedFrame } from '../types'

export function useClipRecorder() {
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const framesRef = useRef<RecordedFrame[]>([])
  const startTimeRef = useRef<number>(0)
  const [recording, setRecording] = useState(false)
  const [clip, setClip] = useState<RecordedClip | null>(null)

  const start = (stream: MediaStream) => {
    chunksRef.current = []
    framesRef.current = []
    startTimeRef.current = performance.now()
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' })
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' })
      setClip({
        videoUrl: URL.createObjectURL(blob),
        frames: framesRef.current,
      })
    }
    recorder.start()
    recorderRef.current = recorder
    setRecording(true)
  }

  /** Chamado a cada frame processado enquanto grava, para guardar os landmarks. */
  const captureFrame = (landmarks: PoseFrame) => {
    if (!recording) return
    framesRef.current.push({
      timeMs: performance.now() - startTimeRef.current,
      landmarks,
    })
  }

  const stop = () => {
    recorderRef.current?.stop()
    setRecording(false)
  }

  return { recording, clip, start, stop, captureFrame }
}
