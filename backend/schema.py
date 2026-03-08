from pydantic import BaseModel, Field
from typing import List, Literal, Optional

class Note(BaseModel):
    pitch: str = Field(description="The scientific pitch notation (e.g., 'C4', 'D#5', 'F2')")
    start_time: str = Field(description="The start time of the note in 'bars:beats:sixteenths' format (e.g., '0:0:0' for start, '0:1:0' for beat 2)")
    duration: str = Field(description="The duration of the note (e.g., '4n' for quarter note, '8n' for eighth note)")
    velocity: float = Field(default=0.8, description="The strictly calculated velocity/volume of the note, between 0.0 and 1.0")

class InstrumentState(BaseModel):
    engine: Literal["smplr", "tone"] = Field(
        default="smplr",
        description=(
            "The audio engine to use. This MUST match the genre. "
            "MUST be 'tone' for ANY electronic/synthetic styles (Hip Hop, Trap, EDM, Techno). "
            "MUST be 'smplr' for ANY acoustic/real-world styles (Classical, Jazz, Country, Folk)."
        )
    )
    plugin: str = Field(
        description=(
            "The specific synthesizer plugin/class to use for this instrument. "
            "For engine='smplr', examples: 'Soundfont', 'DrumMachine', 'SplendidGrandPiano'. "
            "For engine='tone', examples: 'MembraneSynth', 'NoiseSynth', 'MetalSynth', 'PolySynth', 'FMSynth', 'AMSynth'."
        )
    )
    bank: str = Field(
        default="factory",
        description="The sound bank collection. Default is 'factory'. Do not change unless instructed."
    )
    preset: str = Field(description=(
        "The instrument preset within the chosen engine. "
        "If engine='tone', use: 'kick', 'snare', 'hihat', 'cymbal', 'bass_synth', 'lead_synth', 'pad', 'fm_bass', 'arp'. "
        "If engine='smplr', use the exact General MIDI name (e.g. 'acoustic_grand_piano', 'acoustic_guitar_steel', 'violin', 'acoustic_bass') "
        "or acoustic percussion ('taiko_drum', 'woodblock', 'melodic_tom')."
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
    tempo: int = Field(default=120, description="The Beats Per Minute (BPM) of the song")
    time_signature: tuple[int, int] = Field(default=(4, 4), description="The time signature of the song (e.g., 4/4)")
    tracks: List[Track] = Field(default_factory=list, description="All tracks that make up the song arrangement")

    def get_track(self, track_id: str) -> Optional[Track]:
        for track in self.tracks:
            if track.id == track_id:
                return track
        return None
