import json
import os
from typing import Annotated, Literal, TypedDict
from langchain_openai import ChatOpenAI
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_core.tools import tool
from langgraph.graph import StateGraph, END, add_messages
from langgraph.prebuilt import ToolNode, tools_condition

from schema import Song, Track, Note

# --- State ---
class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    song: Song

# --- Global In-Memory Song State ---
current_song = Song()

# Load instruments dictionary
INSTRUMENTS_FILE = os.path.join(os.path.dirname(__file__), "instruments.json")
with open(INSTRUMENTS_FILE, 'r') as f:
    AVAILABLE_INSTRUMENTS = json.load(f)

# Group instruments by engine for the prompt
TONEJS_INSTRUMENTS = [i for i in AVAILABLE_INSTRUMENTS if i["engine"] == "tonejs"]
SMPLR_INSTRUMENTS = [i for i in AVAILABLE_INSTRUMENTS if i["engine"] == "smplr"]

def format_instruments_for_prompt(inst_list):
    return "\n".join([f"    {i['label']} -> engine=\"{i['engine']}\", plugin=\"{i['plugin']}\", bank=\"{i['bank']}\", preset=\"{i['id']}\"" for i in list(inst_list)])


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

tools = [create_track, add_notes, change_tempo, clear_song, update_track_instrument, set_song_name]
tool_node = ToolNode(tools)

from dotenv import load_dotenv
load_dotenv()

# --- Agent Initialization ---
llm = ChatOpenAI(model="gpt-4o", temperature=0.7)
llm_with_tools = llm.bind_tools(tools)

system_prompt_template = """You are an AI Music Producer. You compose symbolic music using tool calls.

CRITICAL BEHAVIORAL RULE:
Unless the user says "start over", "clear", or "new song", ADD to the existing arrangement. Never call clear_song on follow-up requests.

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
NOTE WRITING RULES
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

    try:
        song_json = current_song.model_dump_json(indent=2)
    except AttributeError:
        song_json = current_song.json(indent=2)
        
    system_prompt = system_prompt_template.format(
        tonejs_instruments=format_instruments_for_prompt(TONEJS_INSTRUMENTS),
        smplr_instruments=format_instruments_for_prompt(SMPLR_INSTRUMENTS)
    )
        
    context_prompt = f"{system_prompt}\n\nCURRENT SONG STATE:\n{song_json}"

    if messages and isinstance(messages[0], SystemMessage):
        messages = [SystemMessage(content=context_prompt)] + messages[1:]
    else:
        messages = [SystemMessage(content=context_prompt)] + messages

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
