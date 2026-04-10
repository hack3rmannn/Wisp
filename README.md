# Wisp

An AI screen companion that lives in your system tray. Hold **Ctrl+Alt** to talk — Wisp sees your screen, understands what you're asking, speaks back in a natural voice, and points at the thing you're talking about.

## What it does

1. **You talk** — hold Ctrl+Alt and speak naturally ("how do I save this file?")
2. **Wisp sees your screen** — captures screenshots of all your monitors
3. **Wisp thinks** — sends your question + screenshots to Claude for a vision-powered answer
4. **Wisp speaks** — reads the answer aloud in a natural voice (Microsoft Edge neural TTS)
5. **Wisp points** — the cursor flies over and highlights the exact UI element you need

## Demo

> *Coming soon*

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/hack3rmannn/wisp.git
cd wisp
npm install
```

### 2. Deploy the API proxy

Wisp routes Claude and AssemblyAI requests through a Cloudflare Worker so your API keys stay safe. You need your own keys:

- [Anthropic API key](https://console.anthropic.com/) — for Claude vision
- [AssemblyAI API key](https://www.assemblyai.com/) — for speech-to-text

```bash
cd worker
npm install
npx wrangler login
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put ASSEMBLYAI_API_KEY
npx wrangler deploy
```

Copy the Worker URL it prints (e.g. `https://wisp-proxy.YOUR_SUBDOMAIN.workers.dev`).

### 3. Run Wisp

```bash
cd ..
npm run dev
```

Click the Wisp icon in your system tray, paste your Worker URL into the settings panel, and you're good to go.

## Features

- **Push-to-talk** — Ctrl+Alt to speak, release to send
- **Multi-monitor** — sees and points at elements across all connected displays
- **Cursor color picker** — 8 color presets in the settings panel
- **Natural voice** — Microsoft Edge neural TTS (free, no API key needed)
- **Model selection** — Claude Sonnet 4.6 (fast) or Opus 4.6 (most capable)
- **Element pointing** — Wisp flies to and highlights the exact button/link/element on your screen

## Tech Stack

- **Electron** + **React** + **TypeScript**
- **Claude** (Anthropic) for vision + reasoning
- **AssemblyAI** for real-time speech transcription
- **Edge TTS** for natural-sounding voice (free)
- **Cloudflare Workers** for secure API proxying

## Build

```bash
npm run build      # Production build
npm run package    # Build + package Windows installer
```

## License

MIT
