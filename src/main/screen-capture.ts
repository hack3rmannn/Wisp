import { desktopCapturer, screen } from 'electron'
import type { ScreenCapture } from '../shared/types'

/**
 * Captures all connected displays as JPEG screenshots.
 * Returns them sorted so the cursor screen is first.
 */
export async function captureAllScreens(): Promise<ScreenCapture[]> {
  const displays = screen.getAllDisplays()
  const cursorPoint = screen.getCursorScreenPoint()

  // Determine which display the cursor is on
  const cursorDisplay = screen.getDisplayNearestPoint(cursorPoint)

  // Capture all screens
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 1280, height: 1280 },
  })

  const captures: ScreenCapture[] = []

  for (const display of displays) {
    // Match source to display by display_id
    const source = sources.find((s) => {
      // desktopCapturer source display_id is a string of the display id
      return s.display_id === String(display.id)
    })

    if (!source) continue

    const thumbnail = source.thumbnail
    const jpegBuffer = thumbnail.toJPEG(80)
    const isCursorScreen = display.id === cursorDisplay.id
    const size = thumbnail.getSize()

    captures.push({
      imageData: jpegBuffer.toString('base64'),
      label: '', // Will be set below after sorting
      isCursorScreen,
      displayWidthInPoints: display.bounds.width,
      displayHeightInPoints: display.bounds.height,
      screenshotWidthInPixels: size.width,
      screenshotHeightInPixels: size.height,
      displayBounds: display.bounds,
    })
  }

  // Sort so cursor screen is first
  captures.sort((a, b) => {
    if (a.isCursorScreen && !b.isCursorScreen) return -1
    if (!a.isCursorScreen && b.isCursorScreen) return 1
    return 0
  })

  // Add labels after sorting
  captures.forEach((capture, index) => {
    const screenNum = index + 1
    const total = captures.length
    if (capture.isCursorScreen) {
      capture.label = `screen ${screenNum} of ${total} — cursor is on this screen (primary focus)`
    } else {
      capture.label = `screen ${screenNum} of ${total}`
    }
  })

  return captures
}
