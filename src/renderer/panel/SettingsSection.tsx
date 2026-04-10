import React from 'react'
import { DS } from '../design-system'

interface SettingsSectionProps {
  isWispVisible: boolean
  onVisibilityToggle: (enabled: boolean) => void
  cursorColor: string
  onCursorColorChange: (color: string) => void
}

const COLOR_PRESETS = [
  { color: '#FBBF24', label: 'Amber' },
  { color: '#F87171', label: 'Red' },
  { color: '#34D399', label: 'Green' },
  { color: '#60A5FA', label: 'Blue' },
  { color: '#A78BFA', label: 'Purple' },
  { color: '#FB923C', label: 'Orange' },
  { color: '#F472B6', label: 'Pink' },
  { color: '#FFFFFF', label: 'White' },
]

export function SettingsSection({
  isWispVisible,
  onVisibilityToggle,
  cursorColor,
  onCursorColorChange,
}: SettingsSectionProps) {
  return (
    <div style={styles.container}>
      {/* Visibility toggle */}
      <div style={styles.row}>
        <div>
          <div style={styles.settingTitle}>Show Wisp</div>
          <div style={styles.settingDescription}>Cursor companion on screen</div>
        </div>
        <button
          onClick={() => onVisibilityToggle(!isWispVisible)}
          style={{
            ...styles.toggle,
            background: isWispVisible ? DS.Colors.accent : DS.Colors.surface3,
          }}
        >
          <div
            style={{
              ...styles.toggleKnob,
              transform: isWispVisible ? 'translateX(16px)' : 'translateX(0)',
            }}
          />
        </button>
      </div>

      {/* Cursor color picker */}
      <div style={styles.colorSection}>
        <div style={styles.settingTitle}>Cursor Color</div>
        <div style={styles.colorGrid}>
          {COLOR_PRESETS.map((preset) => {
            const isSelected = cursorColor.toUpperCase() === preset.color.toUpperCase()
            return (
              <button
                key={preset.color}
                title={preset.label}
                onClick={() => onCursorColorChange(preset.color)}
                style={{
                  ...styles.colorSwatch,
                  background: preset.color,
                  boxShadow: isSelected
                    ? `0 0 0 2px ${DS.Colors.background}, 0 0 0 4px ${preset.color}`
                    : `0 0 0 1px ${DS.Colors.borderSubtle}`,
                  transform: isSelected ? 'scale(1.15)' : 'scale(1)',
                }}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: DS.Spacing.lg,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: DS.Spacing.lg,
  },
  settingTitle: {
    fontSize: 13,
    fontWeight: 500,
    color: DS.Colors.textPrimary,
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 11,
    color: DS.Colors.textTertiary,
  },
  toggle: {
    width: 40,
    height: 24,
    borderRadius: 12,
    padding: 3,
    transition: `background ${DS.Animation.fast}s`,
    flexShrink: 0,
    position: 'relative',
  },
  toggleKnob: {
    width: 18,
    height: 18,
    borderRadius: '50%',
    background: '#FFFFFF',
    transition: `transform ${DS.Animation.fast}s`,
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
  },
  colorSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: DS.Spacing.sm,
  },
  colorGrid: {
    display: 'flex',
    gap: DS.Spacing.sm,
    flexWrap: 'wrap',
  },
  colorSwatch: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    transition: `all ${DS.Animation.fast}s`,
    padding: 0,
  },
}
