import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc-channels'

/**
 * Exposes a safe subset of Electron IPC to the renderer process
 * via the window.wispAPI bridge.
 */
contextBridge.exposeInMainWorld('wispAPI', {
  // ── Panel Actions ──
  setModel: (model: string) => ipcRenderer.send(IPC.SET_MODEL, model),
  setWispVisible: (enabled: boolean) => ipcRenderer.send(IPC.SET_CLICKY_VISIBLE, enabled),
  setWorkerURL: (url: string) => ipcRenderer.send('settings:set-worker-url', url),
  setCursorColor: (color: string) => ipcRenderer.send('settings:set-cursor-color', color),
  quitApp: () => ipcRenderer.send(IPC.QUIT_APP),
  getSettings: () => ipcRenderer.invoke(IPC.GET_SETTINGS),
  getState: () => ipcRenderer.invoke(IPC.REQUEST_STATE),

  // ── Audio Capture (renderer -> main) ──
  sendAudioData: (base64Data: string) => ipcRenderer.send('audio:data', base64Data),
  sendAudioBuffer: (arrayBuffer: ArrayBuffer) => ipcRenderer.send('audio:buffer', Buffer.from(arrayBuffer)),
  sendAudioPowerLevel: (level: number) => ipcRenderer.send('audio:power-level', level),
  notifyTTSFinished: () => ipcRenderer.send('tts:finished'),

  // ── Event Listeners (main -> renderer) ──
  onCursorPosition: (callback: (position: any) => void) => {
    ipcRenderer.on(IPC.CURSOR_POSITION_UPDATE, (_event, position) => callback(position))
  },
  onVoiceStateChanged: (callback: (state: string) => void) => {
    ipcRenderer.on(IPC.VOICE_STATE_CHANGED, (_event, state) => callback(state))
  },
  onAudioPowerLevel: (callback: (level: number) => void) => {
    ipcRenderer.on(IPC.AUDIO_POWER_LEVEL, (_event, level) => callback(level))
  },
  onNavigateToElement: (callback: (target: any) => void) => {
    ipcRenderer.on(IPC.NAVIGATE_TO_ELEMENT, (_event, target) => callback(target))
  },
  onOverlayVisibility: (callback: (visible: boolean) => void) => {
    ipcRenderer.on(IPC.OVERLAY_VISIBILITY, (_event, visible) => callback(visible))
  },
  onStartAudioCapture: (callback: () => void) => {
    ipcRenderer.on('audio:start-capture', () => callback())
  },
  onStopAudioCapture: (callback: () => void) => {
    ipcRenderer.on('audio:stop-capture', () => callback())
  },
  onTTSPlay: (callback: (base64Audio: string) => void) => {
    ipcRenderer.on('tts:play', (_event, data) => callback(data))
  },
  onTTSSpeak: (callback: (text: string) => void) => {
    ipcRenderer.on('tts:speak', (_event, text) => callback(text))
  },
  onTTSStop: (callback: () => void) => {
    ipcRenderer.on('tts:stop', () => callback())
  },
  onFadeOut: (callback: () => void) => {
    ipcRenderer.on('overlay:fade-out', () => callback())
  },
  onCursorColorChanged: (callback: (color: string) => void) => {
    ipcRenderer.on('settings:cursor-color', (_event, color) => callback(color))
  },
})
