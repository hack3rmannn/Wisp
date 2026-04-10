import React from 'react'
import { DS } from '../design-system'

interface StatusSectionProps {
  voiceState: string
  isWispVisible: boolean
}

export function StatusSection({ voiceState, isWispVisible }: StatusSectionProps) {
  const getStatusInfo = () => {
    switch (voiceState) {
      case 'listening':
        return { text: 'Listening...', color: DS.Colors.accent }
      case 'processing':
        return { text: 'Thinking...', color: DS.Colors.warning }
      case 'responding':
        return { text: 'Speaking...', color: DS.Colors.success }
      default:
        return {
          text: isWispVisible ? 'Active' : 'Ready',
          color: isWispVisible ? DS.Colors.success : DS.Colors.textTertiary,
        }
    }
  }

  const status = getStatusInfo()

  return (
    <div style={styles.container}>
      <div style={{ ...styles.dot, background: status.color }} />
      <span style={{ ...styles.text, color: status.color }}>{status.text}</span>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
  },
  text: {
    fontSize: 12,
    fontWeight: 500,
  },
}
