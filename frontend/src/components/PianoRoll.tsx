"use client";

import { useState, useEffect } from "react";
import { Song } from "@/lib/types";
import { VolumeX, Headphones } from "lucide-react";
import { engine } from "@/lib/audio";

interface PianoRollProps {
    song: Song | null;
    audioInitialized: boolean;
    onEnsureAudioInit: () => Promise<void>;
}

export default function PianoRoll({ song, audioInitialized, onEnsureAudioInit }: PianoRollProps) {
    const [mutedTracks, setMutedTracks] = useState<Set<string>>(new Set());
    const [soloTracks, setSoloTracks] = useState<Set<string>>(new Set());

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
                                <span className="text-xs px-2 py-1 rounded-md bg-zinc-800/80 text-zinc-300 font-mono border border-zinc-700/30">
                                    {track.instrument?.preset || "unknown"}
                                </span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => toggleMute(track.id)}
                                    className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-colors ${isMuted ? 'bg-orange-500/20 text-orange-400 border-orange-500/50' : 'bg-transparent text-zinc-500 border-zinc-700/50 hover:bg-zinc-800 hover:text-zinc-300'}`}
                                    title="Mute Track"
                                >
                                    <VolumeX className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => toggleSolo(track.id)}
                                    className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-colors ${isSoloed ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50' : 'bg-transparent text-zinc-500 border-zinc-700/50 hover:bg-zinc-800 hover:text-zinc-300'}`}
                                    title="Solo Track"
                                >
                                    <Headphones className="w-4 h-4" />
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
