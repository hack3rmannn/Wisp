import { BrowserWindow } from 'electron'

const VOICE = 'en-US-AvaMultilingualNeural'

/**
 * TTS client using Microsoft Edge's free neural TTS service via edge-tts-universal.
 * Natural-sounding female voice, no API key required.
 */
export class ElevenLabsTTSClient {
  private isCurrentlyPlaying = false
  private playbackWindow: BrowserWindow | null = null

  get isPlaying(): boolean {
    return this.isCurrentlyPlaying
  }

  setPlaybackWindow(window: BrowserWindow): void {
    this.playbackWindow = window
  }

  async speakText(text: string): Promise<void> {
    if (!this.playbackWindow || this.playbackWindow.isDestroyed()) return

    try {
      // Dynamic import to avoid ESM/CJS issues at startup
      const { EdgeTTS } = await import('edge-tts-universal')
      const tts = new EdgeTTS(text, VOICE, { rate: '+5%' })
      const result = await tts.synthesize()
      const arrayBuffer = await result.audio.arrayBuffer()
      const audioBuffer = Buffer.from(arrayBuffer)

      console.log(`[TTS] Playing ${Math.round(audioBuffer.byteLength / 1024)}KB audio (Edge TTS - ${VOICE})`)

      if (this.playbackWindow && !this.playbackWindow.isDestroyed()) {
        this.isCurrentlyPlaying = true
        this.playbackWindow.webContents.send('tts:play', audioBuffer.toString('base64'))
      }
    } catch (error) {
      console.error('[TTS] Edge TTS error:', error)
      // Fall back to browser speechSynthesis
      if (this.playbackWindow && !this.playbackWindow.isDestroyed()) {
        this.isCurrentlyPlaying = true
        this.playbackWindow.webContents.send('tts:speak', text)
      }
    }
  }

  onPlaybackFinished(): void {
    this.isCurrentlyPlaying = false
  }

  stopPlayback(): void {
    this.isCurrentlyPlaying = false
    if (this.playbackWindow && !this.playbackWindow.isDestroyed()) {
      this.playbackWindow.webContents.send('tts:stop')
    }
  }
}
