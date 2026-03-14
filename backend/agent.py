import json
import os
from typing import Annotated, Literal, TypedDict
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_core.tools import tool
from langgraph.graph import StateGraph, END, add_messages
from langgraph.prebuilt import ToolNode, tools_condition

from schema import Song, Track, Note

# --- State ---
class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    song: Song
    model: str

# --- Global In-Memory Song State ---
current_song = Song()
chat_history: list[BaseMessage] = []

# Load instruments dictionary
INSTRUMENTS_FILE = os.path.join(os.path.dirname(__file__), "instruments.json")
with open(INSTRUMENTS_FILE, 'r') as f:
    AVAILABLE_INSTRUMENTS = json.load(f)

# Group instruments by engine for the prompt
TONEJS_INSTRUMENTS = [i for i in AVAILABLE_INSTRUMENTS if i["engine"] == "tonejs"]
SMPLR_INSTRUMENTS = [i for i in AVAILABLE_INSTRUMENTS if i["engine"] == "smplr"]

def format_instruments_for_prompt(inst_list):
    return "\n".join([f"    {i['label']} -> engine=\"{i['engine']}\", plugin=\"{i['plugin']}\", bank=\"{i['bank']}\", preset=\"{i['id']}\"" for i in list(inst_list)])

def get_llm_for_model(model_id: str):
    """Returns the appropriate LLM instance for the given model ID."""
    anthropic_models = {
        "claude-opus-4-6":   "claude-opus-4-6",
        "claude-sonnet-4-6": "claude-sonnet-4-6",
        "claude-haiku-4-5":  "claude-haiku-4-5",
    }
    openai_models = {
        "gpt-5.4":     "gpt-5.4",
        "gpt-4.1":     "gpt-4.1",
        "gpt-4o":      "gpt-4o",
    }

    if model_id in anthropic_models:
        # Opus models may need longer timeouts
        timeout = 90 if "opus" in model_id else 60
        return ChatAnthropic(model=anthropic_models[model_id], temperature=0.7, timeout=timeout)  # type: ignore[call-arg]

    # Default to gpt-4o for any unknown / OpenAI model
    model_name = openai_models.get(model_id, "gpt-4o")
    return ChatOpenAI(model=model_name, temperature=0.7, timeout=60)


# --- Tools ---
@tool
def create_track(track_id: str, engine: str, plugin: str, bank: str, preset: str) -> str:
    """Creates a new instrument track.

    Args:
        track_id: A short unique name for the track (e.g. 'kick', 'snare', 'bass', 'lead').
        engine: Must be either "tonejs" or "smplr".
        plugin: The synthesizer class handling the sound.
        bank: The sound bank collection. MUST be 'factory' by default.
        preset: The specific sound within the engine.

    Check the system prompt for the exact combinations of engine, plugin, bank, and preset.
    You can freely mix "tonejs" and "smplr" engines on different tracks, regardless of the song's genre.
    """
    global current_song
    if current_song.get_track(track_id):
        return f"Track '{track_id}' already exists."

    from schema import InstrumentState
    
    # Force cast to prevent LLM sending arbitrary nested strings instead of kwargs
    inst_state = InstrumentState(
        engine=str(engine), 
        plugin=str(plugin),
        bank=str(bank), 
        preset=str(preset)
    )
    
    new_track = Track(id=str(track_id), instrument=inst_state)
    current_song.tracks.append(new_track)
    return f"Created track '{track_id}' (engine={engine}, plugin={plugin}, bank={bank}, preset={preset})."

@tool
def add_notes(track_id: str, notes: list[Note]) -> str:
    """Adds a list of musical notes to a specific track."""
    global current_song
    track = current_song.get_track(track_id)
    if not track:
        return f"Error: Track '{track_id}' does not exist. Please create it first."

    track.notes.extend(notes)
    track.notes.sort(key=lambda x: x.start_time)
    return f"Added {len(notes)} notes to track '{track_id}'."

@tool
def change_tempo(tempo: int) -> str:
    """Changes the global tempo (BPM) of the song."""
    global current_song
    current_song.tempo = tempo
    return f"Song tempo updated to {tempo} BPM."

@tool
def clear_song() -> str:
    """Clears the entire song arrangement to start fresh."""
    global current_song
    current_song = Song()
    return "Song has been cleared."

@tool
def update_track_instrument(track_id: str, engine: str, plugin: str, bank: str, preset: str) -> str:
    """Changes the engine, plugin, bank, and preset of an existing track, preserving its notes.

    Args:
        track_id: The ID of the track to update.
        engine: "tonejs" for electronic synths, "smplr" for acoustic/MIDI instruments.
        plugin: The specific synth class (e.g. "PolySynth" or "Soundfont").
        bank: The sound bank collection (default "factory").
        preset: The new instrument preset within the chosen engine
            (same options as create_track).
    """
    global current_song
    track = current_song.get_track(track_id)
    if not track:
        return f"Error: Track '{track_id}' does not exist."

    track.instrument.engine = str(engine)
    track.instrument.plugin = str(plugin)
    track.instrument.bank = str(bank)
    track.instrument.preset = str(preset)
    return f"Updated track '{track_id}' to engine={engine}, plugin={plugin}, bank={bank}, preset={preset}."

@tool
def set_song_name(name: str) -> str:
    """Sets a creative name for the current song."""
    global current_song
    current_song.name = name
    return f"Song name updated to '{name}'."

