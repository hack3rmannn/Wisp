import { EventEmitter } from 'events'
import { uIOhook, UiohookKey } from 'uiohook-napi'

export type ShortcutTransition = 'pressed' | 'released' | 'none'

/**
 * Detects Ctrl+Alt press and release using a low-level keyboard hook.
 * Emits 'pressed' when both modifiers are held simultaneously,
 * and 'released' when either modifier is released.
 */
export class GlobalHotkeyManager extends EventEmitter {
  private ctrlHeld = false
  private altHeld = false
  private isShortcutCurrentlyPressed = false
  private started = false

  start(): void {
    if (this.started) return
    this.started = true

    uIOhook.on('keydown', (event) => {
      this.handleKeyEvent(event.keycode, true)
    })

    uIOhook.on('keyup', (event) => {
      this.handleKeyEvent(event.keycode, false)
    })

    uIOhook.start()
    console.log('[Hotkey] Global keyboard hook started')
  }

  stop(): void {
    if (!this.started) return
    this.started = false
    uIOhook.stop()
    this.ctrlHeld = false
    this.altHeld = false
    this.isShortcutCurrentlyPressed = false
    console.log('[Hotkey] Global keyboard hook stopped')
  }

  getIsPressed(): boolean {
    return this.isShortcutCurrentlyPressed
  }

  private handleKeyEvent(keycode: number, isDown: boolean): void {
    // Track Control key state (left or right)
    if (keycode === UiohookKey.Ctrl || keycode === UiohookKey.CtrlRight) {
      this.ctrlHeld = isDown
    }

    // Track Alt key state (left or right)
    if (keycode === UiohookKey.Alt || keycode === UiohookKey.AltRight) {
      this.altHeld = isDown
    }

    const bothHeld = this.ctrlHeld && this.altHeld

    if (bothHeld && !this.isShortcutCurrentlyPressed) {
      // Transition: not pressed -> pressed
      this.isShortcutCurrentlyPressed = true
      this.emit('transition', 'pressed' as ShortcutTransition)
    } else if (!bothHeld && this.isShortcutCurrentlyPressed) {
      // Transition: pressed -> released
      this.isShortcutCurrentlyPressed = false
      this.emit('transition', 'released' as ShortcutTransition)
    }
  }
}
