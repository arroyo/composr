# Composr — Shared

Assets shared between the **backend** and **frontend** that must stay in sync.

## Contents

| File | Description |
|------|-------------|
| `instruments.json` | Canonical instrument registry consumed by both the Python agent and the React audio engine |

## `instruments.json`

Defines every instrument available in the system as a flat JSON array. Each entry has four fields:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique instrument identifier used as the `preset` value in a `Track`'s `InstrumentState` |
| `engine` | `"tonejs" \| "smplr"` | Audio engine that renders the instrument |
| `plugin` | `string` | Specific synth class or sampler plugin within that engine |
| `bank` | `string` | Sound bank (`"factory"` for all built-ins) |
| `label` | `string` | Human-readable display name |

### Example entry

```json
{ "id": "kick", "engine": "tonejs", "plugin": "MembraneSynth", "bank": "factory", "label": "Kick Drum / 808" }
```

### Instrument groups

**Tone.js — electronic / synthetic** (`engine: "tonejs"`)

| ID | Plugin | Label |
|----|--------|-------|
| `kick` | `MembraneSynth` | Kick Drum / 808 |
| `snare` | `NoiseSynth` | Snare Drum |
| `hihat` | `MetalSynth` | Hi-Hat |
| `cymbal` | `MetalSynth` | Cymbal |
| `bass_synth` | `PolySynth` | Synth Bass |
| `lead_synth` | `PolySynth` | Lead Synth |
| `pad` | `AMSynth` | Pad Synth |
| `fm_bass` | `FMSynth` | FM Bass |
| `arp` | `PolySynth` | Arp Synth |

**smplr — acoustic / sampled** (`engine: "smplr"`)

Includes Grand Piano (`SplendidGrandPiano`), Electric Piano, guitars (steel, nylon, electric), strings (violin, viola, cello, contrabass), woodwinds (flute, clarinet, oboe), brass (trumpet, trombone), basses (acoustic, electric finger/pick), harp, banjo, sitar, church organ, accordion, and percussion (taiko, woodblock, reverse cymbal, steel drums, synth drum, melodic tom).

## Adding a New Instrument

1. Append an entry to `instruments.json` following the schema above.
2. If the instrument uses `engine: "smplr"` with `plugin: "Soundfont"`, make sure the `id` matches a valid General MIDI soundfont name recognised by the `smplr` library.
3. The backend agent reads this file at startup to build its system prompt — restart the backend after any changes.
4. The frontend imports instruments directly from this file (or its copy) — no rebuild step is needed beyond a dev-server refresh.
