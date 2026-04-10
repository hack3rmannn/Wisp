import React from 'react'
import { DS } from '../design-system'

interface SpeechBubbleProps {
  text: string
  opacity: number
  scale: number
}

/**
 * A compact speech bubble displayed next to the cursor.
 * Used for welcome message, navigation labels, and response text.
 */
export function SpeechBubble({ text, opacity, scale }: SpeechBubbleProps) {
  if (!text) return null

  return (
    <div
      style={{
        fontSize: 11.5,
        fontWeight: 500,
        fontFamily: DS.Fonts.overlay,
        letterSpacing: 0.2,
        color: DS.Colors.overlayCursor,
        padding: '5px 10px',
        background: DS.Colors.speechBubble,
        border: `1.5px solid ${DS.Colors.speechBubbleBorder}`,
        borderRadius: 8,
        boxShadow: `0 0 10px ${DS.Colors.overlayCursor}40, 0 2px 8px rgba(0,0,0,0.5)`,
        whiteSpace: 'nowrap',
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: 'left top',
        transition: `opacity ${DS.Animation.slow}s, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)`,
        pointerEvents: 'none',
      }}
    >
      {text}
    </div>
  )
}
