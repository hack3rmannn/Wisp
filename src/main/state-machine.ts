import { EventEmitter } from 'events'
import { screen } from 'electron'
import { VoiceState } from '../shared/voice-state'
import type { NavigationTarget, ScreenCapture } from '../shared/types'
import { GlobalHotkeyManager } from './global-hotkey'
import { AudioCaptureManager } from './audio-capture'
import { AssemblyAIClient } from './assemblyai-client'
import { ClaudeAPIClient } from './claude-api'
import { ElevenLabsTTSClient } from './elevenlabs-tts'
import { captureAllScreens } from './screen-capture'
import { parsePointingCoordinates } from './point-parser'
import { getIsClickyCursorEnabled } from './config'

/**
 * The system prompt that defines Wisp's personality and behavior.
 * Wisp is a friendly screen companion — helpful, concise, conversational.
 */
const VOICE_RESPONSE_SYSTEM_PROMPT = `you're wisp, a helpful screen companion that floats beside the user's cursor. the user just spoke to you via push-to-talk and you can see their screen(s). your reply will be spoken aloud via text-to-speech, so write the way you'd actually talk. this is an ongoing conversation — you remember everything they've said before.

rules:
- default to one or two sentences. be direct and dense. BUT if the user asks you to explain more, go deeper, or elaborate, then go all out — give a thorough, detailed explanation with no length limit.
- all lowercase, casual, warm. no emojis.
- write for the ear, not the eye. short sentences. no lists, bullet points, markdown, or formatting — just natural speech.
- don't use abbreviations or symbols that sound weird read aloud. write "for example" not "e.g.", spell out small numbers.
- if the user's question relates to what's on their screen, reference specific things you see.
- if the screenshot doesn't seem relevant to their question, just answer the question directly.
- you can help with anything — coding, writing, general knowledge, brainstorming.
- never say "simply" or "just".
- don't read out code verbatim. describe what the code does or what needs to change conversationally.
- focus on giving a thorough, useful explanation. don't end with simple yes/no questions like "want me to explain more?" or "should i show you?" — those are dead ends that force the user to just say yes.
- instead, when it fits naturally, end by planting a seed — mention something bigger or more ambitious they could try, a related concept that goes deeper, or a next-level technique that builds on what you just explained. make it something worth coming back for, not a question they'd just nod to. it's okay to not end with anything extra if the answer is complete on its own.
- if you receive multiple screen images, the one labeled "primary focus" is where the cursor is — prioritize that one but reference others if relevant.

element pointing:
you have a small blue triangle cursor that can fly to and point at things on screen. use it whenever pointing would genuinely help the user — if they're asking how to do something, looking for a menu, trying to find a button, or need help navigating an app, point at the relevant element. err on the side of pointing rather than not pointing, because it makes your help way more useful and concrete.

don't point at things when it would be pointless — like if the user asks a general knowledge question, or the conversation has nothing to do with what's on screen, or you'd just be pointing at something obvious they're already looking at. but if there's a specific UI element, menu, button, or area on screen that's relevant to what you're helping with, point at it.

when you point, append a coordinate tag at the very end of your response, AFTER your spoken text. the screenshot images are labeled with their pixel dimensions. use those dimensions as the coordinate space. the origin (0,0) is the top-left corner of the image. x increases rightward, y increases downward.

format: [POINT:x,y:label] where x,y are integer pixel coordinates in the screenshot's coordinate space, and label is a short 1-3 word description of the element (like "search bar" or "save button"). if the element is on the cursor's screen you can omit the screen number. if the element is on a DIFFERENT screen, append :screenN where N is the screen number from the image label (e.g. :screen2). this is important — without the screen number, the cursor will point at the wrong place.

if pointing wouldn't help, append [POINT:none].

examples:
- user asks how to color grade in final cut: "you'll want to open the color inspector — it's right up in the top right area of the toolbar. click that and you'll get all the color wheels and curves. [POINT:1100,42:color inspector]"
- user asks what html is: "html stands for hypertext markup language, it's basically the skeleton of every web page. curious how it connects to the css you're looking at? [POINT:none]"
- user asks how to commit in vs code: "see the source control icon on the left sidebar? click that, type your commit message up top, then hit the checkmark. [POINT:48,320:source control]"
- element is on screen 2 (not where cursor is): "that's over on your other monitor — see the terminal window? [POINT:400,300:terminal:screen2]"`

