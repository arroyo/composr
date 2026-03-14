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

const OCTAVES = [2, 3, 4, 5, 6];

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

    const timeToX = (timeStr: string, width: number): number => {
        const { bar, beat, sixteenth } = parseTime(timeStr);
        const beatsPerBar = song.time_signature[0];
        const totalBeats = bar * beatsPerBar + beat + sixteenth / 4;
        const pixelsPerBeat = width / (song.time_signature[0] * 4); // 4 bars visible
        return totalBeats * pixelsPerBeat;
    };

    const durationToWidth = (duration: string, width: number): number => {
        const pixelsPerBeat = width / (song.time_signature[0] * 4);
        const durationMap: { [key: string]: number } = {
            '1n': 4,      // Whole note = 4 beats
            '2n': 2,      // Half note = 2 beats  
            '4n': 1,      // Quarter note = 1 beat
            '8n': 0.5,    // Eighth note = 0.5 beat
            '16n': 0.25,  // Sixteenth note = 0.25 beat
        };
        const beats = durationMap[duration] || 1;
        return beats * pixelsPerBeat;
    };

    const pitchToY = (pitch: string, height: number): number => {
        const index = allPitches.indexOf(pitch);
        if (index === -1) return height / 2;
        return (index / allPitches.length) * height;
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

    const xToTime = (x: number, width: number): string => {
        const pixelsPerBeat = width / (song.time_signature[0] * 4);
        const totalBeats = x / pixelsPerBeat;
        const beatsPerBar = song.time_signature[0];
        const bar = Math.floor(totalBeats / beatsPerBar);
        const beat = Math.floor(totalBeats % beatsPerBar);
        const sixteenth = Math.floor((totalBeats % 1) * 4);
        return `${bar}:${beat}:${sixteenth}`;
    };

    const yToPitch = (y: number, height: number): string => {
        const index = Math.floor((y / height) * allPitches.length);
        return allPitches[Math.min(Math.max(0, index), allPitches.length - 1)];
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
                            Math.max(0, Math.min(gridRect.width, timeToX(draggedNote.note.start_time, 800) + deltaX)),
                            800
                        );
                        
                        const newPitch = yToPitch(
                            Math.max(0, Math.min(gridRect.height, pitchToY(draggedNote.note.pitch, 320) + deltaY)),
                            320
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
            
            const newDuration = widthToDuration(newWidth, 800);
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

    const widthToDuration = (width: number, totalWidth: number): string => {
        const pixelsPerBeat = totalWidth / (song.time_signature[0] * 4);
        const beats = width / pixelsPerBeat;
        
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
                    <p className="text-sm text-zinc-500 mt-1">Click on a track to expand • Click notes to preview • Drag to move • Resize edges to change duration • Right-click to delete</p>
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
                                    isExpanded ? 'h-96' : 'h-20'
                                }`}
                            >
                                {/* Track Header */}
                                <div 
                                    className="h-20 px-6 flex items-center gap-4 cursor-pointer hover:bg-zinc-900/50 transition-colors"
                                    onClick={() => setExpandedTrackId(isExpanded ? null : track.id)}
                                >
                                    <div className={`w-3 h-3 rounded-full ${trackColor}`} />
                                    <div className="flex-1">
                                        <h3 className="font-medium text-zinc-200">{track.id}</h3>
                                        <p className="text-xs text-zinc-500">
                                            {track.instrument?.preset || "Unknown"} • {track.notes.length} notes
                                        </p>
                                    </div>
                                    <div className="text-xs text-zinc-400">
                                        {isExpanded ? "▼" : "▶"} Click to {isExpanded ? "collapse" : "expand"}
                                    </div>
                                </div>

                                {/* Condensed View */}
                                {!isExpanded && (
                                    <div className="h-16 px-6 flex items-center">
                                        <div className="w-full h-12 bg-zinc-900/50 rounded-lg relative overflow-hidden">
                                            {/* Beat lines for condensed view */}
                                            <div className="absolute inset-0">
                                                {Array.from({ length: 16 }, (_, i) => (
                                                    <div
                                                        key={i}
                                                        className="absolute top-0 bottom-0 border-l border-zinc-700/20"
                                                        style={{ left: `${(i / 16) * 100}%` }}
                                                    />
                                                ))}
                                            </div>
                                            
                                            {/* Notes positioned by actual timing */}
                                            {track.notes.map((note, noteIndex) => (
                                                <div
                                                    key={noteIndex}
                                                    className={`absolute h-2 ${trackColor} rounded-sm cursor-pointer hover:opacity-80 transition-opacity`}
                                                    style={{
                                                        left: `${timeToX(note.start_time, 800)}px`,
                                                        width: `${durationToWidth(note.duration, 800)}px`,
                                                        top: '40%'
                                                    }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        playNote(track.id, note);
                                                    }}
                                                    onContextMenu={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        deleteNote(track.id, noteIndex);
                                                    }}
                                                    title={`${note.pitch} at ${note.start_time} • Right-click to delete`}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Expanded Piano Roll */}
                                {isExpanded && (
                                    <div className="h-80 px-6 pb-4" ref={pianoRollRef}>
                                        <div className="h-full bg-zinc-900/50 rounded-lg relative overflow-hidden">
                                            {/* Piano Keys Background */}
                                            <div className="absolute inset-0 flex">
                                                <div className="w-16 bg-zinc-800 border-r border-zinc-700">
                                                    {allPitches.slice(24, 60).map((pitch, index) => {
                                                        const isBlackKey = pitch.includes('#');
                                                        const isWhiteKey = !isBlackKey;
                                                        return (
                                                            <div
                                                                key={pitch}
                                                                className={`h-2 border-b border-zinc-700/50 cursor-pointer transition-all ${
                                                                    isWhiteKey ? 'bg-zinc-100 hover:bg-zinc-200' : 'bg-zinc-900 hover:bg-zinc-700'
                                                                }`}
                                                                title={pitch}
                                                                onClick={() => playNote(track.id, {
                                                                    pitch,
                                                                    start_time: "0:0:0",
                                                                    duration: "4n",
                                                                    velocity: 80
                                                                })}
                                                            />
                                                        );
                                                    })}
                                                </div>
                                                
                                                {/* Grid */}
                                                <div className="flex-1 relative">
                                                    {/* Beat lines */}
                                                    <div className="absolute inset-0">
                                                        {Array.from({ length: 16 }, (_, i) => (
                                                            <div
                                                                key={i}
                                                                className="absolute top-0 bottom-0 border-l border-zinc-700/30"
                                                                style={{ left: `${(i / 16) * 100}%` }}
                                                            />
                                                        ))}
                                                    </div>

                                                    {/* Notes */}
                                                    {track.notes.map((note, noteIndex) => (
                                                        <div
                                                            key={noteIndex}
                                                            className={`absolute ${trackColor} rounded cursor-pointer hover:opacity-80 transition-opacity shadow-sm group`}
                                                            style={{
                                                                left: `${timeToX(note.start_time, 800)}px`,
                                                                width: `${durationToWidth(note.duration, 800)}px`,
                                                                top: `${pitchToY(note.pitch, 320)}px`,
                                                                height: '8px'
                                                            }}
                                                            onClick={() => handleNoteClick(track.id, note)}
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

                                            {/* Hover Info */}
                                            {hoveredNote && hoveredNote.trackId === track.id && (
                                                <div className="absolute top-2 right-2 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300">
                                                    {hoveredNote.note.pitch} • {hoveredNote.note.start_time} • {hoveredNote.note.duration}
                                                    <div className="text-zinc-500 mt-1">Drag to move • Edge to resize • Right-click to delete</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
