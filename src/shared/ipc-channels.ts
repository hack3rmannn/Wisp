export const IPC = {
  // Main -> Renderer
  CURSOR_POSITION_UPDATE: 'cursor:position',
  VOICE_STATE_CHANGED: 'voice:state-changed',
  AUDIO_POWER_LEVEL: 'audio:power-level',
  RESPONSE_TEXT_CHUNK: 'response:text-chunk',
  RESPONSE_COMPLETE: 'response:complete',
  NAVIGATE_TO_ELEMENT: 'cursor:navigate-to',
  OVERLAY_VISIBILITY: 'overlay:visibility',
  DISPLAY_INFO: 'display:info',

  // Renderer -> Main
  SET_MODEL: 'settings:set-model',
  SET_CLICKY_VISIBLE: 'settings:set-visible',
  QUIT_APP: 'app:quit',
  REQUEST_STATE: 'state:request',
  GET_SETTINGS: 'settings:get',
} as const
