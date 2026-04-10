/**
 * Bezier arc flight animation math for the cursor companion.
 * Ported from OverlayWindow.swift's animateBezierFlightArc.
 */

export interface AnimationState {
  x: number
  y: number
  rotationDegrees: number
  scale: number
  progress: number
}

export interface FlightConfig {
  startX: number
  startY: number
  endX: number
  endY: number
}

/**
 * Computes a quadratic bezier arc from start to end with a parabolic lift.
 * Returns the animation state at the given progress (0 to 1).
 */
export function computeBezierFlightFrame(config: FlightConfig, linearProgress: number): AnimationState {
  const { startX, startY, endX, endY } = config

  const deltaX = endX - startX
  const deltaY = endY - startY
  const distance = Math.hypot(deltaX, deltaY)

  // Control point: midpoint raised upward for parabolic arc
  const midX = (startX + endX) / 2
  const midY = (startY + endY) / 2
  const arcHeight = Math.min(distance * 0.2, 80)
  const controlX = midX
  const controlY = midY - arcHeight

  // Smoothstep easeInOut: 3t^2 - 2t^3 (Hermite interpolation)
  const t = linearProgress * linearProgress * (3 - 2 * linearProgress)

  // Quadratic bezier: B(t) = (1-t)^2*P0 + 2(1-t)t*P1 + t^2*P2
  const oneMinusT = 1 - t
  const x = oneMinusT * oneMinusT * startX + 2 * oneMinusT * t * controlX + t * t * endX
  const y = oneMinusT * oneMinusT * startY + 2 * oneMinusT * t * controlY + t * t * endY

  // Rotation: face direction of travel via bezier tangent
  // B'(t) = 2(1-t)(P1-P0) + 2t(P2-P1)
  const tangentX = 2 * oneMinusT * (controlX - startX) + 2 * t * (endX - controlX)
  const tangentY = 2 * oneMinusT * (controlY - startY) + 2 * t * (endY - controlY)
  // +90 because triangle tip points up at 0 deg, atan2 returns 0 for rightward
  const rotationDegrees = (Math.atan2(tangentY, tangentX) * 180) / Math.PI + 90

  // Scale pulse: sin curve peaks at midpoint, grows to ~1.3x
  const scalePulse = Math.sin(linearProgress * Math.PI)
  const scale = 1 + scalePulse * 0.3

  return { x, y, rotationDegrees, scale, progress: linearProgress }
}

/**
 * Computes the flight duration based on distance.
 * Short hops are quick, long flights are more dramatic. Clamped to 0.6-1.4s.
 */
export function computeFlightDuration(startX: number, startY: number, endX: number, endY: number): number {
  const distance = Math.hypot(endX - startX, endY - startY)
  return Math.min(Math.max(distance / 800, 0.6), 1.4)
}