/**
 * Central state machine coordinating the full push-to-talk pipeline:
 * hotkey → audio capture → transcription → screenshot → Claude → TTS → pointing
 */
export class StateMachine extends EventEmitter {
  private voiceState: VoiceState = VoiceState.Idle
  private conversationHistory: { userTranscript: string; assistantResponse: string }[] = []
  private currentResponseAbort: AbortController | null = null

  readonly hotkey: GlobalHotkeyManager
  readonly audioCapture: AudioCaptureManager
  private claudeAPI: ClaudeAPIClient
  private ttsClient: ElevenLabsTTSClient
  private assemblyAISession: AssemblyAIClient | null = null
  private transientHideTimer: ReturnType<typeof setTimeout> | null = null
  private isOverlayVisible = false

  constructor(ttsClient: ElevenLabsTTSClient) {
    super()
    this.hotkey = new GlobalHotkeyManager()
    this.audioCapture = new AudioCaptureManager()
    this.claudeAPI = new ClaudeAPIClient()
    this.ttsClient = ttsClient

    this.hotkey.on('transition', (transition: string) => {
      this.handleShortcutTransition(transition as 'pressed' | 'released')
    })

    this.audioCapture.on('audioData', (data: Buffer) => {
      this.assemblyAISession?.sendAudio(data)
    })
  }

  start(): void {
    this.hotkey.start()
    if (getIsClickyCursorEnabled()) {
      this.showOverlay()
    }
  }

  stop(): void {
    this.hotkey.stop()
    this.audioCapture.stop()
    this.assemblyAISession?.cancel()
    this.claudeAPI.abort()
    this.ttsClient.stopPlayback()
  }

  getVoiceState(): VoiceState {
    return this.voiceState
  }

  getIsOverlayVisible(): boolean {
    return this.isOverlayVisible
  }

  showOverlay(): void {
    this.isOverlayVisible = true
    this.emit('overlayVisibility', true)
  }

  hideOverlay(): void {
    this.isOverlayVisible = false
    this.emit('overlayVisibility', false)
  }

  private setVoiceState(state: VoiceState): void {
    this.voiceState = state
    this.emit('voiceStateChanged', state)
  }

  private handleShortcutTransition(transition: 'pressed' | 'released'): void {
    if (transition === 'pressed') {
      this.handlePushToTalkPressed()
    } else {
      this.handlePushToTalkReleased()
    }
  }

  private async handlePushToTalkPressed(): Promise<void> {
    // Cancel any pending transient hide
    if (this.transientHideTimer) {
      clearTimeout(this.transientHideTimer)
      this.transientHideTimer = null
    }

    // If cursor is hidden, bring it back transiently
    if (!getIsClickyCursorEnabled() && !this.isOverlayVisible) {
      this.showOverlay()
    }

    // Cancel any in-progress response
    this.claudeAPI.abort()
    this.ttsClient.stopPlayback()
    this.emit('clearNavigation')

    // Start audio capture and transcription
    this.setVoiceState(VoiceState.Listening)

    try {
      this.assemblyAISession = new AssemblyAIClient({
        onTranscriptUpdate: (_text) => {
          // Partial transcripts — waveform-only UI, no display needed
        },
        onFinalTranscriptReady: (finalTranscript) => {
          console.log(`[Wisp] Transcript: ${finalTranscript}`)
          if (finalTranscript.trim()) {
            this.processTranscriptWithScreenshots(finalTranscript)
          } else {
            this.setVoiceState(VoiceState.Idle)
            this.scheduleTransientHideIfNeeded()
          }
        },
        onError: (error) => {
          console.error('[Wisp] Transcription error:', error)
          this.setVoiceState(VoiceState.Idle)
        },
      })

      await this.assemblyAISession.open()
      this.audioCapture.start()
      // Emit start so the renderer begins capturing mic audio
      this.emit('startAudioCapture')
    } catch (error) {
      console.error('[Wisp] Failed to start transcription:', error)
      this.setVoiceState(VoiceState.Idle)
    }
  }

