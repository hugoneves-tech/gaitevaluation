import { describe, it, expect } from 'vitest'
import { angleBetween, computeAngles } from './angles'
import type { Landmark, PoseFrame } from '../types'

const P = (x: number, y: number, visibility = 1): Landmark => ({ x, y, z: 0, visibility })

describe('angleBetween', () => {
  it('devolve 180 para três pontos colineares (perna reta)', () => {
    const a = P(0, 0), b = P(0, 1), c = P(0, 2)
    expect(angleBetween(a, b, c)).toBeCloseTo(180, 1)
  })

  it('devolve 90 para um ângulo reto', () => {
    const a = P(0, 0), b = P(0, 1), c = P(1, 1)
    expect(angleBetween(a, b, c)).toBeCloseTo(90, 1)
  })

  it('devolve 45 para meio ângulo reto', () => {
    const a = P(0, 0), b = P(0, 1), c = P(1, 0)
    expect(angleBetween(a, b, c)).toBeCloseTo(45, 1)
  })
})

describe('computeAngles', () => {
  const buildFrame = (overrides: Record<number, Landmark>): PoseFrame => {
    const frame: PoseFrame = Array.from({ length: 33 }, () => P(0, 0))
    for (const [i, lm] of Object.entries(overrides)) frame[Number(i)] = lm
    return frame
  }

  it('calcula o joelho esquerdo como 180 quando anca-joelho-tornozelo estão alinhados', () => {
    const frame = buildFrame({ 23: P(0, 0), 25: P(0, 1), 27: P(0, 2) })
    const angles = computeAngles(frame, 0.5)
    expect(angles.knee.left).toBeCloseTo(180, 1)
  })

  it('devolve null para uma articulação com baixa visibilidade', () => {
    const frame = buildFrame({ 23: P(0, 0, 0.1), 25: P(0, 1, 1), 27: P(0, 2, 1) })
    const angles = computeAngles(frame, 0.5)
    expect(angles.knee.left).toBeNull()
  })
})
