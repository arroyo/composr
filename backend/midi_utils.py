from midiutil import MIDIFile
from schema import Song, Track, Note
import io
import math
from typing import List
import mido
import json
import os

def song_to_midi(song: Song) -> bytes:
    """
    Convert a Song object to MIDI bytes.
    
    Args:
        song: The Song object to convert
        
    Returns:
        MIDI file as bytes
    """
    # Load General MIDI instruments for mapping
    gm_instruments = load_general_midi_instruments()
    
    # Create MIDIFile with 1 track per instrument track + 1 for tempo/time signature
    # MIDIFile uses 960 ticks per quarter note by default
    total_tracks = len(song.tracks) + (1 if song.tracks else 0)
    midi = MIDIFile(total_tracks)  # Uses 960 ticks per quarter note by default
    
    # Track 0: Meta information (tempo, time signature)
    if song.tracks:
        midi.addTempo(0, 0, song.tempo)
        midi.addTimeSignature(0, 0, song.time_signature[0], song.time_signature[1], 24)
    
    # Add each instrument track
    for i, track in enumerate(song.tracks):
        track_num = i + 1  # Start from 1 since track 0 is meta
        
        # Add tempo and time signature to each track for consistency
        midi.addTempo(track_num, 0, song.tempo)
        midi.addTimeSignature(track_num, 0, song.time_signature[0], song.time_signature[1], 24)
        
        # Map track to General MIDI instrument and set the program
        gm_program = map_track_to_general_midi(track, gm_instruments)
        # Convert from 1-128 to 0-127 for MIDI program change
        midi.addProgramChange(track_num, 0, 0, gm_program - 1)
        
        for note in track.notes:
            # Convert note pitch to MIDI note number
            midi_note = pitch_to_midi_note(note.pitch)
            
            # Convert start_time and duration to MIDI ticks
            start_tick = time_to_ticks(note.start_time, song.time_signature, song.tempo)
            duration_ticks = time_to_ticks(note.duration, song.time_signature, song.tempo)
            
            # MIDIUtil applies a 960x scaling factor to both time and duration, so we need to compensate
            # The actual values written will be: input_value / 960 * 960 = input_value
            compensated_time = start_tick / 960
            compensated_duration = duration_ticks / 960
            
            # Add note to MIDI
            midi.addNote(
                track=track_num,
                channel=i % 16,  # Use track number as channel (0-15)
                pitch=midi_note,
                time=compensated_time,
                duration=compensated_duration,
                volume=int(note.velocity * 127)  # Convert 0-1 to 0-127
            )
    
    # Save to bytes
    midi_bytes = io.BytesIO()
    midi.writeFile(midi_bytes)
    midi_bytes.seek(0)
    
    return midi_bytes.getvalue()

def pitch_to_midi_note(pitch: str) -> int:
    """
    Convert scientific pitch notation (e.g., "C4", "A#3") to MIDI note number.
    
    Args:
        pitch: Pitch string in scientific notation
        
    Returns:
        MIDI note number (0-127)
    """
    note_names = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 
                  'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8,
                  'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}
    
    # Handle empty or invalid input
    if not pitch or len(pitch) < 2:
        return 60  # Default to middle C
    
    try:
        # Strip whitespace and convert to uppercase for consistency
        pitch = pitch.strip().upper()
        
        # Handle sharps and flats (2 characters for note name)
        if len(pitch) >= 2 and pitch[1] in ('#', 'B'):
            note_name = pitch[:2]
            octave_str = pitch[2:] if len(pitch) > 2 else '4'
        else:
            note_name = pitch[0]
            octave_str = pitch[1:] if len(pitch) > 1 else '4'
        
        # Parse octave, defaulting to 4 if invalid
        octave = int(octave_str) if octave_str.isdigit() else 4
        
        # Calculate MIDI note number
        note_number = note_names.get(note_name, 0) + (octave + 1) * 12
        
        # Clamp to valid range
        return max(0, min(127, note_number))
        
    except (ValueError, IndexError, AttributeError):
        return 60  # Default to middle C on any error

