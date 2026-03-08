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
# For a single-agent backend, we will hold the song state in memory temporarily.
current_song = Song()

# --- Tools ---
@tool
def create_track(track_id: str, instrument: str) -> str:
    """Creates a new track in the song arrangement if it does not already exist."""
    global current_song
    if current_song.get_track(track_id):
        return f"Track '{track_id}' already exists."
    
    new_track = Track(id=track_id, instrument=instrument)
    current_song.tracks.append(new_track)
    return f"Created new track: {track_id} using {instrument}."

@tool
def add_notes(track_id: str, notes: list[Note]) -> str:
    """Adds a list of musical notes to a specific track."""
    global current_song
    track = current_song.get_track(track_id)
    if not track:
        return f"Error: Track '{track_id}' does not exist. Please create it first."
    
    # Extend the list with parsed Notes
    track.notes.extend(notes)
    # Re-sort notes by their start_time mathematically (basic lexical sort handles uniform formatting like '0:0:0')
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

tools = [create_track, add_notes, change_tempo, clear_song]
tool_node = ToolNode(tools)

from dotenv import load_dotenv
load_dotenv()

# --- Agent Initialization ---
llm = ChatOpenAI(model="gpt-4o", temperature=0.7)
llm_with_tools = llm.bind_tools(tools)

system_prompt = """You are an AI Music Producer. Your job is to compose symbolic music. 
You will receive requests from the user to construct a song arrangement.

You have access to tools that modify the current song state:
- create_track: Creates a new instrument track. You must provide a valid General MIDI instrument name (e.g., 'acoustic_grand_piano', 'acoustic_guitar_steel', 'electric_bass_finger', 'synth_drum', 'violin', etc). Choose an instrument that fits the requested genre.
- add_notes: Adds a list of `Note` objects to a track. Notes use Tone.js scheduling notation (e.g. C4 pitch, '0:0:0' starts at bar 0, beat 0, sixteenth 0).
- change_tempo: Sets the BPM.
- clear_song: Deletes everything.

When writing notes, you must accurately calculate the Tone.js `start_time` values ('bars:beats:sixths').
A 4/4 measure has 4 beats, and each beat contains four 16th notes.
Example of a C major scale quarter notes:
- C4 at 0:0:0
- D4 at 0:1:0
- E4 at 0:2:0
- F4 at 0:3:0
- G4 at 1:0:0 (next measure)

Once you have made the necessary tool calls to fulfill the user's compositional request, respond with a friendly message describing what you created.
"""

def agent_node(state: AgentState):
    messages = state['messages']
    
    # Prepend the system prompt if it's the first message
    if not isinstance(messages[0], SystemMessage):
         messages = [SystemMessage(content=system_prompt)] + messages

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
