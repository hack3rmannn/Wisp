import React from 'react'
import { DS } from '../design-system'

interface BlueCursorProps {
  rotationDegrees: number
  scale: number
  color?: string
}

/**
 * The triangle cursor — Wisp's visual identity.
 * Equilateral triangle with a soft glow shadow.
 */
export function BlueCursor({ rotationDegrees, scale, color }: BlueCursorProps) {
  const cursorColor = color || DS.Colors.overlayCursor
  const extraGlow = (scale - 1) * 20

  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      style={{
        transform: `rotate(${rotationDegrees}deg) scale(${scale})`,
        filter: `drop-shadow(0 0 ${8 + extraGlow}px ${cursorColor})`,
        transition: 'none',
      }}
    >
      <path
        d="M8 2.5L3.5 12.5h9L8 2.5z"
        fill={cursorColor}
      />
    </svg>
  )
}