@tool
def delete_track(track_id: str) -> str:
    """Deletes an existing track and all of its notes from the arrangement.
    
    Only use this tool if the user explicitly asks you to delete or remove a track.
    If the user has not confirmed yet, ask for confirmation first before calling this tool.
    """
    global current_song
    track = current_song.get_track(track_id)
    if not track:
        return f"Error: Track '{track_id}' does not exist."
        
    current_song.tracks = [t for t in current_song.tracks if t.id != track_id]
    return f"Track '{track_id}' has been permanently deleted."

tools = [create_track, add_notes, change_tempo, clear_song, update_track_instrument, set_song_name, delete_track]
tool_node = ToolNode(tools)

from dotenv import load_dotenv
load_dotenv()

system_prompt_template = """You are an AI Music Producer. You compose symbolic music using tool calls.

CRITICAL BEHAVIORAL RULE:
Unless the user says "start over", "clear", or "new song", ADD to the existing arrangement. Never call clear_song on follow-up requests.
If the user asks to delete a specific track, PLEASE ask for their confirmation first if they haven't explicitly said "yes, delete it" or "delete the bass track". Once confirmed, use the `delete_track` tool.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ENGINE SELECTION & SOUND DESIGN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You have full creative freedom to use any combination of audio engines:
- `tonejs`: Electronic/synthetic synthesis engine (808s, synth basses, EDM leads, synthetic drums).
- `smplr`: Acoustic/real-world sample engine (Piano, guitar, strings, acoustic drums).

Feel free to mix acoustic drums with electronic synths, or lo-fi piano with 808s! 

Below is the EXACT dictionary of available instruments you MUST use. Choose the correct `engine`, `plugin`, `bank`, and `preset` values corresponding to the sounds you want.

AVAILABLE ELECTRONIC SYNTHS (tonejs):
{tonejs_instruments}

AVAILABLE ACOUSTIC/REAL INSTRUMENTS (smplr):
{smplr_instruments}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SONG NAMING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Whenever you create a new song, ALWAYS assign it a short, creative name by calling the `set_song_name` tool.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPOSITION GUIDELINES (CRITICAL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Structure & Length:**
- Unless the user explicitly asks for a short loop, ALWAYS write at least 4 to 8 measures of music.
- In 4/4 time, each measure has 4 beats. 
    - Measure 1 goes from `0:0:0` to `0:3:x`.
    - Measure 4 ends at `3:3:x`. 
    - Measure 8 ends at `7:3:x`.
- If the user asks for a specific length (e.g. 8 measures), you MUST schedule notes all the way up to that length (e.g., `start_time` reaching `7:3:0`).

**Rhythm & Groove:**
- Avoid boring, robotic rhythms. DO NOT just place continuous quarter notes (`4n`) on every beat.
- Use varied note durations like `8n`, `16n`, `8t` (triplets), or dotted notes (`8n.`).
- Introduce syncopation: place notes on the off-beats (e.g., `0:1:2` or `0:2:1`).
- Match the rhythm to the requested genre. For Hip-Hop/Trap, use 16th note hi-hats. For House, use a 4-on-the-floor kick (`0:0:0`, `0:1:0`, `0:2:0`, `0:3:0`) with syncopated basslines.

**Melody & Harmony (Pitch Variation):**
- DO NOT repeat the exact same pitch for the entire track, unless it's a drum/percussion piece.
- Melodies must have interesting pitch contours (a mix of leaps and steps).
- Rely on scales and chord progressions. Use rests (leaving empty time between notes) to make the melody breathe. 
    - A melody does NOT need to have a note playing at every possible moment.
- Basslines should follow a harmonic progression and lock in with the drum groove.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NOTE FORMATTING RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Pitch: scientific notation (C4, D#3, Bb2)
- For kick (tonejs): use low pitches like C1 or B0
- For snare (tonejs): pitch is ignored, use C4 as placeholder
- For hihat (tonejs): use high pitches like A5 or F#5
- For acoustic percussion (smplr): use C4
- start_time: 'bars:beats:sixteenths' — in 4/4: Beat1=0:0:0, Beat2=0:1:0, Beat3=0:2:0, Beat4=0:3:0
- duration: '4n'=quarter, '8n'=eighth, '16n'=sixteenth

Once done with tool calls, respond with a friendly message describing what you created.
"""

def agent_node(state: AgentState):
    messages = state['messages']
    model_id = state.get('model', 'gpt-4o')  # Default to gpt-4o if not specified

    try:
        song_json = current_song.model_dump_json(indent=2)
    except AttributeError:
        song_json = current_song.json(indent=2)
        
    system_prompt = system_prompt_template.format(
        tonejs_instruments=format_instruments_for_prompt(TONEJS_INSTRUMENTS),
        smplr_instruments=format_instruments_for_prompt(SMPLR_INSTRUMENTS)
    )
        
    context_prompt = f"{system_prompt}\n\nCURRENT SONG STATE:\n{song_json}"

    # Ensure the system prompt is injected safely.
    # If the first message in memory is already a SystemMessage, replace it.
    if messages and isinstance(messages[0], SystemMessage):
        messages[0] = SystemMessage(content=context_prompt)
    else:
        messages = [SystemMessage(content=context_prompt)] + messages

    # Get the appropriate LLM for the selected model
    llm = get_llm_for_model(model_id)
    llm_with_tools = llm.bind_tools(tools)
    
    response = llm_with_tools.invoke(messages)
    return {"messages": [response], "song": current_song}

# --- Build the Graph ---
workflow = StateGraph(AgentState)
workflow.add_node("agent", agent_node)
workflow.add_node("tools", tool_node)
workflow.set_entry_point("agent")
workflow.add_conditional_edges("agent", tools_condition)
workflow.add_edge("tools", "agent")

# Compile
app = workflow.compile()
