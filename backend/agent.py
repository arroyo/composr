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

# --- Tools ---
@tool
def create_track(track_id: str, engine: str, instrument: str) -> str:
    """Creates a new instrument track.

    Args:
        track_id: A short unique name for the track (e.g. 'kick', 'snare', 'bass', 'lead').

        engine: MUST be either "tone" or "smplr".
            - Use "tone" for ALL electronic/synthetic sounds (e.g. Hip Hop, Trap, EDM, Techno).
              This includes ALL electronic drums, 808s, synth basses, EDM leads, pads, and arps.
            - Use "smplr" for ALL acoustic/real-instrument sounds (e.g. Rock, Folk, Classical, Jazz).
              This includes piano, acoustic guitar, violin, cello, bass guitar, acoustic drums, etc.

        instrument: The specific sound within the engine.
            If engine="tone", choose from:
              "kick"       -> 808 / bass drum
              "snare"      -> snare drum / clap
              "hihat"      -> hi-hat (closed or open)
              "cymbal"     -> crash / ride cymbal
              "bass_synth" -> synth bass line
              "lead_synth" -> mono lead melody
              "pad"        -> atmospheric chord pad
              "fm_bass"    -> punchy FM bass
              "arp"        -> arpeggio synth

            If engine="smplr", use the exact General MIDI name or smplr drum names:
              Melodic: "acoustic_grand_piano", "electric_piano_1", "acoustic_guitar_steel",
                       "acoustic_guitar_nylon", "electric_guitar_clean", "violin", "viola",
                       "cello", "contrabass", "flute", "clarinet", "oboe", "trumpet",
                       "trombone", "acoustic_bass", "electric_bass_finger", "electric_bass_pick",
                       "orchestral_harp", "banjo", "sitar", "church_organ", "accordion"
              Drums: "taiko_drum" (kick/toms), "woodblock" (snare/sticks/rim), "reverse_cymbal",
                     "steel_drums", "synth_drum", "melodic_tom"
    """
    global current_song
    if current_song.get_track(track_id):
        return f"Track '{track_id}' already exists."

    new_track = Track(id=track_id, engine=engine, instrument=instrument)
    current_song.tracks.append(new_track)
    return f"Created track '{track_id}' (engine={engine}, instrument={instrument})."

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
def update_track_instrument(track_id: str, engine: str, new_instrument: str) -> str:
    """Changes the engine and instrument of an existing track, preserving its notes.

    Args:
        track_id: The ID of the track to update.
        engine: "tone" for electronic synths, "smplr" for acoustic/MIDI instruments.
        new_instrument: The new instrument name within the chosen engine
            (same options as create_track).
    """
    global current_song
    track = current_song.get_track(track_id)
    if not track:
        return f"Error: Track '{track_id}' does not exist."

    track.engine = engine
    track.instrument = new_instrument
    return f"Updated track '{track_id}' to engine={engine}, instrument={new_instrument}."

tools = [create_track, add_notes, change_tempo, clear_song, update_track_instrument]
tool_node = ToolNode(tools)

from dotenv import load_dotenv
load_dotenv()

# --- Agent Initialization ---
llm = ChatOpenAI(model="gpt-4o", temperature=0.7)
llm_with_tools = llm.bind_tools(tools)

system_prompt = """You are an AI Music Producer. You compose symbolic music using tool calls.

CRITICAL BEHAVIORAL RULE:
Unless the user says "start over", "clear", or "new song", ADD to the existing arrangement. Never call clear_song on follow-up requests.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ENGINE SELECTION — THIS IS MANDATORY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your first step must ALWAYS be determining the genre of the requested song:
1. Is it an Electronic Genre? (Hip Hop, Trap, EDM, House, Techno, Synthwave) -> Use ONLY `tone` engine.
2. Is it an Acoustic Genre? (Country, Folk, Classical, Jazz, Acoustic Rock) -> Use ONLY `smplr` engine.

When calling create_track, you MUST set the `engine` field correctly based on the genre above:

NEVER use engine="smplr" for drums in hip hop, trap, or EDM.
NEVER use engine="smplr" for synth bass, leads, or pads in electronic genres.
NEVER use engine="tone" for piano, guitar, violin, or acoustic drums in acoustic genres.

GENRE RULESET:

  Electronic Genres (Hip Hop / Trap / EDM / House / Techno) — ALL drums and synths use engine="tone":
    kick drum     → engine="tone", instrument="kick"
    snare / clap  → engine="tone", instrument="snare"
    hi-hat        → engine="tone", instrument="hihat"
    cymbal        → engine="tone", instrument="cymbal"
    808 bass      → engine="tone", instrument="fm_bass"
    synth bass    → engine="tone", instrument="bass_synth"
    lead synth    → engine="tone", instrument="lead_synth"
    pads          → engine="tone", instrument="pad"

  Acoustic Genres (Country / Folk / Classical / Jazz) — ALL instruments use engine="smplr":
    guitar        → engine="smplr", instrument="acoustic_guitar_steel"
    piano         → engine="smplr", instrument="acoustic_grand_piano"
    strings       → engine="smplr", instrument="violin" / "cello"
    bass          → engine="smplr", instrument="acoustic_bass"
    drums (kick/toms) → engine="smplr", instrument="taiko_drum"
    drums (snare/rim) → engine="smplr", instrument="woodblock"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NOTE WRITING RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Pitch: scientific notation (C4, D#3, Bb2)
- For kick (tone): use low pitches like C1 or B0
- For snare (tone): pitch is ignored, use C4 as placeholder
- For hihat (tone): use high pitches like A5 or F#5
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
