"use client";

import { useState, useEffect } from "react";
import { Song } from "@/lib/types";
import { engine } from "@/lib/audio";
import { MoreHorizontal, Trash2 } from "lucide-react";

interface PianoRollProps {
    song: Song | null;
    audioInitialized: boolean;
    onUpdateSong: (song: Song, skipAudioReload?: boolean) => void;
    onEnsureAudioInit: () => Promise<void>;
}

export default function PianoRoll({ song, audioInitialized, onUpdateSong, onEnsureAudioInit }: PianoRollProps) {
    const [mutedTracks, setMutedTracks] = useState<Set<string>>(new Set());
    const [soloTracks, setSoloTracks] = useState<Set<string>>(new Set());
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    // Sync with engine preferences when song changes
    useEffect(() => {
        if (!song) return;
        setMutedTracks(new Set(Object.keys(engine.trackMutes).filter(id => engine.trackMutes[id])));
        setSoloTracks(new Set(Object.keys(engine.trackSolos).filter(id => engine.trackSolos[id])));
    }, [song]);

    const toggleMute = (trackId: string) => {
        setMutedTracks(prev => {
            const next = new Set(prev);
            if (next.has(trackId)) {
                next.delete(trackId);
                engine.setTrackMute(trackId, false);
            } else {
                next.add(trackId);
                engine.setTrackMute(trackId, true);
            }
            return next;
        });
    };

    const toggleSolo = (trackId: string) => {
        setSoloTracks(prev => {
            const next = new Set(prev);
            if (next.has(trackId)) {
                next.delete(trackId);
                engine.setTrackSolo(trackId, false);
            } else {
                next.add(trackId);
                engine.setTrackSolo(trackId, true);
            }
            return next;
        });
    };

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

    return (
        <div className="flex flex-col gap-8 px-10 pb-10 pt-6 h-full overflow-y-auto">
            {song.tracks.map(track => {
                const isMuted = mutedTracks.has(track.id);
                const isSoloed = soloTracks.has(track.id);
                const isSilenced = isMuted || (soloTracks.size > 0 && !isSoloed);

                return (
                    <div key={track.id} className={`bg-zinc-900/40 rounded-2xl border border-zinc-800/50 p-6 shadow-xl space-y-4 transition-opacity ${isSilenced ? 'opacity-40' : 'opacity-100'}`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <h3 className="font-medium text-zinc-200 text-lg">{track.id}</h3>
                                <div className="relative group flex items-center cursor-pointer">
                                    <span className="text-xs px-2 py-1 rounded-md bg-zinc-800/80 text-zinc-300 group-hover:text-indigo-300 font-mono border border-zinc-700/30 group-hover:border-indigo-500/50 transition-colors">
                                        {track.instrument?.preset || "unknown"}
                                    </span>
                                    {track.instrument && (
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs w-48 z-50 pointer-events-none shadow-2xl text-left">
                                            <div className="text-zinc-400 mb-1"><span className="text-zinc-500">Engine:</span> {track.instrument.engine}</div>
                                            <div className="text-zinc-400 mb-1"><span className="text-zinc-500">Plugin:</span> {track.instrument.plugin}</div>
                                            <div className="text-zinc-400 mb-1"><span className="text-zinc-500">Bank:</span> {track.instrument.bank}</div>
                                            <div className="text-indigo-300"><span className="text-zinc-500">Preset:</span> {track.instrument.preset}</div>
                                        </div>
                                    )}
                                </div>

                                <div className="relative">
                                    <button 
                                        onClick={() => setOpenMenuId(openMenuId === track.id ? null : track.id)}
                                        className="p-1 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors ml-1"
                                    >
                                        <MoreHorizontal className="w-4 h-4" />
                                    </button>
                                    
                                    {openMenuId === track.id && (
                                        <>
                                            <div 
                                                className="fixed inset-0 z-40"
                                                onClick={() => setOpenMenuId(null)}
                                            />
                                            <div className="absolute left-0 top-full mt-1 z-50 w-36 bg-zinc-900 border border-zinc-700/50 rounded-lg shadow-xl py-1 overflow-hidden">
                                                <button 
                                                    onClick={() => {
                                                        if (window.confirm(`Are you sure you want to delete track "${track.id}"?`)) {
                                                            onUpdateSong({
                                                                ...song,
                                                                tracks: song.tracks.filter(t => t.id !== track.id)
                                                            });
                                                        }
                                                        setOpenMenuId(null);
                                                    }}
                                                    className="w-full text-left px-3 py-2 text-sm text-rose-500 hover:bg-zinc-800 flex items-center gap-2 transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                    Delete Track
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => toggleMute(track.id)}
                                    className={`w-9 h-9 flex items-center justify-center rounded-lg border font-bold text-xs transition-all ${isMuted ? 'bg-rose-500/20 text-rose-500 border-rose-500/50' : 'bg-zinc-800 text-zinc-400 border-transparent hover:bg-zinc-700'}`}
                                    title="Mute Track"
                                >
                                    M
                                </button>
                                <button 
                                    onClick={() => toggleSolo(track.id)}
                                    className={`w-9 h-9 flex items-center justify-center rounded-lg border font-bold text-xs transition-all ${isSoloed ? 'bg-amber-500/20 text-amber-500 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'bg-zinc-800 text-zinc-400 border-transparent hover:bg-zinc-700'}`}
                                    title="Solo Track"
                                >
                                    S
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 pt-2">
                            {track.notes.length === 0 ? (
                                <span className="text-zinc-600 italic text-sm">No notes generated for this track</span>
                            ) : (
                                track.notes.map((note, idx) => (
                                    <div
                                        key={idx}
                                        onClick={async () => {
                                            await onEnsureAudioInit();
                                            engine.playNote(track.id, note.pitch, note.duration, note.velocity);
                                        }}
                                        className="flex gap-2.5 items-center bg-zinc-800/50 border border-zinc-700/50 px-3 py-1.5 rounded-lg text-zinc-300 transition-all hover:bg-indigo-900/40 hover:border-indigo-500/50 active:scale-95 cursor-pointer shadow-sm select-none"
                                        title={`Play ${note.pitch}`}
                                    >
                                        <span className="font-medium text-indigo-400">{note.pitch}</span>
                                        <div className="h-4 w-px bg-zinc-700"></div>
                                        <span className="text-zinc-400 font-mono text-xs">{note.start_time}</span>
                                        <div className="h-4 w-px bg-zinc-700"></div>
                                        <span className="text-zinc-500 font-mono text-xs">{note.duration}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