def time_to_ticks(time_str: str, time_signature: tuple[int, int], tempo: int) -> int:
    """
    Convert time string to MIDI ticks.
    
    Args:
        time_str: Time string in "bars:beats:sixteenths" format or duration like "4n", "8n"
        time_signature: Tuple of (numerator, denominator)
        tempo: BPM
        
    Returns:
        Number of MIDI ticks
    """
    try:
        # Handle duration notation (e.g., "4n", "8n", "16n")
        total_beats = 0.0  # Initialize total_beats
        
        if ':' not in time_str:
            if time_str.endswith('n'):
                # Note duration notation - convert to beats
                duration_map = {
                    '1n': 4.0,  # Whole note = 4 beats
                    '2n': 2.0,  # Half note = 2 beats  
                    '4n': 1.0,  # Quarter note = 1 beat
                    '8n': 0.5,  # Eighth note = 0.5 beat
                    '16n': 0.25, # Sixteenth note = 0.25 beat
                    '32n': 0.125, # Thirty-second note = 0.125 beat
                }
                total_beats = duration_map.get(time_str, 1.0)
            else:
                total_beats = float(time_str)  # Fallback to treating as number of beats
        else:
            # Handle position notation (bars:beats:sixteenths)
            parts = time_str.split(':')
            if len(parts) != 3:
                return 0
            
            bars = int(parts[0])
            beats = int(parts[1])
            sixteenths = int(parts[2])
            
            # Calculate total beats
            total_beats = bars * time_signature[0] + beats + sixteenths / 4.0
        
        # Convert to ticks - use 960 ticks per quarter note (MIDIUtil default)
        # This is independent of tempo as MIDI ticks represent relative timing
        ticks_per_beat = 960
        return int(total_beats * ticks_per_beat)
        
    except (ValueError, IndexError):
        return 960  # Default to one quarter note (960 ticks)

def midi_to_song(midi_data: bytes) -> Song:
    """
    Convert MIDI data to a Song object using mido library.
    
    Args:
        midi_data: MIDI file as bytes
        
    Returns:
        Song object
    """
    from datetime import datetime
    
    try:
        # Load MIDI file
        midi_file = mido.MidiFile(file=io.BytesIO(midi_data))
        
        # Extract tempo and time signature
        tempo = 120  # Default tempo
        time_signature = [4, 4]  # Default time signature
        
        # Parse meta tracks for tempo and time signature
        for track in midi_file.tracks:
            for msg in track:
                if msg.type == 'set_tempo':
                    tempo = int(60000000 / msg.tempo)  # Convert microseconds per beat to BPM
                elif msg.type == 'time_signature':
                    # MIDI time signature denominator is a power of 2
                    # 0 = whole note, 1 = half, 2 = quarter, 3 = eighth, 4 = sixteenth
                    denominator_map = {0: 1, 1: 2, 2: 4, 3: 8, 4: 16}
                    denominator = denominator_map.get(msg.denominator, 4)
                    time_signature = [msg.numerator, denominator]
        
        # Group notes by track/channel
        track_notes = {}
        
        for track_idx, track in enumerate(midi_file.tracks):
            current_time = 0
            track_notes[track_idx] = []
            
            for msg in track:
                current_time += msg.time
                
                if msg.type == 'note_on' and msg.velocity > 0:
                    track_notes[track_idx].append({
                        'pitch': midi_note_to_pitch(msg.note),
                        'start_time': ticks_to_time(current_time, time_signature, tempo),
                        'duration': '4n',  # Will be calculated when we find note_off
                        'velocity': msg.velocity / 127.0,
                        'start_tick': current_time,
                        'end_tick': None
                    })
                elif msg.type == 'note_off' or (msg.type == 'note_on' and msg.velocity == 0):
                    # Find the matching note_on and calculate duration
                    for note in reversed(track_notes[track_idx]):
                        if note['end_tick'] is None and note['pitch'] == midi_note_to_pitch(msg.note):
                            note['end_tick'] = current_time
                            duration_ticks = current_time - note['start_tick']
                            note['duration'] = ticks_to_duration(duration_ticks, time_signature, tempo)
                            break
        
        # Convert to Song format
        tracks = []
        for track_idx, notes in track_notes.items():
            if not notes:
                continue
                
            # Filter out notes without proper duration
            valid_notes = [note for note in notes if note['end_tick'] is not None]
            
            if valid_notes:
                track_obj = Track(
                    id=f"track_{track_idx}",
                    instrument={
                        "engine": "tonejs",
                        "plugin": "Synth",
                        "bank": "factory",
                        "preset": "default"
                    },
                    notes=[
                        Note(
                            pitch=note['pitch'],
                            start_time=note['start_time'],
                            duration=note['duration'],
                            velocity=note['velocity']
                        )
                        for note in valid_notes
                    ],
                    volume=0.0,  # TODO: Extract from MIDI control changes if available
                    pan=0.0      # TODO: Extract from MIDI control changes if available
                )
                tracks.append(track_obj)
        
        return Song(
            name=f"Imported MIDI {datetime.now().strftime('%H:%M:%S')}",
            tempo=tempo,
            time_signature=time_signature,
            tracks=tracks
        )
        
    except Exception as e:
        print(f"Error parsing MIDI: {e}")
        # Return empty song on error
        return Song(
            name=f"Import Error {datetime.now().strftime('%H:%M:%S')}",
            tempo=120,
            time_signature=[4, 4],
            tracks=[]
        )

