import { useEffect, useRef } from 'react'
import type { PoseFrame } from '../types'

// Pares de landmarks a ligar (ossos principais para marcha).
const BONES: { a: number; b: number; side: 'left' | 'right' | 'center' }[] = [
  { a: 11, b: 23, side: 'left' },
  { a: 23, b: 25, side: 'left' },
  { a: 25, b: 27, side: 'left' },
  { a: 27, b: 31, side: 'left' },
  { a: 12, b: 24, side: 'right' },
  { a: 24, b: 26, side: 'right' },
  { a: 26, b: 28, side: 'right' },
  { a: 28, b: 32, side: 'right' },
  { a: 11, b: 12, side: 'center' },
]

const COLORS = { left: '#2ecc71', right: '#e74c3c', center: '#3498db' }
const MIN_VIS = 0.5

export function SkeletonOverlay({
  frame,
  width,
  height,
}: {
  frame: PoseFrame | null
  width: number
  height: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, width, height)
    if (!frame) return

    ctx.lineWidth = 4
    for (const bone of BONES) {
      const a = frame[bone.a]
      const b = frame[bone.b]
      if (a.visibility < MIN_VIS || b.visibility < MIN_VIS) continue
      ctx.strokeStyle = COLORS[bone.side]
      ctx.beginPath()
      ctx.moveTo(a.x * width, a.y * height)
      ctx.lineTo(b.x * width, b.y * height)
      ctx.stroke()
    }

    // Linha da pélvis (obliquidade) — estilo distinto para o Trendelenburg.
    const hipL = frame[23]
    const hipR = frame[24]
    if (hipL.visibility >= MIN_VIS && hipR.visibility >= MIN_VIS) {
      ctx.strokeStyle = '#9b59b6'
      ctx.lineWidth = 6
      ctx.beginPath()
      ctx.moveTo(hipL.x * width, hipL.y * height)
      ctx.lineTo(hipR.x * width, hipR.y * height)
      ctx.stroke()
      ctx.lineWidth = 4
    }

    ctx.fillStyle = '#ffffff'
    for (const idx of [11, 12, 23, 24, 25, 26, 27, 28, 31, 32]) {
      const p = frame[idx]
      if (p.visibility < MIN_VIS) continue
      ctx.beginPath()
      ctx.arc(p.x * width, p.y * height, 5, 0, Math.PI * 2)
      ctx.fill()
    }
  }, [frame, width, height])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ position: 'absolute', top: 0, left: 0 }}
    />
  )
}
