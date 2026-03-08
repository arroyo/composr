from pydantic import BaseModel, Field
from typing import List, Literal, Optional

class Note(BaseModel):
    pitch: str = Field(description="The scientific pitch notation (e.g., 'C4', 'D#5', 'F2')")
    start_time: str = Field(description="The start time of the note in 'bars:beats:sixteenths' format (e.g., '0:0:0' for start, '0:1:0' for beat 2)")
    duration: str = Field(description="The duration of the note (e.g., '4n' for quarter note, '8n' for eighth note)")
    velocity: float = Field(default=0.8, description="The strictly calculated velocity/volume of the note, between 0.0 and 1.0")

class Track(BaseModel):
    id: str = Field(description="A unique identifier for the track (e.g., 'kick', 'snare', 'bass', 'lead')")
    engine: Literal["smplr", "tone"] = Field(
        default="smplr",
        description=(
            "The audio engine to use. This MUST match the genre. "
            "MUST be 'tone' for ANY electronic/synthetic styles (Hip Hop, Trap, EDM, Techno). "
            "MUST be 'smplr' for ANY acoustic/real-world styles (Classical, Jazz, Country, Folk)."
        )
    )
    instrument: str = Field(description=(
        "The instrument within the chosen engine. "
        "If engine='tone', use: 'kick', 'snare', 'hihat', 'cymbal', 'bass_synth', 'lead_synth', 'pad', 'fm_bass', 'arp'. "
        "If engine='smplr', use the exact General MIDI name (e.g. 'acoustic_grand_piano', 'acoustic_guitar_steel', 'violin', 'acoustic_bass') "
        "or acoustic percussion ('taiko_drum', 'woodblock', 'melodic_tom')."
    ))
    notes: List[Note] = Field(default_factory=list, description="A chronological array of notes generated for this track")

class Song(BaseModel):
    tempo: int = Field(default=120, description="The Beats Per Minute (BPM) of the song")
    time_signature: tuple[int, int] = Field(default=(4, 4), description="The time signature of the song (e.g., 4/4)")
    tracks: List[Track] = Field(default_factory=list, description="All tracks that make up the song arrangement")

    def get_track(self, track_id: str) -> Optional[Track]:
        for track in self.tracks:
            if track.id == track_id:
                return track
        return None
