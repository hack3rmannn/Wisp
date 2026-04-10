import { BrowserWindow, screen } from 'electron'
import { IPC } from '../shared/ipc-channels'
import type { CursorPosition, DisplayInfo } from '../shared/types'

/**
 * Creates and manages one transparent, click-through, always-on-top
 * overlay window per connected display. The cursor companion renders
 * inside these overlays.
 */
export class OverlayManager {
  private overlayWindows: Map<number, BrowserWindow> = new Map()
  private cursorTrackingInterval: ReturnType<typeof setInterval> | null = null
  private isVisible = false

  constructor(private preloadPath: string, private rendererURL: string) {}

  /**
   * Creates overlay windows for all connected displays and starts
   * 60fps cursor position tracking.
   */
  showOverlays(): void {
    this.hideOverlays()
    this.isVisible = true

    const displays = screen.getAllDisplays()

    for (const display of displays) {
      const overlayWindow = new BrowserWindow({
        x: display.bounds.x,
        y: display.bounds.y,
        width: display.bounds.width,
        height: display.bounds.height,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        focusable: false,
        hasShadow: false,
        resizable: false,
        fullscreenable: false,
        webPreferences: {
          preload: this.preloadPath,
          contextIsolation: true,
          nodeIntegration: false,
        },
      })

      // Click-through: all mouse events pass to windows behind
      overlayWindow.setIgnoreMouseEvents(true)
      overlayWindow.setAlwaysOnTop(true, 'screen-saver')
      overlayWindow.setVisibleOnAllWorkspaces(true)

      // Load overlay view with display info as query params
      const url = `${this.rendererURL}#overlay?displayId=${display.id}&x=${display.bounds.x}&y=${display.bounds.y}&w=${display.bounds.width}&h=${display.bounds.height}&scale=${display.scaleFactor}`
      overlayWindow.loadURL(url)

      overlayWindow.showInactive()

      overlayWindow.webContents.on('render-process-gone', (_event, details) => {
        console.error(`[Overlay] Renderer crashed on display ${display.id}:`, details.reason, details.exitCode)
      })

      overlayWindow.webContents.on('crashed', () => {
        console.error(`[Overlay] WebContents crashed on display ${display.id}`)
      })

      this.overlayWindows.set(display.id, overlayWindow)
    }

    this.startCursorTracking()
  }

  /**
   * Hides and destroys all overlay windows.
   */
  hideOverlays(): void {
    this.stopCursorTracking()
    this.isVisible = false

    for (const [, window] of this.overlayWindows) {
      if (!window.isDestroyed()) {
        window.destroy()
      }
    }
    this.overlayWindows.clear()
  }

  /**
   * Fade out overlays over ~400ms then destroy them.
   */
  fadeOutAndHide(): void {
    // Send fade-out command to all overlays
    this.broadcastToOverlays('overlay:fade-out', {})
    // Destroy after animation completes
    setTimeout(() => this.hideOverlays(), 450)
  }

  getIsVisible(): boolean {
    return this.isVisible
  }

  /**
   * Returns the first overlay window (cursor screen) for audio playback.
   */
  getFirstOverlayWindow(): BrowserWindow | null {
    const first = this.overlayWindows.values().next().value
    return first && !first.isDestroyed() ? first : null
  }

  /**
   * Sends a message to all overlay renderers.
   */
  broadcastToOverlays(channel: string, data: any): void {
    for (const [id, window] of this.overlayWindows) {
      try {
        if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
          window.webContents.send(channel, data)
        }
      } catch {
        // Window or render frame was disposed — remove it
        this.overlayWindows.delete(id)
      }
    }
  }

  /**
   * Polls cursor position at ~60fps and sends updates to all overlays.
   */
  private startCursorTracking(): void {
    this.cursorTrackingInterval = setInterval(() => {
      const point = screen.getCursorScreenPoint()
      const cursorDisplay = screen.getDisplayNearestPoint(point)

      const position: CursorPosition = {
        x: point.x,
        y: point.y,
        displayId: cursorDisplay.id,
      }

      this.broadcastToOverlays(IPC.CURSOR_POSITION_UPDATE, position)
    }, 16) // ~60fps
  }

  private stopCursorTracking(): void {
    if (this.cursorTrackingInterval) {
      clearInterval(this.cursorTrackingInterval)
      this.cursorTrackingInterval = null
    }
  }
}
