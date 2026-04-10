import React, { useRef, useEffect, useState } from 'react'
import { DS } from '../design-system'

interface WaveformProps {
  audioPowerLevel: number
  color?: string
}

/**
 * A small waveform that replaces the triangle cursor while listening.
 * Five bars whose heights respond to the mic's audio power level.
 */
export function Waveform({ audioPowerLevel, color }: WaveformProps) {
  const cursorColor = color || DS.Colors.overlayCursor
  const barProfile = [0.4, 0.7, 1.0, 0.7, 0.4]
  const [animPhase, setAnimPhase] = useState(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    let startTime = performance.now()
    const tick = (now: number) => {
      setAnimPhase((now - startTime) / 1000)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        filter: `drop-shadow(0 0 6px ${cursorColor}99)`,
      }}
    >
      {barProfile.map((profile, i) => {
        const phase = animPhase * 3.6 + i * 0.35
        const normalizedPower = Math.max(audioPowerLevel - 0.008, 0)
        const easedPower = Math.pow(Math.min(normalizedPower * 2.85, 1), 0.76)
        const reactiveHeight = easedPower * 10 * profile
        const idlePulse = ((Math.sin(phase) + 1) / 2) * 1.5
        const height = 3 + reactiveHeight + idlePulse

        return (
          <div
            key={i}
            style={{
              width: 2,
              height,
              borderRadius: 1.5,
              background: cursorColor,
              transition: 'height 0.08s linear',
            }}
          />
        )
      })}
    </div>
  )
}
