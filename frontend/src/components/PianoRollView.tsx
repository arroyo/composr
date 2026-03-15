"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Song, Track, Note } from "@/lib/types";
import { engine } from "@/lib/audio";

interface PianoRollViewProps {
    song: Song | null;
    audioInitialized: boolean;
    onUpdateSong: (song: Song, skipAudioReload?: boolean) => void;
    onEnsureAudioInit: () => Promise<void>;
}

const TRACK_COLORS = [
    "bg-indigo-500",
    "bg-purple-500", 
    "bg-pink-500",
    "bg-blue-500",
    "bg-cyan-500",
    "bg-teal-500",
    "bg-green-500",
    "bg-lime-500",
    "bg-yellow-500",
    "bg-orange-500",
    "bg-red-500",
    "bg-rose-500"
];

const PITCHES = [
    "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"
];

const OCTAVES = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const KEY_HEIGHT = 14;
const PIXELS_PER_BEAT = 50;

export default function PianoRollView({ song, audioInitialized, onUpdateSong, onEnsureAudioInit }: PianoRollViewProps) {
    const [expandedTrackId, setExpandedTrackId] = useState<string | null>(null);
    const [hoveredNote, setHoveredNote] = useState<{ trackId: string; note: Note; noteIndex: number } | null>(null);
    const [draggedNote, setDraggedNote] = useState<{ trackId: string; note: Note; noteIndex: number; startX: number; startY: number } | null>(null);
    const [resizingNote, setResizingNote] = useState<{ trackId: string; note: Note; noteIndex: number; startWidth: number; startX: number } | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const pianoRollRef = useRef<HTMLDivElement>(null);
    const dragStartTime = useRef<number>(0);

    if (!song || song.tracks.length === 0) {
        return (
            <div className="h-full w-full flex items-center justify-center text-zinc-500 flex-col gap-4">
                <div className="w-24 h-24 rounded-full bg-zinc-800/30 flex items-center justify-center border border-zinc-800/50 shadow-inner">
                    <div className="w-16 h-1 bg-zinc-800 rounded-full animate-pulse" />
                </div>
                <p className="text-sm">No notes composed yet. Try prompting the agent!</p>
            </div>
        );
    }

    const allPitches = useMemo(() => {
        const pitches: string[] = [];
        for (const octave of OCTAVES) {
            for (const pitch of PITCHES) {
                pitches.push(`${pitch}${octave}`);
            }
        }
        return pitches.reverse(); // High to low
    }, []);

    const getTrackColor = (index: number) => {
        return TRACK_COLORS[index % TRACK_COLORS.length];
    };

    const parseTime = (timeStr: string): { bar: number; beat: number; sixteenth: number } => {
        const parts = timeStr.split(':').map(Number);
        return { bar: parts[0] || 0, beat: parts[1] || 0, sixteenth: parts[2] || 0 };
    };

    const timeToX = (timeStr: string): number => {
        const { bar, beat, sixteenth } = parseTime(timeStr);
        const beatsPerBar = song.time_signature[0];
        const totalBeats = bar * beatsPerBar + beat + sixteenth / 4;
        return totalBeats * PIXELS_PER_BEAT;
    };

    const durationToWidth = (duration: string): number => {
        const durationMap: { [key: string]: number } = {
            '1n': 4,      // Whole note = 4 beats
            '2n': 2,      // Half note = 2 beats  
            '4n': 1,      // Quarter note = 1 beat
            '8n': 0.5,    // Eighth note = 0.5 beat
            '16n': 0.25,  // Sixteenth note = 0.25 beat
        };
        const beats = durationMap[duration] || 1;
        return beats * PIXELS_PER_BEAT;
    };

    const getTrackGridWidth = (track: Track): number => {
        if (track.notes.length === 0) return 800;
        let maxEnd = 0;
        for (const note of track.notes) {
            const noteEnd = timeToX(note.start_time) + durationToWidth(note.duration);
            if (noteEnd > maxEnd) maxEnd = noteEnd;
        }
        return Math.max(800, maxEnd + 100);
    };

    const displayedPitches = useMemo(() => allPitches, [allPitches]);

    const pitchToY = (pitch: string): number => {
        const index = displayedPitches.indexOf(pitch);
        if (index === -1) return 0;
        return index * KEY_HEIGHT;
    };

    const playNote = async (trackId: string, note: Note) => {
        await onEnsureAudioInit();
        engine.playNote(trackId, note.pitch, note.duration, note.velocity);
    };

    const deleteNote = (trackId: string, noteIndex: number) => {
        if (!song) return;
        
        const updatedTracks = song.tracks.map(track => {
            if (track.id === trackId) {
                return {
                    ...track,
                    notes: track.notes.filter((_, index) => index !== noteIndex)
                };
            }
            return track;
        });
        
        onUpdateSong({ ...song, tracks: updatedTracks });
    };

    const updateNote = (trackId: string, noteIndex: number, updates: Partial<Note>) => {
        if (!song) return;
        
        const updatedTracks = song.tracks.map(track => {
            if (track.id === trackId) {
                return {
                    ...track,
                    notes: track.notes.map((note, index) => 
                        index === noteIndex ? { ...note, ...updates } : note
                    )
                };
            }
            return track;
        });
        
        onUpdateSong({ ...song, tracks: updatedTracks });
    };

    const createNote = (trackId: string, pitch: string, startTime: string) => {
        if (!song) return;
        
        const newNote: Note = {
            pitch,
            start_time: startTime,
            duration: '8n',
            velocity: 0.8
        };
        
        const updatedTracks = song.tracks.map(track => {
            if (track.id === trackId) {
                return {
                    ...track,
                    notes: [...track.notes, newNote]
                };
            }
            return track;
        });
        
        onUpdateSong({ ...song, tracks: updatedTracks });
    };

    const xToTime = (x: number): string => {
        const totalBeats = x / PIXELS_PER_BEAT;
        const beatsPerBar = song.time_signature[0];
        const bar = Math.floor(totalBeats / beatsPerBar);
        const beat = Math.floor(totalBeats % beatsPerBar);
        const sixteenth = Math.floor((totalBeats % 1) * 4);
        return `${bar}:${beat}:${sixteenth}`;
    };

    const yToPitch = (y: number): string => {
        const index = Math.floor(y / KEY_HEIGHT);
        return displayedPitches[Math.min(Math.max(0, index), displayedPitches.length - 1)];
    };

    const handleNoteClick = (trackId: string, note: Note) => {
        if (!isDragging) {
            playNote(trackId, note);
        }
    };

    const handleMouseDown = (e: React.MouseEvent, trackId: string, note: Note, noteIndex: number, action: 'drag' | 'resize' | 'delete') => {
        e.preventDefault();
        e.stopPropagation();
        
        if (action === 'delete') {
            deleteNote(trackId, noteIndex);
            return;
        }
        
        dragStartTime.current = Date.now();
        setIsDragging(false);
        
        const rect = e.currentTarget.getBoundingClientRect();
        
        if (action === 'drag') {
            setDraggedNote({
                trackId,
                note,
                noteIndex,
                startX: e.clientX,
                startY: e.clientY
            });
        } else if (action === 'resize') {
            setResizingNote({
                trackId,
                note,
                noteIndex,
                startWidth: rect.width,
                startX: e.clientX
            });
        }
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (draggedNote && pianoRollRef.current) {
            const deltaX = e.clientX - draggedNote.startX;
            const deltaY = e.clientY - draggedNote.startY;
            
            // Only start dragging if moved enough distance
            const dragDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            if (dragDistance > 5) {
                setIsDragging(true);
            }
            
            if (isDragging) {
                const pianoRollElement = pianoRollRef.current.querySelector('.relative.bg-zinc-900\/50');
                if (pianoRollElement) {
                    const rect = pianoRollElement.getBoundingClientRect();
                    const gridArea = pianoRollElement.querySelector('.flex-1.relative');
                    if (gridArea) {
                        const gridRect = gridArea.getBoundingClientRect();
                        
                        const newTime = xToTime(
                            Math.max(0, timeToX(draggedNote.note.start_time) + deltaX)
                        );
                        
                        const totalGridHeight = displayedPitches.length * KEY_HEIGHT;
                        const newPitch = yToPitch(
                            Math.max(0, Math.min(totalGridHeight, pitchToY(draggedNote.note.pitch) + deltaY))
                        );
                        
                        updateNote(draggedNote.trackId, draggedNote.noteIndex, {
                            start_time: newTime,
                            pitch: newPitch
                        });
                    }
                }
            }
        }
        
        if (resizingNote && pianoRollRef.current) {
            const deltaX = e.clientX - resizingNote.startX;
            const newWidth = Math.max(20, resizingNote.startWidth + deltaX);
            
            const newDuration = widthToDuration(newWidth);
            updateNote(resizingNote.trackId, resizingNote.noteIndex, {
                duration: newDuration
            });
        }
    };

    const handleMouseUp = () => {
        setDraggedNote(null);
        setResizingNote(null);
        setTimeout(() => setIsDragging(false), 10); // Reset after click delay
    };

    const widthToDuration = (width: number): string => {
        const beats = width / PIXELS_PER_BEAT;
        
        if (beats >= 4) return '1n';
        if (beats >= 2) return '2n';
        if (beats >= 1) return '4n';
        if (beats >= 0.5) return '8n';
        return '16n';
    };

    useEffect(() => {
        if (draggedNote || resizingNote) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [draggedNote, resizingNote]);

    return (
        <div className="h-full w-full bg-zinc-950 overflow-hidden">
            <div className="h-full flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-zinc-800 flex-shrink-0">
                    <h2 className="text-lg font-semibold text-zinc-100">Piano Roll</h2>
                    <p className="text-sm text-zinc-500 mt-1">Click on a track to expand • Click notes to preview • Double-click to add notes • Drag to move • Resize edges to change duration • Right-click to delete</p>
                </div>

                {/* Tracks */}
                <div className="flex-1 overflow-y-auto">
                    {song.tracks.map((track, trackIndex) => {
                        const isExpanded = expandedTrackId === track.id;
                        const trackColor = getTrackColor(trackIndex);
                        
                        return (
                            <div 
                                key={track.id} 
                                className={`border-b border-zinc-800 transition-all duration-300 ${
                                    isExpanded ? 'h-96' : 'h-16'
                                }`}
                            >
                                {/* Track Header / Condensed View */}
                                <div 
                                    className={`h-16 px-6 flex items-center gap-4 cursor-pointer hover:bg-zinc-900/50 transition-colors relative overflow-hidden ${
                                        isExpanded ? '' : 'bg-zinc-900/30'
                                    }`}
                                    onClick={() => setExpandedTrackId(isExpanded ? null : track.id)}
                                >
                                    {/* Condensed notes behind text */}
                                    {!isExpanded && (() => {
                                        const gw = getTrackGridWidth(track);
                                        return (
                                        <div className="absolute inset-0">
                                            {/* Beat lines */}
                                            {Array.from({ length: 16 }, (_, i) => (
                                                <div
                                                    key={i}
                                                    className="absolute top-0 bottom-0 border-l border-zinc-700/20"
                                                    style={{ left: `${(i / 16) * 100}%` }}
                                                />
                                            ))}
                                            {/* Notes */}
                                            {track.notes.map((note, noteIndex) => (
                                                <div
                                                    key={noteIndex}
                                                    className={`absolute h-2 ${trackColor} rounded-sm opacity-40`}
                                                    style={{
                                                        left: `${(timeToX(note.start_time) / gw) * 100}%`,
                                                        width: `${(durationToWidth(note.duration) / gw) * 100}%`,
                                                        top: '50%',
                                                        transform: 'translateY(-50%)'
                                                    }}
                                                />
                                            ))}
                                        </div>
                                        );
                                    })()}

                                    {/* Text content on top */}
                                    <div className={`w-3 h-3 rounded-full ${trackColor} relative z-10 flex-shrink-0`} />
                                    <div className="flex-1 relative z-10">
                                        <div className="bg-black/70 inline-flex items-center gap-2 px-2 py-0.5 rounded-full">
                                            <h3 className="font-medium text-white text-sm">{track.id}</h3>
                                            <span className="text-xs text-zinc-400">
                                                {track.instrument?.preset || "Unknown"} • {track.notes.length} notes
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-xs text-zinc-400 relative z-10">
                                        {isExpanded ? "▼" : "▶"}
                                    </div>
                                </div>

                                {/* Expanded Piano Roll */}
                                {isExpanded && (() => {
                                    const gridWidth = getTrackGridWidth(track);
                                    const totalBeats = Math.ceil(gridWidth / PIXELS_PER_BEAT);
                                    return (
                                    <div className="h-80 px-6 pb-4" ref={pianoRollRef}>
                                        <div className="h-full bg-zinc-900/50 rounded-lg relative">
                                            <div className="h-full overflow-auto">
                                            {/* Piano Keys + Grid */}
                                            <div className="flex" style={{ height: displayedPitches.length * KEY_HEIGHT, minWidth: gridWidth + 64 }}>
                                                <div className="w-16 bg-zinc-800 border-r border-zinc-700 flex-shrink-0 sticky left-0 z-10">
                                                    {displayedPitches.map((pitch, index) => {
                                                        const isBlackKey = pitch.includes('#');
                                                        const isWhiteKey = !isBlackKey;
                                                        const isC = pitch.startsWith('C') && !pitch.includes('#');
                                                        return (
                                                            <div
                                                                key={pitch}
                                                                className={`border-b border-zinc-700/50 cursor-pointer transition-all flex items-center justify-end pr-1 ${
                                                                    isWhiteKey ? 'bg-zinc-100 hover:bg-zinc-200' : 'bg-zinc-900 hover:bg-zinc-700'
                                                                }`}
                                                                style={{ height: KEY_HEIGHT }}
                                                                title={pitch}
                                                                onClick={() => playNote(track.id, {
                                                                    pitch,
                                                                    start_time: "0:0:0",
                                                                    duration: "8n",
                                                                    velocity: 0.8
                                                                })}
                                                            >
                                                                {isC && <span className={`text-[9px] font-medium select-none ${isWhiteKey ? 'text-zinc-500' : 'text-zinc-400'}`}>{pitch}</span>}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                
                                                {/* Grid */}
                                                <div 
                                                    className="relative"
                                                    style={{ width: gridWidth }}
                                                    onDoubleClick={(e) => {
                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                        const x = e.clientX - rect.left;
                                                        const y = e.clientY - rect.top;
                                                        createNote(track.id, yToPitch(y), xToTime(x));
                                                    }}
                                                >
                                                    {/* Beat lines */}
                                                    <div className="absolute inset-0">
                                                        {Array.from({ length: totalBeats }, (_, i) => (
                                                            <div
                                                                key={i}
                                                                className={`absolute top-0 bottom-0 border-l ${
                                                                    i % song.time_signature[0] === 0 ? 'border-zinc-600/50' : 'border-zinc-700/30'
                                                                }`}
                                                                style={{ left: `${i * PIXELS_PER_BEAT}px` }}
                                                            />
                                                        ))}
                                                    </div>

                                                    {/* Notes */}
                                                    {track.notes.map((note, noteIndex) => (
                                                        <div
                                                            key={noteIndex}
                                                            className={`absolute ${trackColor} rounded cursor-pointer hover:opacity-80 transition-opacity shadow-sm group`}
                                                            style={{
                                                                left: `${timeToX(note.start_time)}px`,
                                                                width: `${durationToWidth(note.duration)}px`,
                                                                top: `${displayedPitches.indexOf(note.pitch) * KEY_HEIGHT}px`,
                                                                height: `${KEY_HEIGHT}px`
                                                            }}
                                                            onClick={() => handleNoteClick(track.id, note)}
                                                            onDoubleClick={(e) => e.stopPropagation()}
                                                            onMouseDown={(e) => {
                                                                if (e.button === 0) { // Left click only
                                                                    handleMouseDown(e, track.id, note, noteIndex, 'drag');
                                                                }
                                                            }}
                                                            onMouseEnter={() => setHoveredNote({ trackId: track.id, note, noteIndex })}
                                                            onMouseLeave={() => setHoveredNote(null)}
                                                            onContextMenu={(e) => {
                                                                e.preventDefault();
                                                                handleMouseDown(e, track.id, note, noteIndex, 'delete');
                                                            }}
                                                            title={`${note.pitch} • ${note.start_time} • ${note.duration} • Right-click to delete`}
                                                        >
                                                            {/* Resize handle */}
                                                            <div
                                                                className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-white/30"
                                                                onMouseDown={(e) => {
                                                                    e.stopPropagation();
                                                                    handleMouseDown(e, track.id, note, noteIndex, 'resize');
                                                                }}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            </div>

                                            {/* Hover Info */}
                                            {hoveredNote && hoveredNote.trackId === track.id && (
                                                <div className="absolute top-2 right-2 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300">
                                                    {hoveredNote.note.pitch} • {hoveredNote.note.start_time} • {hoveredNote.note.duration}
                                                    <div className="text-zinc-500 mt-1">Drag to move • Edge to resize • Right-click to delete</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    );
                                })()}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
