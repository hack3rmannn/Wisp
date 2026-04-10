/**
 * Dedicated audio capture renderer.
 * Runs in a hidden (non-transparent) BrowserWindow to avoid the
 * transparent-window getUserMedia crash on Windows.
 */
const api = (window as any).wispAPI
if (!api) throw new Error('wispAPI not available')

let audioContext: AudioContext | null = null
let mediaStream: MediaStream | null = null
let processor: ScriptProcessorNode | null = null

async function startCapture() {
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
    const source = audioContext.createMediaStreamSource(stream)

    processor = audioContext.createScriptProcessor(4096, 1, 1)

    processor.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0)

      // Convert Float32 to Int16
      const pcm16 = new Int16Array(inputData.length)
      let sumSquares = 0
      for (let i = 0; i < inputData.length; i++) {
        const sample = Math.max(-1, Math.min(1, inputData[i]))
        pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
        sumSquares += sample * sample
      }

      // Convert to base64 in chunks to avoid call stack overflow
      const uint8 = new Uint8Array(pcm16.buffer)
      const chunkSize = 1024
      const parts: string[] = []
      for (let j = 0; j < uint8.length; j += chunkSize) {
        const slice = uint8.subarray(j, Math.min(j + chunkSize, uint8.length))
        parts.push(String.fromCharCode.apply(null, slice as unknown as number[]))
      }
      const base64 = btoa(parts.join(''))
      api.sendAudioData(base64)

      // Send audio power level
      const rms = Math.sqrt(sumSquares / inputData.length)
      api.sendAudioPowerLevel(rms)
    }

    source.connect(processor)
    processor.connect(audioContext.destination)
    console.log('[AudioCapture] Started')
  } catch (err) {
    console.error('[AudioCapture] Failed to start:', err)
  }
}

function stopCapture() {
  processor?.disconnect()
  processor = null
  audioContext?.close()
  audioContext = null
  mediaStream?.getTracks().forEach((t) => t.stop())
  mediaStream = null
  console.log('[AudioCapture] Stopped')
}

api.onStartAudioCapture(() => startCapture())
api.onStopAudioCapture(() => stopCapture())
