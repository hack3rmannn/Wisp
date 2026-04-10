import React, { useEffect, useRef, useState, useCallback } from 'react'
import { DS } from '../design-system'
import { BlueCursor } from './BlueCursor'
import { Waveform } from './Waveform'
import { Spinner } from './Spinner'
import { SpeechBubble } from './SpeechBubble'
import {
  computeBezierFlightFrame,
  computeFlightDuration,
  type FlightConfig,
} from './CursorAnimation'

type NavigationMode = 'followingCursor' | 'navigatingToTarget' | 'pointingAtTarget'

const POINTER_PHRASES = [
  'right here!',
  'this one!',
  'look here!',
  'over here!',
  'see this!',
  'found it!',
]

/**
 * Full-screen transparent overlay for one display.
 * Renders the blue cursor companion, waveform, spinner, and speech bubbles.
 * Receives cursor position and state updates from the main process via IPC.
 */
export function OverlayApp() {
  // Parse display info from URL hash
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '')
  const displayId = parseInt(params.get('displayId') || '0')
  const displayX = parseInt(params.get('x') || '0')
  const displayY = parseInt(params.get('y') || '0')
  const displayW = parseInt(params.get('w') || '1920')
  const displayH = parseInt(params.get('h') || '1080')

  // Cursor state
  const [cursorX, setCursorX] = useState(displayW / 2)
  const [cursorY, setCursorY] = useState(displayH / 2)
  const [isCursorOnThisScreen, setIsCursorOnThisScreen] = useState(false)

  // Voice state
  const [voiceState, setVoiceState] = useState('idle')
  const [audioPowerLevel, setAudioPowerLevel] = useState(0)

  // Dynamic cursor color
  const [cursorColor, setCursorColor] = useState(DS.Colors.overlayCursor)

  // Navigation state
  const [navMode, setNavMode] = useState<NavigationMode>('followingCursor')
  const [rotationDegrees, setRotationDegrees] = useState(-35)
  const [flightScale, setFlightScale] = useState(1)
  const [navBubbleText, setNavBubbleText] = useState('')
  const [navBubbleOpacity, setNavBubbleOpacity] = useState(0)
  const [navBubbleScale, setNavBubbleScale] = useState(1)

  // Welcome state
  const [welcomeText, setWelcomeText] = useState('')
  const [welcomeOpacity, setWelcomeOpacity] = useState(0)
  const [showWelcome, setShowWelcome] = useState(true)

  // Overlay opacity for fade in/out
  const [overlayOpacity, setOverlayOpacity] = useState(1)

  // Refs
  const navModeRef = useRef<NavigationMode>('followingCursor')
  const isReturningRef = useRef(false)
  const cursorWhenNavStartedRef = useRef({ x: 0, y: 0 })
  const animFrameRef = useRef<number>(0)
  const cursorXRef = useRef(displayW / 2)
  const cursorYRef = useRef(displayH / 2)

  // TTS playback ref
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null)

  // Sync navMode ref
  useEffect(() => {
    navModeRef.current = navMode
  }, [navMode])

  // ── IPC Event Listeners ──

  useEffect(() => {
    const api = (window as any).wispAPI
    if (!api) return

    // Cursor position tracking
    api.onCursorPosition((pos: { x: number; y: number; displayId: number }) => {
      const isOnScreen = pos.displayId === displayId
      setIsCursorOnThisScreen(isOnScreen)

      if (navModeRef.current !== 'followingCursor') return

      // Convert global coords to display-local
      const localX = pos.x - displayX + 35
      const localY = pos.y - displayY + 25
      cursorXRef.current = localX
      cursorYRef.current = localY
      setCursorX(localX)
      setCursorY(localY)
    })

    api.onVoiceStateChanged((state: string) => setVoiceState(state))
    api.onAudioPowerLevel((level: number) => setAudioPowerLevel(level))

    // Navigation target
    api.onNavigateToElement((target: any) => {
      if (!target) {
        cancelNavigationAndResume()
        return
      }
      // Convert global target coords to display-local
      const localX = target.x - displayX + 8
      const localY = target.y - displayY + 12
      // Only handle if target is roughly on this screen
      if (localX >= -50 && localX <= displayW + 50 && localY >= -50 && localY <= displayH + 50) {
        startNavigatingToElement(localX, localY, target.bubbleText)
      }
    })

    // Cursor color changes
    api.onCursorColorChanged((color: string) => setCursorColor(color))

    // TTS playback
    api.onTTSPlay((base64Audio: string) => playTTSAudio(base64Audio))
    api.onTTSStop(() => stopTTSAudio())

    // Fade out
    api.onFadeOut(() => {
      setOverlayOpacity(0)
    })
  }, [])

  // ── Welcome Animation ──
  useEffect(() => {
    if (!showWelcome) return
    const message = "hey, i'm wisp"
    let index = 0

    // Fade in
    setTimeout(() => setWelcomeOpacity(1), 500)

    const timer = setInterval(() => {
      if (index >= message.length) {
        clearInterval(timer)
        // Hold for 3s, then fade out
        setTimeout(() => setWelcomeOpacity(0), 3000)
        setTimeout(() => setShowWelcome(false), 3500)
        return
      }
      setWelcomeText(message.slice(0, index + 1))
      index++
    }, 40)

    return () => clearInterval(timer)
  }, [])

  // ── TTS Playback ──
  const playTTSAudio = useCallback((base64Audio: string) => {
    stopTTSAudio()
    const audioBlob = new Blob(
      [Uint8Array.from(atob(base64Audio), (c) => c.charCodeAt(0))],
      { type: 'audio/mpeg' }
    )
    const url = URL.createObjectURL(audioBlob)
    const audio = new Audio(url)
    audioPlayerRef.current = audio

    audio.onended = () => {
      URL.revokeObjectURL(url)
      audioPlayerRef.current = null
      ;(window as any).wispAPI?.notifyTTSFinished()
    }

    audio.play().catch(console.error)
  }, [])

  const stopTTSAudio = useCallback(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause()
      audioPlayerRef.current = null
    }
  }, [])

  // ── Navigation ──
  const startNavigatingToElement = useCallback(
    (targetX: number, targetY: number, bubbleText: string | null) => {
      const clampedX = Math.max(20, Math.min(targetX, displayW - 20))
      const clampedY = Math.max(20, Math.min(targetY, displayH - 20))

      cursorWhenNavStartedRef.current = { x: cursorXRef.current, y: cursorYRef.current }
      isReturningRef.current = false
      setNavMode('navigatingToTarget')

      const config: FlightConfig = {
        startX: cursorXRef.current,
        startY: cursorYRef.current,
        endX: clampedX,
        endY: clampedY,
      }

      const duration = computeFlightDuration(config.startX, config.startY, config.endX, config.endY)
      const startTime = performance.now()

      const animate = (now: number) => {
        const elapsed = (now - startTime) / 1000
        const progress = Math.min(elapsed / duration, 1)

        const frame = computeBezierFlightFrame(config, progress)
        setCursorX(frame.x)
        setCursorY(frame.y)
        setRotationDegrees(frame.rotationDegrees)
        setFlightScale(frame.scale)

        if (progress < 1) {
          animFrameRef.current = requestAnimationFrame(animate)
        } else {
          setFlightScale(1)
          startPointingAtElement(bubbleText)
        }
      }

      animFrameRef.current = requestAnimationFrame(animate)
    },
    [displayW, displayH]
  )

  const startPointingAtElement = useCallback((bubbleText: string | null) => {
    setNavMode('pointingAtTarget')
    setRotationDegrees(-35)
    setNavBubbleText('')
    setNavBubbleOpacity(1)
    setNavBubbleScale(0.5)

    const phrase = bubbleText || POINTER_PHRASES[Math.floor(Math.random() * POINTER_PHRASES.length)]

    // Stream text character by character
    let charIndex = 0
    const streamChar = () => {
      if (charIndex >= phrase.length) {
        // Hold 3s, then fly back
        setTimeout(() => {
          setNavBubbleOpacity(0)
          setTimeout(() => startFlyingBack(), 500)
        }, 3000)
        return
      }
      setNavBubbleText(phrase.slice(0, charIndex + 1))
      if (charIndex === 0) setNavBubbleScale(1) // Pop-in on first char
      charIndex++
      setTimeout(streamChar, 30 + Math.random() * 30) // 30-60ms per char
    }
    streamChar()
  }, [])

  const startFlyingBack = useCallback(() => {
    isReturningRef.current = true
    setNavMode('navigatingToTarget')

    const config: FlightConfig = {
      startX: cursorXRef.current,
      startY: cursorYRef.current,
      endX: cursorWhenNavStartedRef.current.x,
      endY: cursorWhenNavStartedRef.current.y,
    }

    const duration = computeFlightDuration(config.startX, config.startY, config.endX, config.endY)
    const startTime = performance.now()

    const animate = (now: number) => {
      const elapsed = (now - startTime) / 1000
      const progress = Math.min(elapsed / duration, 1)

      const frame = computeBezierFlightFrame(config, progress)
      setCursorX(frame.x)
      setCursorY(frame.y)
      setRotationDegrees(frame.rotationDegrees)
      setFlightScale(frame.scale)

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate)
      } else {
        finishNavigation()
      }
    }

    animFrameRef.current = requestAnimationFrame(animate)
  }, [])

  const cancelNavigationAndResume = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current)
    setNavBubbleText('')
    setNavBubbleOpacity(0)
    setNavBubbleScale(1)
    setFlightScale(1)
    finishNavigation()
  }, [])

  const finishNavigation = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current)
    setNavMode('followingCursor')
    isReturningRef.current = false
    setRotationDegrees(-35)
    setFlightScale(1)
    setNavBubbleText('')
    setNavBubbleOpacity(0)
    setNavBubbleScale(1)
  }, [])

  // ── Determine what's visible ──
  const showTriangle = isCursorOnThisScreen && (voiceState === 'idle' || voiceState === 'responding')
  const showWaveform = isCursorOnThisScreen && voiceState === 'listening'
  const showSpinner = isCursorOnThisScreen && voiceState === 'processing'

  // During navigation, always show on this screen regardless of cursor
  const isNavigating = navMode === 'navigatingToTarget' || navMode === 'pointingAtTarget'
  const buddyVisible = isNavigating || isCursorOnThisScreen

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        opacity: overlayOpacity,
        transition: `opacity ${DS.Animation.slow}s`,
      }}
    >
      {/* Nearly transparent background for compositing */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.001)' }} />

      {/* Welcome bubble */}
      {showWelcome && welcomeText && buddyVisible && (
        <div
          style={{
            position: 'absolute',
            left: cursorX + 10,
            top: cursorY + 18,
            opacity: welcomeOpacity,
            transition: `opacity ${DS.Animation.slow}s, left 0.2s, top 0.2s`,
            pointerEvents: 'none',
          }}
        >
          <SpeechBubble text={welcomeText} opacity={1} scale={1} />
        </div>
      )}

      {/* Navigation pointer bubble */}
      {navMode === 'pointingAtTarget' && navBubbleText && (
        <div
          style={{
            position: 'absolute',
            left: cursorX + 10,
            top: cursorY + 18,
            pointerEvents: 'none',
          }}
        >
          <SpeechBubble text={navBubbleText} opacity={navBubbleOpacity} scale={navBubbleScale} />
        </div>
      )}

      {/* Blue triangle cursor */}
      <div
        style={{
          position: 'absolute',
          left: cursorX - 8,
          top: cursorY - 8,
          opacity: buddyVisible && (showTriangle || isNavigating) ? 1 : 0,
          transition: navMode === 'followingCursor'
            ? `left 0.15s cubic-bezier(0.25, 0.46, 0.45, 0.94), top 0.15s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.25s`
            : 'opacity 0.25s',
          pointerEvents: 'none',
        }}
      >
        <BlueCursor rotationDegrees={rotationDegrees} scale={flightScale} color={cursorColor} />
      </div>

      {/* Waveform — listening state */}
      <div
        style={{
          position: 'absolute',
          left: cursorX - 8,
          top: cursorY - 8,
          opacity: showWaveform ? 1 : 0,
          transition: `left 0.15s, top 0.15s, opacity 0.15s`,
          pointerEvents: 'none',
        }}
      >
        <Waveform audioPowerLevel={audioPowerLevel} color={cursorColor} />
      </div>

      {/* Spinner — processing state */}
      <div
        style={{
          position: 'absolute',
          left: cursorX - 7,
          top: cursorY - 7,
          opacity: showSpinner ? 1 : 0,
          transition: `left 0.15s, top 0.15s, opacity 0.15s`,
          pointerEvents: 'none',
        }}
      >
        <Spinner color={cursorColor} />
      </div>
    </div>
  )
}
