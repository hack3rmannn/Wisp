import React, { useEffect } from 'react'
import { PanelApp } from './panel/PanelApp'
import { OverlayApp } from './overlay/OverlayApp'

/**
 * Dedicated audio capture view — no UI, just mic recording.
 * Runs in a hidden non-transparent window to avoid the Windows
 * transparent-window getUserMedia segfault.
 */
function AudioCaptureApp() {
  useEffect(() => {
    const api = (window as any).wispAPI
    if (!api) return

    let audioContext: AudioContext | null = null
    let mediaStream: MediaStream | null = null
    let workletNode: AudioWorkletNode | null = null
    let analyser: AnalyserNode | null = null
    let powerInterval: ReturnType<typeof setInterval> | null = null
    let sending = false
    let pendingBuffer: Int16Array[] = []
    let pendingLength = 0
    const TARGET_CHUNK_SIZE = 4096

    // AudioWorklet processor code as a Blob URL
    const workletCode = `
      class PCM16Processor extends AudioWorkletProcessor {
        process(inputs) {
          const input = inputs[0]
          if (!input || !input[0]) return true
          const float32 = input[0]
          const pcm16 = new Int16Array(float32.length)
          for (let i = 0; i < float32.length; i++) {
            const s = Math.max(-1, Math.min(1, float32[i]))
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
          }
          this.port.postMessage(pcm16.buffer, [pcm16.buffer])
          return true
        }
      }
      registerProcessor('pcm16-processor', PCM16Processor)
    `

    // Pre-initialize audio pipeline on load so it's ready instantly for push-to-talk
    async function initAudio() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
          },
        })
        mediaStream = stream
        audioContext = new AudioContext({ sampleRate: 16000 })

        const blob = new Blob([workletCode], { type: 'application/javascript' })
        const workletUrl = URL.createObjectURL(blob)
        await audioContext.audioWorklet.addModule(workletUrl)
        URL.revokeObjectURL(workletUrl)

        console.log(`[AudioCapture] Actual sample rate: ${audioContext.sampleRate}`)

        const source = audioContext.createMediaStreamSource(stream)
        workletNode = new AudioWorkletNode(audioContext, 'pcm16-processor')

        workletNode.port.onmessage = (event) => {
          if (!sending) return
          const chunk = new Int16Array(event.data)
          pendingBuffer.push(chunk)
          pendingLength += chunk.length
          if (pendingLength >= TARGET_CHUNK_SIZE) {
            const merged = new Int16Array(pendingLength)
            let offset = 0
            for (const buf of pendingBuffer) {
              merged.set(buf, offset)
              offset += buf.length
            }
            api.sendAudioBuffer(merged.buffer.slice(0))
            pendingBuffer = []
            pendingLength = 0
          }
        }

        source.connect(workletNode)
        workletNode.connect(audioContext.destination)

        // Power level polling
        analyser = audioContext.createAnalyser()
        analyser.fftSize = 256
        source.connect(analyser)

        console.log('[AudioCapture] Pre-initialized and ready')
      } catch (err) {
        console.error('[AudioCapture] Failed to initialize:', err)
      }
    }

    function startSending() {
      sending = true
      // Start power level polling
      if (analyser) {
        const dataArray = new Float32Array(analyser.fftSize)
        powerInterval = setInterval(() => {
          analyser!.getFloatTimeDomainData(dataArray)
          let sum = 0
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i] * dataArray[i]
          api.sendAudioPowerLevel(Math.sqrt(sum / dataArray.length))
        }, 100)
      }
      console.log('[AudioCapture] Sending started')
    }

    function stopSending() {
      // Flush any remaining buffered audio
      if (pendingBuffer.length > 0) {
        const merged = new Int16Array(pendingLength)
        let offset = 0
        for (const buf of pendingBuffer) {
          merged.set(buf, offset)
          offset += buf.length
        }
        api.sendAudioBuffer(merged.buffer.slice(0))
      }
      pendingBuffer = []
      pendingLength = 0
      sending = false
      if (powerInterval) { clearInterval(powerInterval); powerInterval = null }
      console.log('[AudioCapture] Sending stopped')
    }

    // Initialize immediately
    initAudio()

    api.onStartAudioCapture(() => startSending())
    api.onStopAudioCapture(() => stopSending())

    // TTS via Edge TTS (mp3 base64 from main process)
    let audioPlayer: HTMLAudioElement | null = null

    api.onTTSPlay((base64Audio: string) => {
      if (audioPlayer) { audioPlayer.pause(); audioPlayer = null }
      const audioBlob = new Blob(
        [Uint8Array.from(atob(base64Audio), (c) => c.charCodeAt(0))],
        { type: 'audio/mpeg' }
      )
      const url = URL.createObjectURL(audioBlob)
      audioPlayer = new Audio(url)
      audioPlayer.onended = () => {
        URL.revokeObjectURL(url)
        audioPlayer = null
        api.notifyTTSFinished()
      }
      audioPlayer.play().catch((err) => {
        console.error('[TTS] Playback error:', err)
        api.notifyTTSFinished()
      })
      console.log('[TTS] Playing Edge TTS audio')
    })

    // Fallback: browser speechSynthesis
    api.onTTSSpeak((text: string) => {
      speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 1.05
      utterance.pitch = 1.0
      utterance.onend = () => api.notifyTTSFinished()
      utterance.onerror = () => api.notifyTTSFinished()
      speechSynthesis.speak(utterance)
      console.log('[TTS] Fallback: speaking via speechSynthesis')
    })

    api.onTTSStop(() => {
      if (audioPlayer) { audioPlayer.pause(); audioPlayer = null }
      speechSynthesis.cancel()
    })
  }, [])

  return null
}

/**
 * Routes between panel, overlay, and audio-capture views based on URL hash.
 * Panel: #panel           — settings, model picker, status
 * Overlay: #overlay       — transparent cursor companion per-monitor
 * Audio: #audio-capture   — hidden window for mic recording
 */
export default function App() {
  const hash = window.location.hash

  if (hash.startsWith('#panel')) {
    document.body.className = 'panel-view'
    return <PanelApp />
  }

  if (hash.startsWith('#audio-capture')) {
    return <AudioCaptureApp />
  }

  if (hash.startsWith('#overlay')) {
    document.body.className = 'overlay-view'
    return <OverlayApp />
  }

  // Default to panel
  document.body.className = 'panel-view'
  return <PanelApp />
}
