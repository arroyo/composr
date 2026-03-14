# Composr — Frontend

The frontend is a **Next.js 14** application that provides the Composr UI: a chat panel for talking to the AI agent, a Piano Roll arrangement view, a Mixer view, and a real-time audio engine for playback.

## Tech Stack

| Library | Role |
|---------|------|
| **Next.js 14** | React framework with App Router |
| **TypeScript** | Type-safe components and audio engine |
| **Tailwind CSS** | Utility-first styling with glassmorphism theme |
| **Tone.js** | Web Audio scheduling engine (tempo-aware, bar/beat/sixteenth timing) |
| **smplr** | Sampler library for acoustic instruments (`SplendidGrandPiano`, `Soundfont`, `DrumMachine`) |

## File Overview

```
frontend/src/
├── app/
│   ├── layout.tsx        # Root layout — fonts, global styles
│   └── page.tsx          # Main page — composes Chat, PianoRoll, Mixer, transport
│
├── components/
│   ├── Chat.tsx           # Chat panel — sends messages to /api/chat, displays AI replies
│   ├── PianoRoll.tsx      # Arrangement view — renders notes per track, Mute/Solo buttons
│   ├── Mixer.tsx          # Mixer view — per-channel volume/pan faders, instrument tooltip
│   └── TransportTime.tsx  # BPM counter and live playback position display
│
└── lib/
    ├── audio.ts           # AudioEngine class — Tone.js + smplr scheduling, mute/solo, cleanup
    ├── instruments.json   # Instrument registry (mirrors backend/instruments.json)
    ├── instruments.d.ts   # TypeScript types for instrument registry
    ├── types.ts           # Shared types: Song, Track, Note, InstrumentState
    └── utils.ts           # Shared utility helpers
```

## Key Concepts

### AudioEngine (`lib/audio.ts`)

The central audio system. Key responsibilities:

- **Dual-engine routing** — inspects each `Track.instrument.engine` and dispatches to either a Tone.js synth or a smplr sampler.
- **Tone.js synths** — `MembraneSynth` (kick), `NoiseSynth` (snare), `MetalSynth` (hihat/cymbal), `PolySynth` (bass/lead/arp), `AMSynth` (pad), `FMSynth` (fm bass).
- **smplr samplers** — `SplendidGrandPiano` (acoustic grand), `Soundfont` (GM instruments), `DrumMachine` (percussion kits).
- **Mute / Solo state** — each track is routed through a `Tone.Channel`. Mute and solo flags are tracked per `track_id` and resolved before playback.
- **Cleanup** — disposes all synths, samplers, and players; clears mute/solo state between songs.
- **Timing** — notes use Tone.js `"bars:beats:sixteenths"` format matching the backend schema.

### Views

| View | Toggle | Description |
|------|--------|-------------|
| **Arrangement** | Default | Piano Roll grid — shows all tracks and their note events |
| **Mixer** | Mixer button | Channel strips with volume (dB) and pan faders per track |

### Instrument Tooltip (Mixer)

Hovering a channel in the Mixer reveals the track's full instrument config — `engine`, `plugin`, `bank`, and `preset` — so you always know exactly what synth is behind each channel.

### Song State Flow

```
User types in Chat
    → POST /api/chat
    → Agent responds with updated Song JSON
    → page.tsx sets songState
    → PianoRoll + Mixer re-render
    → AudioEngine.loadSong() schedules new notes
```

## Setup & Running

### Prerequisites

- Node.js 18+
- Backend server running at `http://127.0.0.1:8000` (see `../backend/README.md`)

### Install & start

```bash
npm install
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)**.

### Environment

By default the frontend proxies API calls to `http://127.0.0.1:8000`. If you change the backend port, update the fetch URLs in `app/page.tsx`.

## Adding Instruments

1. Add a new entry to `src/lib/instruments.json` (and mirror it in `backend/instruments.json`).
2. In `audio.ts`, add a new case in the instrument routing block if the new instrument uses a plugin not already handled.

## Adding UI Components

Components live in `src/components/`. They receive `Song` state from `page.tsx` as props and communicate user actions (play, stop, clear, instrument change) via callbacks passed down from the parent.