def midi_note_to_pitch(midi_note: int) -> str:
    """Convert MIDI note number to scientific pitch notation."""
    note_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    octave = (midi_note // 12) - 1
    note_name = note_names[midi_note % 12]
    return f"{note_name}{octave}"

def ticks_to_time(ticks: int, time_signature: tuple[int, int], tempo: int) -> str:
    """Convert MIDI ticks to bars:beats:sixteenths format."""
    ticks_per_beat = 960  # Match MIDIUtil's default ticks per quarter note
    beats_per_bar = time_signature[0]
    
    total_beats = ticks / ticks_per_beat
    bars = int(total_beats // beats_per_bar)
    beats = int(total_beats % beats_per_bar)
    # Use round for sixteenths to avoid floating point precision issues
    sixteenths = round((total_beats % 1) * 4)
    
    # Handle case where sixteenths rounds up to 4
    if sixteenths == 4:
        sixteenths = 0
        beats += 1
        if beats >= beats_per_bar:
            beats = 0
            bars += 1
    
    return f"{bars}:{beats}:{sixteenths}"

def ticks_to_duration(ticks: int, time_signature: tuple[int, int], tempo: int) -> str:
    """Convert MIDI ticks to duration notation."""
    ticks_per_beat = 960  # Match MIDIUtil's default ticks per quarter note
    beats = ticks / ticks_per_beat
    
    # Use more precise thresholds to better match note durations
    if beats >= 3.75:
        return "1n"
    elif beats >= 1.875:
        return "2n"
    elif beats >= 0.9375:
        return "4n"
    elif beats >= 0.46875:
        return "8n"
    elif beats >= 0.234375:
        return "16n"
    else:
        return "32n"

def load_general_midi_instruments() -> dict:
    """Load General MIDI instruments from shared folder."""
    gm_file = os.path.join(os.path.dirname(__file__), "..", "shared", "general_midi_instruments.json")
    try:
        with open(gm_file, 'r') as f:
            data = json.load(f)
            # Create a mapping of instrument name to program number
            instrument_map = {}
            for instrument in data['instruments']:
                instrument_map[instrument['name'].lower()] = instrument['program']
            return instrument_map
    except (FileNotFoundError, json.JSONDecodeError):
        # Return a basic fallback mapping
        return {
            'acoustic grand piano': 1,
            'electric piano': 5,
            'acoustic guitar': 26,
            'electric guitar': 28,
            'acoustic bass': 33,
            'electric bass': 34,
            'violin': 41,
            'cello': 43,
            'trumpet': 57,
            'sax': 66,
            'flute': 74,
            'drums': 117
        }

def map_track_to_general_midi(track: Track, gm_instruments: dict) -> int:
    """
    Map a track to its closest General MIDI instrument based on track name and instrument preset.
    
    Args:
        track: The Track object to map
        gm_instruments: Dictionary of General MIDI instrument names to program numbers
        
    Returns:
        General MIDI program number (1-128)
    """
    # Default to Acoustic Grand Piano
    default_program = 1
    
    # Get track name and instrument preset for matching
    track_name = track.id.lower() if track.id else ""
    instrument_preset = track.instrument.preset.lower() if track.instrument.preset else ""
    
    # Create a list of possible search terms
    search_terms = [track_name, instrument_preset]
    
    # Define keyword mappings to General MIDI categories
    keyword_mappings = {
        # Piano keywords
        'piano': [1, 2, 3, 4, 5, 6, 7, 8],
        'acoustic_grand_piano': [1],
        'electric_piano': [5, 6],
        'harpsichord': [7],
        
        # Guitar keywords
        'guitar': [25, 26, 27, 28, 29, 30, 31, 32],
        'acoustic_guitar': [25, 26],
        'electric_guitar': [27, 28, 29, 30, 31],
        
        # Bass keywords
        'bass': [33, 34, 35, 36, 37, 38, 39, 40],
        'acoustic_bass': [33],
        'electric_bass': [34, 35],
        'synth_bass': [39, 40],
        
        # Drum/Percussion keywords
        'drum': [117, 118, 119],
        'kick': [117],
        'snare': [117],
        'hihat': [117],
        'cymbal': [117],
        'percussion': [113, 114, 115, 116, 117, 118, 119, 120],
        
        # String keywords
        'violin': [41],
        'viola': [42],
        'cello': [43],
        'contrabass': [44],
        'harp': [47],
        'string': [41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52],
        
        # Brass keywords
        'trumpet': [57],
        'trombone': [58],
        'tuba': [59],
        'horn': [61],
        'brass': [57, 58, 59, 60, 61, 62, 63, 64],
        
        # Woodwind keywords
        'sax': [65, 66, 67, 68],
        'soprano_sax': [65],
        'alto_sax': [66],
        'tenor_sax': [67],
        'oboe': [69],
        'clarinet': [72],
        'flute': [74],
        
        # Synth keywords
        'synth': [39, 40, 51, 52, 55, 63, 64, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 119],
        'lead': [81, 82, 83, 84, 85, 86, 87, 88],
        'pad': [89, 90, 91, 92, 93, 94, 95, 96],
        
        # Organ keywords
        'organ': [17, 18, 19, 20, 21],
        'church_organ': [20],
        
        # Ethnic keywords
        'sitar': [105],
        'banjo': [106],
        'steel_drums': [115],
        
        # Other common terms
        'lead_synth': [81, 82, 83, 84, 85, 86, 87, 88],
        'pad_synth': [89, 90, 91, 92, 93, 94, 95, 96],
        'bass_synth': [39, 40],
        'fm_bass': [39, 40],
    }
    
    # Try to find exact matches in General MIDI instrument names first
    for term in search_terms:
        if term in gm_instruments:
            return gm_instruments[term]
    
    # Try keyword matching
    for term in search_terms:
        for keyword, programs in keyword_mappings.items():
            if keyword in term:
                return programs[0]  # Return the first (most common) program for this category
    
    # Try partial matching with General MIDI instrument names
    for term in search_terms:
        for gm_name, program in gm_instruments.items():
            if term in gm_name or gm_name in term:
                return program
    
    return default_program
