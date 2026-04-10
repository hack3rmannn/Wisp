import React, { useEffect, useState } from 'react'
import { DS } from '../design-system'
import { StatusSection } from './StatusSection'
import { ModelPicker } from './ModelPicker'
import { SettingsSection } from './SettingsSection'

declare global {
  interface Window {
    wispAPI: {
      getSettings: () => Promise<any>
      getState: () => Promise<any>
      setModel: (model: string) => void
      setWispVisible: (enabled: boolean) => void
      setWorkerURL: (url: string) => void
      setCursorColor: (color: string) => void
      quitApp: () => void
      onVoiceStateChanged: (callback: (state: string) => void) => void
      [key: string]: any
    }
  }
}

export function PanelApp() {
  const [voiceState, setVoiceState] = useState('idle')
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-6')
  const [isWispVisible, setIsWispVisible] = useState(true)
  const [workerURL, setWorkerURL] = useState('')
  const [cursorColor, setCursorColor] = useState('#FBBF24')

  useEffect(() => {
    window.wispAPI.getState().then((state: any) => {
      setVoiceState(state.voiceState)
      setSelectedModel(state.settings.selectedModel)
      setIsWispVisible(state.settings.isClickyCursorEnabled)
      setWorkerURL(state.settings.workerBaseURL)
      if (state.settings.cursorColor) {
        setCursorColor(state.settings.cursorColor)
      }
    })

    window.wispAPI.onVoiceStateChanged((state: string) => {
      setVoiceState(state)
    })
  }, [])

  const handleModelChange = (model: string) => {
    setSelectedModel(model)
    window.wispAPI.setModel(model)
  }

  const handleVisibilityToggle = (enabled: boolean) => {
    setIsWispVisible(enabled)
    window.wispAPI.setWispVisible(enabled)
  }

  const handleWorkerURLChange = (url: string) => {
    setWorkerURL(url)
    window.wispAPI.setWorkerURL(url)
  }

  const handleCursorColorChange = (color: string) => {
    setCursorColor(color)
    window.wispAPI.setCursorColor(color)
  }

  return (
    <div style={styles.container}>
      {/* Header bar */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 2L3.5 12.5h9L8 2z"
              fill={cursorColor}
              stroke={cursorColor}
              strokeWidth="0.5"
              strokeLinejoin="round"
            />
          </svg>
          <span style={styles.appName}>Wisp</span>
        </div>
        <StatusSection voiceState={voiceState} isWispVisible={isWispVisible} />
      </div>

      {/* Hotkey hint */}
      <div style={styles.hotkeyBanner}>
        <span style={styles.hotkeyText}>Hold</span>
        <kbd style={styles.kbd}>Ctrl</kbd>
        <span style={styles.hotkeyPlus}>+</span>
        <kbd style={styles.kbd}>Alt</kbd>
        <span style={styles.hotkeyText}>to talk</span>
      </div>

      {/* Settings — visibility toggle + color picker */}
      <SettingsSection
        isWispVisible={isWispVisible}
        onVisibilityToggle={handleVisibilityToggle}
        cursorColor={cursorColor}
        onCursorColorChange={handleCursorColorChange}
      />

      <div style={styles.divider} />

      {/* Model picker */}
      <ModelPicker selectedModel={selectedModel} onChange={handleModelChange} />

      <div style={styles.divider} />

      {/* Worker URL — collapsed into a compact row */}
      <div style={styles.section}>
        <label style={styles.label}>Worker URL</label>
        <input
          type="text"
          value={workerURL}
          onChange={(e) => handleWorkerURLChange(e.target.value)}
          placeholder="https://your-worker.workers.dev"
          style={styles.input}
        />
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        <button onClick={() => window.wispAPI.quitApp()} style={styles.quitButton}>
          Quit Wisp
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: DS.Spacing.lg,
    gap: DS.Spacing.md,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: DS.Spacing.sm,
  },
  appName: {
    fontSize: 15,
    fontWeight: 700,
    color: DS.Colors.textPrimary,
    letterSpacing: 0.3,
  },
  hotkeyBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: `${DS.Spacing.sm}px ${DS.Spacing.md}px`,
    background: DS.Colors.surface1,
    borderRadius: DS.CornerRadius.large,
    border: `1px solid ${DS.Colors.borderSubtle}`,
  },
  hotkeyText: {
    fontSize: 12,
    color: DS.Colors.textSecondary,
  },
  hotkeyPlus: {
    fontSize: 12,
    color: DS.Colors.textTertiary,
  },
  kbd: {
    display: 'inline-block',
    padding: '2px 7px',
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: 600,
    color: DS.Colors.textPrimary,
    background: DS.Colors.surface3,
    borderRadius: 5,
    border: `1px solid ${DS.Colors.borderStrong}`,
  },
  divider: {
    height: 1,
    background: DS.Colors.borderSubtle,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: DS.Spacing.xs,
  },
  label: {
    fontSize: 12,
    fontWeight: 500,
    color: DS.Colors.textSecondary,
  },
  input: {
    width: '100%',
    padding: `${DS.Spacing.sm}px ${DS.Spacing.md}px`,
    fontSize: 12,
    background: DS.Colors.surface2,
    border: `1px solid ${DS.Colors.borderSubtle}`,
    borderRadius: DS.CornerRadius.medium,
    color: DS.Colors.textPrimary,
    outline: 'none',
    boxSizing: 'border-box',
  },
  footer: {
    marginTop: 'auto',
    display: 'flex',
    justifyContent: 'center',
  },
  quitButton: {
    fontSize: 12,
    fontWeight: 500,
    color: DS.Colors.textTertiary,
    padding: `${DS.Spacing.xs}px ${DS.Spacing.lg}px`,
    borderRadius: DS.CornerRadius.pill,
    transition: `all ${DS.Animation.fast}s`,
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
  },
}
