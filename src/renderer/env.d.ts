/// <reference types="vite/client" />

interface WispAPI {
  setModel: (model: string) => void
  setWispVisible: (enabled: boolean) => void
  setWorkerURL: (url: string) => void
  quitApp: () => void
  getSettings: () => Promise<any>
  getState: () => Promise<any>
  sendAudioData: (base64Data: string) => void
  sendAudioPowerLevel: (level: number) => void
  notifyTTSFinished: () => void
  onCursorPosition: (callback: (position: any) => void) => void
  onVoiceStateChanged: (callback: (state: string) => void) => void
  onAudioPowerLevel: (callback: (level: number) => void) => void
  onNavigateToElement: (callback: (target: any) => void) => void
  onOverlayVisibility: (callback: (visible: boolean) => void) => void
  onStartAudioCapture: (callback: () => void) => void
  onStopAudioCapture: (callback: () => void) => void
  onTTSPlay: (callback: (base64Audio: string) => void) => void
  onTTSStop: (callback: () => void) => void
  onFadeOut: (callback: () => void) => void
}

declare global {
  interface Window {
    wispAPI: WispAPI
  }
}

export {}
