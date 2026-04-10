import React from 'react'
import { DS } from '../design-system'

interface ModelPickerProps {
  selectedModel: string
  onChange: (model: string) => void
}

const MODELS = [
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', description: 'Fast, great for most tasks' },
  { id: 'claude-opus-4-6', label: 'Claude Opus 4.6', description: 'Most capable, deeper reasoning' },
]

export function ModelPicker({ selectedModel, onChange }: ModelPickerProps) {
  return (
    <div style={styles.container}>
      <label style={styles.label}>Model</label>
      <div style={styles.options}>
        {MODELS.map((model) => {
          const isSelected = selectedModel === model.id
          return (
            <button
              key={model.id}
              onClick={() => onChange(model.id)}
              style={{
                ...styles.option,
                background: isSelected ? DS.Colors.surface3 : DS.Colors.surface1,
                borderColor: isSelected ? DS.Colors.accent : DS.Colors.borderSubtle,
              }}
            >
              <div style={styles.optionHeader}>
                <div
                  style={{
                    ...styles.radio,
                    borderColor: isSelected ? DS.Colors.accent : DS.Colors.borderStrong,
                  }}
                >
                  {isSelected && <div style={styles.radioFill} />}
                </div>
                <span style={styles.modelName}>{model.label}</span>
              </div>
              <span style={styles.modelDescription}>{model.description}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: DS.Spacing.sm,
  },
  label: {
    fontSize: 12,
    fontWeight: 500,
    color: DS.Colors.textSecondary,
  },
  options: {
    display: 'flex',
    flexDirection: 'column',
    gap: DS.Spacing.sm,
  },
  option: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: `${DS.Spacing.md}px`,
    borderRadius: DS.CornerRadius.medium,
    border: '1px solid',
    textAlign: 'left',
    transition: `all ${DS.Animation.fast}s`,
  },
  optionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: DS.Spacing.sm,
  },
  radio: {
    width: 14,
    height: 14,
    borderRadius: '50%',
    border: '2px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  radioFill: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: DS.Colors.accent,
  },
  modelName: {
    fontSize: 13,
    fontWeight: 500,
    color: DS.Colors.textPrimary,
  },
  modelDescription: {
    fontSize: 11,
    color: DS.Colors.textTertiary,
    marginLeft: 22,
  },
}
