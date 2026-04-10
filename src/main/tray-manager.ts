import { app, Tray, BrowserWindow, nativeImage, screen } from 'electron'
import path from 'path'

/**
 * Manages the system tray icon and the floating settings panel window.
 * The panel appears below the tray icon on click and auto-dismisses on blur.
 */
export class TrayManager {
  private tray: Tray | null = null
  private panelWindow: BrowserWindow | null = null
  private panelVisible = false

  constructor(private preloadPath: string, private rendererURL: string) {}

  create(): void {
    // Create a simple blue triangle icon programmatically
    const iconSize = 16
    const icon = nativeImage.createEmpty()

    // On Windows, use a template icon or a bundled .ico
    // For now create a simple colored icon
    this.tray = new Tray(this.createTrayIcon())
    this.tray.setToolTip('Wisp — AI Screen Companion')

    this.tray.on('click', (_event, bounds) => {
      this.togglePanel(bounds)
    })

    this.createPanelWindow()
  }

  getPanelWindow(): BrowserWindow | null {
    return this.panelWindow
  }

  private createTrayIcon(): nativeImage {
    // Create a 16x16 canvas-like icon with a blue triangle
    // Using raw RGBA pixel data
    const size = 16
    const buffer = Buffer.alloc(size * size * 4, 0) // RGBA, transparent

    // Draw a filled amber triangle
    const blue = { r: 251, g: 191, b: 36, a: 255 } // #FBBF24
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // Simple triangle: top-center to bottom-left and bottom-right
        const centerX = size / 2
        const progress = y / size
        const halfWidth = progress * (size / 2)
        if (x >= centerX - halfWidth && x <= centerX + halfWidth && y >= 2) {
          const offset = (y * size + x) * 4
          buffer[offset] = blue.r
          buffer[offset + 1] = blue.g
          buffer[offset + 2] = blue.b
          buffer[offset + 3] = blue.a
        }
      }
    }

    return nativeImage.createFromBuffer(buffer, { width: size, height: size })
  }

  private createPanelWindow(): void {
    this.panelWindow = new BrowserWindow({
      width: 320,
      height: 420,
      show: false,
      frame: false,
      resizable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      transparent: false,
      backgroundColor: '#121010',
      webPreferences: {
        preload: this.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
      },
    })

    this.panelWindow.loadURL(`${this.rendererURL}#panel`)

    this.panelWindow.on('blur', () => {
      this.hidePanel()
    })

    this.panelWindow.on('closed', () => {
      this.panelWindow = null
    })
  }

  private togglePanel(trayBounds: Electron.Rectangle): void {
    if (this.panelVisible) {
      this.hidePanel()
    } else {
      this.showPanel(trayBounds)
    }
  }

  private showPanel(trayBounds: Electron.Rectangle): void {
    if (!this.panelWindow) return

    const panelBounds = this.panelWindow.getBounds()
    const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y })
    const workArea = display.workArea

    // Center horizontally on the tray icon
    let x = Math.round(trayBounds.x + trayBounds.width / 2 - panelBounds.width / 2)

    // If tray is in the bottom half of the screen, open above; otherwise below
    let y: number
    if (trayBounds.y > workArea.y + workArea.height / 2) {
      y = trayBounds.y - panelBounds.height - 4
    } else {
      y = trayBounds.y + trayBounds.height + 4
    }

    // Clamp to work area so the panel never goes off-screen
    x = Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - panelBounds.width))
    y = Math.max(workArea.y, Math.min(y, workArea.y + workArea.height - panelBounds.height))

    this.panelWindow.setPosition(x, y)
    this.panelWindow.show()
    this.panelVisible = true
  }

  hidePanel(): void {
    if (!this.panelWindow || !this.panelVisible) return
    this.panelWindow.hide()
    this.panelVisible = false
  }

  destroy(): void {
    this.tray?.destroy()
    this.panelWindow?.destroy()
  }
}
