import { EventEmitter } from 'events'

/**
 * Captures microphone audio using the Web Audio API in a hidden renderer window.
 * Streams raw PCM16 mono 16kHz audio data via IPC for AssemblyAI transcription.
 *
 * Since Electron's main process doesn't have direct microphone access,
 * we use the renderer process's navigator.mediaDevices.getUserMedia API
 * via IPC messages. The overlay renderer handles the actual capture.
 */
export class AudioCaptureManager extends EventEmitter {
  private isRecording = false

  start(): void {
    if (this.isRecording) return
    this.isRecording = true
    this.emit('start')
    console.log('[Audio] Recording started')
  }

  stop(): void {
    if (!this.isRecording) return
    this.isRecording = false
    this.emit('stop')
    console.log('[Audio] Recording stopped')
  }

  getIsRecording(): boolean {
    return this.isRecording
  }

  /**
   * Called from the renderer process with PCM16 audio data chunks.
   * Forwards to the AssemblyAI client.
   */
  handleAudioData(pcm16Data: Buffer): void {
    if (!this.isRecording) return
    this.emit('audioData', pcm16Data)
  }

  /**
   * Called from the renderer process with the current audio power level.
   */
  handleAudioPowerLevel(level: number): void {
    this.emit('powerLevel', level)
  }
}

/**
 * Computes the RMS (root mean square) of a PCM16 audio buffer,
 * normalized to 0.0 - 1.0 range.
 */
export function computeRMS(pcm16Data: Buffer): number {
  const sampleCount = pcm16Data.length / 2
  if (sampleCount === 0) return 0

  let sumSquares = 0
  for (let i = 0; i < pcm16Data.length; i += 2) {
    const sample = pcm16Data.readInt16LE(i)
    sumSquares += sample * sample
  }

  const rms = Math.sqrt(sumSquares / sampleCount)
  // Normalize: Int16 max is 32768
  return Math.min(rms / 32768, 1.0)
}
