# Composr — Backend

The backend is a Python API server that hosts a **LangGraph agentic loop** connected to **GPT-4o**. The agent receives natural-language music instructions, calls symbolic composition tools, and returns an updated in-memory `Song` object to the frontend.

## Tech Stack

| Library | Role |
|---------|------|
| **FastAPI** | REST API server — handles `/api/chat` and `/api/state` |
| **LangGraph** | Agentic graph framework — drives the tool-calling loop |
| **LangChain / ChatOpenAI** | GPT-4o model binding and message history |
| **Pydantic** | Strict schema validation for `Song`, `Track`, `Note`, `InstrumentState` |
| **python-dotenv** | Loads `OPENAI_API_KEY` from `.env` |
| **Uvicorn** | ASGI server |

## Key Libraries

### FastAPI
FastAPI was chosen as the HTTP layer because it is lightweight, async-native, and generates OpenAPI documentation automatically. Its `response_model` parameter lets us declare that `/api/chat` always returns a valid `Song` object — if the agent produces malformed output, FastAPI raises a validation error before bad data ever reaches the frontend. The built-in CORS middleware handles cross-origin requests from the Next.js dev server without additional configuration.

### LangGraph
LangGraph manages the agentic loop as a stateful directed graph. The graph has two nodes — `agent` and `tools` — connected by a conditional edge: after every LLM response, LangGraph checks whether the model requested tool calls and routes accordingly, looping back until the model produces a final text reply with no pending calls. This structure makes it straightforward to add new tools (just append to the `tools` list) and makes the control flow explicit rather than buried in manual loop logic.

### LangChain / ChatOpenAI
LangChain's `ChatOpenAI` wrapper handles GPT-4o authentication, message formatting, and tool binding (`bind_tools`). Keeping the model call behind a LangChain abstraction means the underlying model can be swapped (e.g. to `gpt-4o-mini`, Claude, or a local model) by changing a single line in `agent.py` without touching graph or tool logic.

### Pydantic
Every musical object (`Song`, `Track`, `Note`, `InstrumentState`) is a Pydantic `BaseModel`. This serves two purposes:
1. **Input validation** — when the agent calls a tool like `add_notes`, Pydantic coerces and validates the arguments, rejecting invalid pitches or malformed timing strings before they can corrupt the in-memory state.
2. **Serialization** — `model_dump_json()` produces the canonical JSON that is both injected into the agent's system prompt (as "CURRENT SONG STATE") and returned to the frontend, ensuring the two representations are always identical.

### python-dotenv
Loads the `OPENAI_API_KEY` (and any future secrets) from a `.env` file at startup, keeping credentials out of source control and making local vs. production configuration trivial to manage.

### Uvicorn
Uvicorn is the ASGI server that runs FastAPI. The `--reload` flag (used in development) watches source files and restarts automatically, making the edit-test loop fast when iterating on agent behavior or tool definitions.

## File Overview

```
backend/
├── main.py           # FastAPI app — routes, CORS, request/response models
├── agent.py          # LangGraph graph, GPT-4o LLM, tool definitions, system prompt
├── schema.py         # Pydantic models: Song, Track, Note, InstrumentState
├── instruments.json  # Registry of all available instruments (shared with frontend)
├── requirements.txt  # Python dependencies
└── .env              # Your OpenAI API key (not committed)
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/state` | Returns the current in-memory `Song` JSON |
| `POST` | `/api/chat` | Sends a user message to the agent; returns the AI reply + updated `Song` |
| `POST` | `/api/state` | Replaces the song state and clears chat history (used by the Clear button) |

## Data Schema

```
Song
├── name          str       — Creative song title
├── tempo         int       — BPM (default 120)
├── time_signature tuple    — e.g. (4, 4)
└── tracks        Track[]
        ├── id          str   — Unique track name (e.g. "kick", "bass", "lead")
        ├── instrument  InstrumentState
        │       ├── engine  "tonejs" | "smplr"
        │       ├── plugin  str  — Synth class (e.g. "PolySynth", "Soundfont")
        │       ├── bank    str  — Sound bank (default "factory")
        │       └── preset  str  — Instrument ID from instruments.json
        ├── notes       Note[]
        │       ├── pitch       str   — Scientific notation (e.g. "C4", "D#3")
        │       ├── start_time  str   — "bars:beats:sixteenths" (e.g. "0:1:0")
        │       ├── duration    str   — "4n", "8n", "16n", etc.
        │       └── velocity    float — 0.0–1.0
        ├── volume  float  — dB (-60.0 to 6.0, default 0.0)
        └── pan     float  — Stereo pan (-1.0 left to 1.0 right, default 0.0)
```

## Agent Tools

Defined in `agent.py` and bound to the GPT-4o model:

| Tool | Description |
|------|-------------|
| `create_track` | Creates a new track with `engine`, `plugin`, `bank`, `preset` |
| `add_notes` | Appends a list of `Note` objects to an existing track |
| `change_tempo` | Sets the global BPM |
| `set_song_name` | Assigns a creative name to the song |
| `update_track_instrument` | Changes an existing track's instrument without losing notes |
| `delete_track` | Permanently deletes a track (agent asks for confirmation first) |
| `clear_song` | Resets the entire in-memory arrangement |

## Instrument Registry

`instruments.json` defines every available instrument as an array of entries:

```json
{ "id": "kick", "engine": "tonejs", "plugin": "MembraneSynth", "bank": "factory", "label": "Kick Drum / 808" }
```

The agent's system prompt is injected with the full instrument list at runtime, split into two groups:

- **Tone.js (electronic):** `kick`, `snare`, `hihat`, `cymbal`, `bass_synth`, `lead_synth`, `pad`, `fm_bass`, `arp`
- **smplr (acoustic/sampled):** Grand Piano, Electric Piano, Guitar (Steel/Nylon/Electric), Violin, Viola, Cello, Contrabass, Flute, Clarinet, Oboe, Trumpet, Trombone, Acoustic/Electric Bass, Harp, Banjo, Sitar, Organ, Accordion, and percussion (Taiko, Woodblock, Steel Drums, etc.)

## Setup & Running

### 1. Create a virtual environment

```bash
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure environment variables

Create a `.env` file in this directory:

```env
OPENAI_API_KEY=sk-...
```

### 4. Start the server

```bash
uvicorn main:app --reload
```

The API server will be available at **http://127.0.0.1:8000**.

## Modifying the Agent

- **System prompt & composition rules** — edit the `system_prompt_template` string in `agent.py`.
- **Add a new tool** — define a `@tool`-decorated function in `agent.py`, then append it to the `tools` list.
- **Add an instrument** — add a new entry to `instruments.json` (and mirror it in `frontend/src/lib/instruments.json`).
- **Change the model** — update the `ChatOpenAI(model=...)` call in `agent.py`.
