import { getWorkerBaseURL, getSelectedModel } from './config'
import type { ScreenCapture } from '../shared/types'

/**
 * Claude API client with SSE streaming support.
 * All requests go through the Cloudflare Worker proxy.
 */
export class ClaudeAPIClient {
  private abortController: AbortController | null = null

  /**
   * Sends screenshots + user transcript to Claude with streaming.
   * Returns the full accumulated response text.
   */
  async analyzeImageStreaming(options: {
    screenshots: ScreenCapture[]
    systemPrompt: string
    conversationHistory: { userTranscript: string; assistantResponse: string }[]
    userPrompt: string
    onTextChunk: (accumulatedText: string) => void
  }): Promise<string> {
    this.abortController = new AbortController()
    const workerURL = getWorkerBaseURL()
    const model = getSelectedModel()

    // Build messages array with conversation history
    const messages: any[] = []

    for (const entry of options.conversationHistory) {
      messages.push({ role: 'user', content: entry.userTranscript })
      messages.push({ role: 'assistant', content: entry.assistantResponse })
    }

    // Build current message with all labeled images + prompt
    const contentBlocks: any[] = []
    for (const capture of options.screenshots) {
      const mediaType = detectMediaType(capture.imageData)
      contentBlocks.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: capture.imageData,
        },
      })
      const dimensionLabel = `${capture.label} (image dimensions: ${capture.screenshotWidthInPixels}x${capture.screenshotHeightInPixels} pixels)`
      contentBlocks.push({ type: 'text', text: dimensionLabel })
    }
    contentBlocks.push({ type: 'text', text: options.userPrompt })
    messages.push({ role: 'user', content: contentBlocks })

    const body = {
      model,
      max_tokens: 1024,
      stream: true,
      system: options.systemPrompt,
      messages,
    }

    const bodyJSON = JSON.stringify(body)
    const payloadMB = (bodyJSON.length / 1_048_576).toFixed(1)
    console.log(`[Claude] Streaming request: ${payloadMB}MB, ${options.screenshots.length} image(s)`)

    const response = await fetch(`${workerURL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyJSON,
      signal: this.abortController.signal,
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`Claude API error (${response.status}): ${errorBody}`)
    }

    console.log(`[Claude] Response received, status: ${response.status}, streaming...`)

    // Parse SSE stream
    let accumulatedText = ''
    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Process complete lines
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? '' // Keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const jsonString = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed.slice(5)
        if (jsonString === '[DONE]' || !jsonString) continue

        try {
          const event = JSON.parse(jsonString)
          if (
            event.type === 'content_block_delta' &&
            event.delta?.type === 'text_delta' &&
            event.delta?.text
          ) {
            accumulatedText += event.delta.text
            options.onTextChunk(accumulatedText)
          }
        } catch {
          // Skip malformed JSON lines
        }
      }
    }

    console.log(`[Claude] Response complete (${accumulatedText.length} chars)`)
    return accumulatedText
  }

  abort(): void {
    this.abortController?.abort()
    this.abortController = null
  }
}

function detectMediaType(base64Data: string): string {
  // Check first bytes via base64 — PNG starts with iVBOR (base64 of 0x89 0x50 0x4E 0x47)
  if (base64Data.startsWith('iVBOR')) {
    return 'image/png'
  }
  return 'image/jpeg'
}
