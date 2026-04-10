import React from 'react'
import { DS } from '../design-system'

interface SpinnerProps {
  color?: string
}

/**
 * A small spinning indicator shown while the AI is processing.
 */
export function Spinner({ color }: SpinnerProps) {
  const cursorColor = color || DS.Colors.overlayCursor

  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      style={{
        animation: 'wisp-spin 0.8s linear infinite',
        filter: `drop-shadow(0 0 6px ${cursorColor}99)`,
      }}
    >
      <defs>
        <linearGradient id="spinnerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={cursorColor} stopOpacity="0" />
          <stop offset="100%" stopColor={cursorColor} stopOpacity="1" />
        </linearGradient>
        <style>{`
          @keyframes wisp-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </defs>
      <circle
        cx="7"
        cy="7"
        r="5.5"
        fill="none"
        stroke="url(#spinnerGrad)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="22 12"
      />
    </svg>
  )
}
