from pydantic import BaseModel, Field
from typing import List, Literal, Optional
import json
import os

# Load instruments dictionary for validation and prompt descriptions
INSTRUMENTS_FILE = os.path.join(os.path.dirname(__file__), "instruments.json")
with open(INSTRUMENTS_FILE, 'r') as f:
    AVAILABLE_INSTRUMENTS = json.load(f)

# Helper lists for standard validation/prompting
AVAILABLE_ENGINES = list(set([inst["engine"] for inst in AVAILABLE_INSTRUMENTS]))
AVAILABLE_PLUGINS = list(set([inst["plugin"] for inst in AVAILABLE_INSTRUMENTS]))
AVAILABLE_PRESETS = list(set([inst["id"] for inst in AVAILABLE_INSTRUMENTS]))

class Note(BaseModel):
    pitch: str = Field(description="The scientific pitch notation (e.g., 'C4', 'D#5', 'F2')")
    start_time: str = Field(description="The start time of the note in 'bars:beats:sixteenths' format (e.g., '0:0:0' for start, '0:1:0' for beat 2)")
    duration: str = Field(description="The duration of the note (e.g., '4n' for quarter note, '8n' for eighth note)")
    velocity: float = Field(default=0.8, description="The strictly calculated velocity/volume of the note, between 0.0 and 1.0")

class InstrumentState(BaseModel):
    engine: Literal["smplr", "tonejs"] = Field(
        default="smplr",
        description=(
            f"The audio synthesis engine to use. Choose freely based on desired sound design. "
            f"Available engines: {AVAILABLE_ENGINES}. "
            f"('tonejs' = electronic/synthetic, 'smplr' = acoustic/real-world)"
        )
    )
    plugin: str = Field(
        description=(
            f"The specific synthesizer plugin/class to use. "
            f"Must match the chosen engine. Examples: {', '.join([str(p) for p in AVAILABLE_PLUGINS][:5])}..."
        )
    )
    bank: str = Field(
        default="factory",
        description="The sound bank collection. Default is 'factory'. Do not change unless instructed."
    )
    preset: str = Field(description=(
        f"The specific instrument preset to use. "
        f"Must be one of the available instrument IDs from the shared dictionary."
    ))

class Track(BaseModel):
    id: str = Field(description="A unique identifier for the track (e.g., 'kick', 'snare', 'bass', 'lead')")
    instrument: InstrumentState = Field(description="The complete configuration for the instrument sound (engine, preset, and bank)")
    notes: list[Note] = Field(default_factory=list, description="The sequence of notes for this track")
    volume: float = Field(
        default=0.0,
        description="Track volume in decibels (dB). Default is 0.0. Range is typically -60.0 to 6.0."
    )
    pan: float = Field(
        default=0.0,
        description="Track audio panning. Default is 0.0 (center). Range is -1.0 (hard left) to 1.0 (hard right)."
    )

class Song(BaseModel):
    name: str = Field(default="Untitled Song", description="The creative name of the generated song")
    tempo: int = Field(default=120, description="The Beats Per Minute (BPM) of the song")
    time_signature: tuple[int, int] = Field(default=(4, 4), description="The time signature of the song (e.g., 4/4)")
    tracks: List[Track] = Field(default_factory=list, description="All tracks that make up the song arrangement")

    def get_track(self, track_id: str) -> Optional[Track]:
        for track in self.tracks:
            if track.id == track_id:
                return track
        return None
