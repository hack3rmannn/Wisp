import type { PointingParseResult } from '../shared/types'

/**
 * Parses a [POINT:x,y:label:screenN] or [POINT:none] tag from the end of
 * Claude's response. Returns the spoken text (tag removed) and the optional
 * coordinate + label + screen number.
 */
export function parsePointingCoordinates(responseText: string): PointingParseResult {
  // Match [POINT:none] or [POINT:123,456:label] or [POINT:123,456:label:screen2]
  const pattern = /\[POINT:(?:none|(\d+)\s*,\s*(\d+)(?::([^\]:\s][^\]:]*?))?(?::screen(\d+))?)\]\s*$/

  const match = responseText.match(pattern)
  if (!match) {
    return { spokenText: responseText, coordinate: null, elementLabel: null, screenNumber: null }
  }

  // Remove the tag from the spoken text
  const spokenText = responseText.slice(0, match.index).trimEnd()

  // Check if it's [POINT:none] — match[1] will be undefined
  if (match[1] === undefined || match[2] === undefined) {
    return { spokenText, coordinate: null, elementLabel: 'none', screenNumber: null }
  }

  const x = parseInt(match[1], 10)
  const y = parseInt(match[2], 10)
  const elementLabel = match[3]?.trim() ?? null
  const screenNumber = match[4] ? parseInt(match[4], 10) : null

  return {
    spokenText,
    coordinate: { x, y },
    elementLabel,
    screenNumber,
  }
}
