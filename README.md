# Composr

Composr is an AI-powered music composition tool. Describe the song you want in plain English — genre, mood, length, instrumentation — and a GPT-4o agent builds a full multi-track arrangement in real time. You can then play it back, tweak it via chat, mix it in the Mixer view, and clear it to start fresh.

## How It Works

1. **You describe a song** in the chat panel (e.g. *"Create an 8-measure hip hop beat with an 808 bass and lo-fi piano"*).
2. **The AI agent** (GPT-4o via LangGraph) interprets your request and calls a set of music-composition tools — `create_track`, `add_notes`, `change_tempo`, `set_song_name`, etc. — to build a symbolic song representation stored in memory.
3. **The frontend** receives the updated `Song` JSON and renders it in the Piano Roll. The `AudioEngine` (a Tone.js adapter) schedules and plays back every note using the correct synth or sampler per track.
4. **You can iterate** — ask the agent to add tracks, change instruments, extend the song, adjust tempo, or delete a track. The agent preserves the existing arrangement unless you explicitly ask to start over.

## Architecture

```
composr/
├── backend/          # Python — FastAPI + LangGraph agent
│   ├── main.py       # REST API (FastAPI), CORS, endpoints
│   ├── agent.py      # LangGraph graph, GPT-4o, tool definitions
│   ├── schema.py     # Pydantic models: Song, Track, Note, InstrumentState
│   └── instruments.json  # Shared instrument registry (engine/plugin/bank/preset)
│
├── frontend/         # TypeScript — Next.js 14, Tailwind CSS
│   └── src/
│       ├── app/              # Next.js app router, main page layout
│       ├── components/
│       │   ├── Chat.tsx          # Chat panel (sends messages, streams AI response)
│       │   ├── PianoRoll.tsx     # Arrangement view with per-track mute/solo controls
│       │   ├── Mixer.tsx         # Mixer view with volume/pan faders per channel
│       │   └── TransportTime.tsx # BPM display and playback position
│       └── lib/
│           ├── audio.ts          # AudioEngine — Tone.js scheduling, mute/solo, instrument routing
│           ├── instruments.json  # Shared instrument registry (mirrors backend)
│           └── types.ts          # Shared TypeScript types (Song, Track, Note)
│
└── shared/           # Shared assets (instrument registry source of truth)
```

### Audio Engines

The `AudioEngine` routes each track to one of two playback engines based on the `engine` field:

| Engine | Plugin examples | Sounds |
|--------|----------------|--------|
| `tonejs` | `MembraneSynth`, `NoiseSynth`, `MetalSynth`, `PolySynth`, `AMSynth`, `FMSynth` | Kick, Snare, Hi-Hat, Synth Bass, Lead Synth, Pad, FM Bass, Arp |
| `smplr` | `SplendidGrandPiano`, `Soundfont`, `DrumMachine` | Piano, Guitar, Strings, Brass, Woodwinds, Acoustic Bass, Electric Bass, Banjo, Organ, Accordion, Percussion |

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/state` | Returns the current in-memory `Song` JSON |
| `POST` | `/api/chat` | Sends a user message to the agent; returns the AI reply + updated `Song` |
| `POST` | `/api/state` | Replaces the song state (used by the Clear button to reset) |

### Agent Tools

The LangGraph agent has access to these tools:

| Tool | Description |
|------|-------------|
| `create_track` | Creates a new instrument track with `engine`, `plugin`, `bank`, `preset` |
| `add_notes` | Appends notes (`pitch`, `start_time`, `duration`, `velocity`) to a track |
| `change_tempo` | Sets the global BPM |
| `set_song_name` | Assigns a creative name to the song |
| `update_track_instrument` | Changes an existing track's instrument without losing notes |
| `delete_track` | Permanently removes a track (requires user confirmation) |
| `clear_song` | Resets the entire arrangement |

## Getting Started

### Prerequisites

- **Python 3.11+**
- **Node.js 18+**
- An **OpenAI API key** (GPT-4o access)

### 1. Start the Backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create your .env file
echo "OPENAI_API_KEY=sk-..." > .env

# Start the API server (runs on http://127.0.0.1:8000)
uvicorn main:app --reload
```

### 2. Start the Frontend

In a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** to start composing.

## UI Overview

- **Chat panel** — Describe or refine your song in natural language.
- **Arrangement view** — A piano roll showing all tracks and their notes. Each track has **Mute** and **Solo** buttons.
- **Mixer view** — Toggle with the Mixer button in the toolbar. Each track becomes a channel strip with **volume** and **pan** faders. Hover a channel to see the full instrument configuration (engine, plugin, bank, preset).
- **Transport** — Play/Stop, current playback time, and BPM display.
- **Clear** — Resets the song and chat history so you can start a new composition.