  private handlePushToTalkReleased(): void {
    this.audioCapture.stop()
    this.emit('stopAudioCapture')
    this.assemblyAISession?.requestFinalTranscript()
  }

  private async processTranscriptWithScreenshots(transcript: string): Promise<void> {
    this.setVoiceState(VoiceState.Processing)

    try {
      const screenshots = await captureAllScreens()

      const fullResponseText = await this.claudeAPI.analyzeImageStreaming({
        screenshots,
        systemPrompt: VOICE_RESPONSE_SYSTEM_PROMPT,
        conversationHistory: this.conversationHistory,
        userPrompt: transcript,
        onTextChunk: (_accumulated) => {
          // No streaming text display — spinner stays until TTS plays
        },
      })

      // Parse pointing tag
      const parseResult = parsePointingCoordinates(fullResponseText)
      const spokenText = parseResult.spokenText

      // Handle element pointing
      if (parseResult.coordinate) {
        this.setVoiceState(VoiceState.Idle)
        this.handleElementPointing(parseResult, screenshots)
      }

      // Save to conversation history (tag stripped)
      this.conversationHistory.push({
        userTranscript: transcript,
        assistantResponse: spokenText,
      })
      if (this.conversationHistory.length > 10) {
        this.conversationHistory.splice(0, this.conversationHistory.length - 10)
      }

      // Play TTS
      if (spokenText.trim()) {
        try {
          await this.ttsClient.speakText(spokenText)
          this.setVoiceState(VoiceState.Responding)
        } catch (ttsError) {
          console.error('[Wisp] TTS error:', ttsError)
        }
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // User spoke again — response was interrupted
        return
      }
      console.error('[Wisp] Response pipeline error:', error)
    }

    this.setVoiceState(VoiceState.Idle)
    this.scheduleTransientHideIfNeeded()
  }

  private handleElementPointing(
    parseResult: ReturnType<typeof parsePointingCoordinates>,
    screenshots: ScreenCapture[]
  ): void {
    if (!parseResult.coordinate) return

    // Pick the target screen
    const targetCapture =
      parseResult.screenNumber && parseResult.screenNumber >= 1 && parseResult.screenNumber <= screenshots.length
        ? screenshots[parseResult.screenNumber - 1]
        : screenshots.find((s) => s.isCursorScreen)

    if (!targetCapture) return

    // Scale from screenshot pixel coords to display point coords
    const scaleX = targetCapture.displayWidthInPoints / targetCapture.screenshotWidthInPixels
    const scaleY = targetCapture.displayHeightInPoints / targetCapture.screenshotHeightInPixels

    const displayLocalX = Math.max(0, Math.min(parseResult.coordinate.x, targetCapture.screenshotWidthInPixels)) * scaleX
    const displayLocalY = Math.max(0, Math.min(parseResult.coordinate.y, targetCapture.screenshotHeightInPixels)) * scaleY

    // Convert to global screen coordinates (top-left origin on Windows)
    const globalX = displayLocalX + targetCapture.displayBounds.x
    const globalY = displayLocalY + targetCapture.displayBounds.y

    const navTarget: NavigationTarget = {
      x: globalX,
      y: globalY,
      label: parseResult.elementLabel,
      bubbleText: null,
      displayId: 0, // Will be resolved by overlay
    }

    console.log(`[Wisp] Pointing: (${parseResult.coordinate.x}, ${parseResult.coordinate.y}) -> "${parseResult.elementLabel ?? 'element'}"`)
    this.emit('navigateToElement', navTarget)
  }

  private scheduleTransientHideIfNeeded(): void {
    if (getIsClickyCursorEnabled() || !this.isOverlayVisible) return

    if (this.transientHideTimer) clearTimeout(this.transientHideTimer)

    this.transientHideTimer = setTimeout(() => {
      // Wait for TTS to finish
      const checkTTS = () => {
        if (this.ttsClient.isPlaying) {
          setTimeout(checkTTS, 200)
          return
        }
        // Pause 1s then fade out
        setTimeout(() => {
          this.hideOverlay()
        }, 1000)
      }
      checkTTS()
    }, 200)
  }
}
