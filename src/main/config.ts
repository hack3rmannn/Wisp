import Store from 'electron-store'

const store = new Store({
  defaults: {
    selectedModel: 'claude-sonnet-4-6',
    isClickyCursorEnabled: true,
    workerBaseURL: '',
    cursorColor: '#FBBF24',
  },
})

export function getSelectedModel(): string {
  return store.get('selectedModel') as string
}

export function setSelectedModel(model: string): void {
  store.set('selectedModel', model)
}

export function getIsClickyCursorEnabled(): boolean {
  return store.get('isClickyCursorEnabled') as boolean
}

export function setIsClickyCursorEnabled(enabled: boolean): void {
  store.set('isClickyCursorEnabled', enabled)
}

export function getWorkerBaseURL(): string {
  return store.get('workerBaseURL') as string
}

export function setWorkerBaseURL(url: string): void {
  store.set('workerBaseURL', url)
}

export function getCursorColor(): string {
  return store.get('cursorColor') as string
}

export function setCursorColor(color: string): void {
  store.set('cursorColor', color)
}

export function getAllSettings() {
  return {
    selectedModel: getSelectedModel(),
    isClickyCursorEnabled: getIsClickyCursorEnabled(),
    workerBaseURL: getWorkerBaseURL(),
    cursorColor: getCursorColor(),
  }
}
