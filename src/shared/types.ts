import { VoiceState } from './voice-state'

export interface CursorPosition {
  x: number
  y: number
  /** Which display the cursor is on (display.id) */
  displayId: number
}

export interface DisplayInfo {
  id: number
  bounds: { x: number; y: number; width: number; height: number }
  scaleFactor: number
}

export interface ScreenCapture {
  imageData: string // base64 JPEG
  label: string
  isCursorScreen: boolean
  displayWidthInPoints: number
  displayHeightInPoints: number
  screenshotWidthInPixels: number
  screenshotHeightInPixels: number
  displayBounds: { x: number; y: number; width: number; height: number }
}

export interface NavigationTarget {
  /** X coordinate in display-local pixels */
  x: number
  /** Y coordinate in display-local pixels */
  y: number
  /** Element label from Claude */
  label: string | null
  /** Custom bubble text (if any) */
  bubbleText: string | null
  /** Display ID the target is on */
  displayId: number
}

export interface PointingParseResult {
  spokenText: string
  coordinate: { x: number; y: number } | null
  elementLabel: string | null
  screenNumber: number | null
}

export interface AppSettings {
  selectedModel: string
  isClickyCursorEnabled: boolean
  workerBaseURL: string
}

export interface AppState {
  voiceState: VoiceState
  isOverlayVisible: boolean
  settings: AppSettings
}
