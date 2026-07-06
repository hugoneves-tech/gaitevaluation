import { useEffect, useRef, useState } from 'react'
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'
import type { PoseFrame } from '../types'

const WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task'

/**
 * Carrega o PoseLandmarker uma vez e expõe uma função `detect`
 * que recebe um elemento de vídeo + timestamp e devolve os landmarks.
 */
export function usePoseEngine() {
  const landmarkerRef = useRef<PoseLandmarker | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const fileset = await FilesetResolver.forVisionTasks(WASM_URL)
        const landmarker = await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numPoses: 1,
        })
        if (cancelled) return
        landmarkerRef.current = landmarker
        setReady(true)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
      landmarkerRef.current?.close()
    }
  }, [])

  /** Deteta a pose num frame de vídeo. Devolve os 33 landmarks ou null. */
  const detect = (video: HTMLVideoElement, timestampMs: number): PoseFrame | null => {
    const landmarker = landmarkerRef.current
    if (!landmarker) return null
    const result = landmarker.detectForVideo(video, timestampMs)
    const first = result.landmarks?.[0]
    if (!first) return null
    return first.map((p) => ({
      x: p.x,
      y: p.y,
      z: p.z,
      visibility: p.visibility ?? 0,
    }))
  }

  return { ready, error, detect }
}
