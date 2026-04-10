import { app, ipcMain, BrowserWindow, session } from 'electron'
import path from 'path'

// Disable GPU sandboxing to prevent cache access errors on Windows
app.commandLine.appendSwitch('disable-gpu-sandbox')
app.commandLine.appendSwitch('disable-software-rasterizer')

// Prevent unhandled errors from crashing the app
process.on('uncaughtException', (error) => {
  console.error('[Wisp] Uncaught exception:', error)
})
process.on('unhandledRejection', (reason) => {
  console.error('[Wisp] Unhandled rejection:', reason)
})
import { TrayManager } from './tray-manager'
import { OverlayManager } from './overlay-manager'
import { StateMachine } from './state-machine'
import { ElevenLabsTTSClient } from './elevenlabs-tts'
import { IPC } from '../shared/ipc-channels'
import { VoiceState } from '../shared/voice-state'
import {
  getAllSettings,
  setSelectedModel,
  setIsClickyCursorEnabled,
  getIsClickyCursorEnabled,
  setWorkerBaseURL,
  setCursorColor,
} from './config'

let trayManager: TrayManager
let overlayManager: OverlayManager
let stateMachine: StateMachine
let ttsClient: ElevenLabsTTSClient
let audioCaptureWindow: BrowserWindow | null = null

const isDev = process.env.NODE_ENV === 'development'
const preloadPath = path.join(__dirname, '../preload/preload.js')

function getRendererURL(): string {
  if (process.env.ELECTRON_RENDERER_URL) {
    return process.env.ELECTRON_RENDERER_URL
  }
  return `file://${path.join(__dirname, '../renderer/index.html')}`
}

app.whenReady().then(() => {
  // Auto-grant microphone permission for overlay audio capture
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true)
    } else {
      callback(false)
    }
  })

  const rendererURL = getRendererURL()

  // Initialize managers
  ttsClient = new ElevenLabsTTSClient()
  trayManager = new TrayManager(preloadPath, rendererURL)
  overlayManager = new OverlayManager(preloadPath, rendererURL)
  stateMachine = new StateMachine(ttsClient)

  // Create system tray
  trayManager.create()

  // Create hidden window for audio capture (transparent windows crash getUserMedia on Windows)
  audioCaptureWindow = new BrowserWindow({
    width: 400,
    height: 300,
    show: false,
    skipTaskbar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  audioCaptureWindow.loadURL(`${rendererURL}#audio-capture`)
  audioCaptureWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[AudioWindow] Renderer crashed:', details.reason, details.exitCode)
  })
  audioCaptureWindow.webContents.on('did-finish-load', () => {
    console.log('[AudioWindow] Loaded successfully')
  })
  audioCaptureWindow.webContents.on('console-message', (_event, _level, message) => {
    console.log('[AudioWindow]', message)
  })

  // Wire up state machine events to overlay broadcasts
  stateMachine.on('voiceStateChanged', (state: VoiceState) => {
    overlayManager.broadcastToOverlays(IPC.VOICE_STATE_CHANGED, state)
    trayManager.getPanelWindow()?.webContents.send(IPC.VOICE_STATE_CHANGED, state)
  })

  // Use the hidden audio window for TTS playback (overlay windows are transparent and can crash)
  ttsClient.setPlaybackWindow(audioCaptureWindow)

  stateMachine.on('overlayVisibility', (visible: boolean) => {
    if (visible) {
      overlayManager.showOverlays()
    } else {
      overlayManager.fadeOutAndHide()
    }
  })

  stateMachine.on('navigateToElement', (target) => {
    overlayManager.broadcastToOverlays(IPC.NAVIGATE_TO_ELEMENT, target)
  })

  stateMachine.on('clearNavigation', () => {
    overlayManager.broadcastToOverlays(IPC.NAVIGATE_TO_ELEMENT, null)
  })

  stateMachine.on('startAudioCapture', () => {
    if (audioCaptureWindow && !audioCaptureWindow.isDestroyed()) {
      audioCaptureWindow.webContents.send('audio:start-capture', {})
    }
  })

  stateMachine.on('stopAudioCapture', () => {
    if (audioCaptureWindow && !audioCaptureWindow.isDestroyed()) {
      audioCaptureWindow.webContents.send('audio:stop-capture', {})
    }
  })

  stateMachine.audioCapture.on('powerLevel', (level: number) => {
    overlayManager.broadcastToOverlays(IPC.AUDIO_POWER_LEVEL, level)
  })

  // Show overlays if cursor is enabled
  if (getIsClickyCursorEnabled()) {
    overlayManager.showOverlays()
  }

  // Start listening for push-to-talk
  stateMachine.start()

  // ── IPC Handlers ──

  // Panel settings
  ipcMain.on(IPC.SET_MODEL, (_event, model: string) => {
    setSelectedModel(model)
  })

  ipcMain.on(IPC.SET_CLICKY_VISIBLE, (_event, enabled: boolean) => {
    setIsClickyCursorEnabled(enabled)
    if (enabled) {
      overlayManager.showOverlays()
    } else {
      overlayManager.fadeOutAndHide()
    }
  })

  ipcMain.handle(IPC.GET_SETTINGS, () => {
    return getAllSettings()
  })

  ipcMain.handle(IPC.REQUEST_STATE, () => {
    return {
      voiceState: stateMachine.getVoiceState(),
      isOverlayVisible: overlayManager.getIsVisible(),
      settings: getAllSettings(),
    }
  })

  ipcMain.on(IPC.QUIT_APP, () => {
    app.quit()
  })

  // Audio data from renderer (mic capture happens in hidden audio window)
  ipcMain.on('audio:data', (_event, base64Data: string) => {
    const buffer = Buffer.from(base64Data, 'base64')
    stateMachine.audioCapture.handleAudioData(buffer)
  })

  ipcMain.on('audio:buffer', (_event, data: any) => {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data)
    stateMachine.audioCapture.handleAudioData(buffer)
  })

  ipcMain.on('audio:power-level', (_event, level: number) => {
    stateMachine.audioCapture.handleAudioPowerLevel(level)
  })

  // TTS playback finished notification from renderer
  ipcMain.on('tts:finished', () => {
    ttsClient.onPlaybackFinished()
  })

  // Worker URL configuration
  ipcMain.on('settings:set-worker-url', (_event, url: string) => {
    setWorkerBaseURL(url)
  })

  // Cursor color
  ipcMain.on('settings:set-cursor-color', (_event, color: string) => {
    setCursorColor(color)
    overlayManager.broadcastToOverlays('settings:cursor-color', color)
  })

  console.log('[Wisp] Application started')
})

// Prevent app from quitting when all windows are closed (we're a tray app)
app.on('window-all-closed', () => {
  // Don't quit — we live in the system tray
})

app.on('before-quit', () => {
  stateMachine?.stop()
  trayManager?.destroy()
  overlayManager?.hideOverlays()
})

// Single instance lock — prevent multiple copies from running
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}
