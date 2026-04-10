import WebSocket from 'ws'
import { getWorkerBaseURL } from './config'

interface TurnMessage {
  type: string
  transcript?: string
  turn_order?: number
  end_of_turn?: boolean
  turn_is_formatted?: boolean
}

interface StoredTurnTranscript {
  transcriptText: string
  isFormatted: boolean
}

/**
 * AssemblyAI streaming transcription client.
 * Fetches a temporary token from the Cloudflare Worker, opens a WebSocket
 * to AssemblyAI, and streams PCM16 audio for real-time transcription.
 */
export class AssemblyAIClient {
  private ws: WebSocket | null = null
  private storedTurnsByOrder: Map<number, StoredTurnTranscript> = new Map()
  private activeTurnOrder: number | null = null
  private activeTurnText = ''
  private latestTranscriptText = ''
  private hasDeliveredFinalTranscript = false
  private isAwaitingFinalTranscript = false
  private finalTranscriptDeadlineTimer: ReturnType<typeof setTimeout> | null = null

  private onTranscriptUpdate: (text: string) => void
  private onFinalTranscriptReady: (text: string) => void
  private onError: (error: Error) => void

  constructor(callbacks: {
    onTranscriptUpdate: (text: string) => void
    onFinalTranscriptReady: (text: string) => void
    onError: (error: Error) => void
  }) {
    this.onTranscriptUpdate = callbacks.onTranscriptUpdate
    this.onFinalTranscriptReady = callbacks.onFinalTranscriptReady
    this.onError = callbacks.onError
  }

  async open(): Promise<void> {
    const token = await this.fetchTemporaryToken()
    console.log(`[AssemblyAI] Fetched temporary token (${token.substring(0, 20)}...)`)

    const wsURL = new URL('wss://streaming.assemblyai.com/v3/ws')
    wsURL.searchParams.set('sample_rate', '16000')
    wsURL.searchParams.set('encoding', 'pcm_s16le')
    wsURL.searchParams.set('format_turns', 'true')
    wsURL.searchParams.set('speech_model', 'u3-rt-pro')
    wsURL.searchParams.set('token', token)

    return new Promise<void>((resolve, reject) => {
      this.ws = new WebSocket(wsURL.toString())

      this.ws.on('open', () => {
        console.log('[AssemblyAI] WebSocket connected')
      })

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString())
          this.handleMessage(message, resolve)
        } catch (err) {
          console.error('[AssemblyAI] Failed to parse message:', err)
        }
      })

      this.ws.on('error', (err) => {
        reject(err)
        this.onError(err)
      })

      this.ws.on('close', () => {
        console.log('[AssemblyAI] WebSocket closed')
        if (this.isAwaitingFinalTranscript && !this.hasDeliveredFinalTranscript) {
          this.deliverFinalTranscript(this.bestAvailableTranscript())
        }
      })
    })
  }

  sendAudio(pcm16Data: Buffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(pcm16Data)
    }
  }

  requestFinalTranscript(): void {
    if (this.hasDeliveredFinalTranscript) return
    this.isAwaitingFinalTranscript = true
    this.scheduleFinalTranscriptDeadline()
    this.sendJSON({ type: 'ForceEndpoint' })
  }

  cancel(): void {
    if (this.finalTranscriptDeadlineTimer) {
      clearTimeout(this.finalTranscriptDeadlineTimer)
      this.finalTranscriptDeadlineTimer = null
    }
    this.sendJSON({ type: 'Terminate' })
    this.ws?.close()
    this.ws = null
  }

  private async fetchTemporaryToken(): Promise<string> {
    const workerURL = getWorkerBaseURL()
    const response = await fetch(`${workerURL}/transcribe-token`, {
      method: 'POST',
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Failed to fetch AssemblyAI token (HTTP ${response.status}): ${body}`)
    }

    const json = (await response.json()) as { token: string }
    return json.token
  }

  private handleMessage(message: any, resolveReady: (value: void) => void): void {
    const type = message.type?.toLowerCase()

    switch (type) {
      case 'begin':
        resolveReady()
        break

      case 'turn':
        this.handleTurnMessage(message as TurnMessage)
        break

      case 'termination':
        if (this.isAwaitingFinalTranscript && !this.hasDeliveredFinalTranscript) {
          this.deliverFinalTranscript(this.bestAvailableTranscript())
        }
        break

      case 'error':
        this.onError(new Error(message.error || message.message || 'AssemblyAI error'))
        break
    }
  }

  private handleTurnMessage(turn: TurnMessage): void {
    const transcript = turn.transcript?.trim() ?? ''
    const turnOrder =
      turn.turn_order ??
      this.activeTurnOrder ??
      (this.storedTurnsByOrder.size > 0
        ? Math.max(...this.storedTurnsByOrder.keys()) + 1
        : 0)

    if (turn.end_of_turn || turn.turn_is_formatted) {
      this.activeTurnOrder = null
      this.activeTurnText = ''
      this.storeTurnTranscript(transcript, turnOrder, turn.turn_is_formatted === true)
    } else {
      this.activeTurnOrder = turnOrder
      this.activeTurnText = transcript
    }

    const fullTranscript = this.composeFullTranscript()
    this.latestTranscriptText = fullTranscript

    if (fullTranscript) {
      this.onTranscriptUpdate(fullTranscript)
    }

    if (this.isAwaitingFinalTranscript && (turn.end_of_turn || turn.turn_is_formatted)) {
      if (this.finalTranscriptDeadlineTimer) {
        clearTimeout(this.finalTranscriptDeadlineTimer)
        this.finalTranscriptDeadlineTimer = null
      }
      this.deliverFinalTranscript(this.bestAvailableTranscript())
    }
  }

  private storeTurnTranscript(text: string, turnOrder: number, isFormatted: boolean): void {
    if (!text) return
    const existing = this.storedTurnsByOrder.get(turnOrder)
    if (existing?.isFormatted && !isFormatted) return
    this.storedTurnsByOrder.set(turnOrder, { transcriptText: text, isFormatted })
  }

  private composeFullTranscript(): string {
    const committedSegments = [...this.storedTurnsByOrder.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, stored]) => stored.transcriptText)
      .filter((t) => t.length > 0)

    const segments = [...committedSegments]
    const activeTrimmed = this.activeTurnText.trim()
    if (activeTrimmed) {
      segments.push(activeTrimmed)
    }

    return segments.join(' ')
  }

  private scheduleFinalTranscriptDeadline(): void {
    if (this.finalTranscriptDeadlineTimer) {
      clearTimeout(this.finalTranscriptDeadlineTimer)
    }
    this.finalTranscriptDeadlineTimer = setTimeout(() => {
      this.deliverFinalTranscript(this.bestAvailableTranscript())
    }, 1400) // 1.4s grace period
  }

  private deliverFinalTranscript(text: string): void {
    if (this.hasDeliveredFinalTranscript) return
    this.hasDeliveredFinalTranscript = true
    if (this.finalTranscriptDeadlineTimer) {
      clearTimeout(this.finalTranscriptDeadlineTimer)
      this.finalTranscriptDeadlineTimer = null
    }
    this.onFinalTranscriptReady(text)
    this.sendJSON({ type: 'Terminate' })
  }

  private bestAvailableTranscript(): string {
    const composed = this.composeFullTranscript().trim()
    return composed || this.latestTranscriptText.trim()
  }

  private sendJSON(payload: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload))
    }
  }
}
