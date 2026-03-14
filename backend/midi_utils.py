from midiutil import MIDIFile
from schema import Song, Track, Note
import io
import math
from typing import List
import mido

def song_to_midi(song: Song) -> bytes:
    """
    Convert a Song object to MIDI bytes.
    
    Args:
        song: The Song object to convert
        
    Returns:
        MIDI file as bytes
    """
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
