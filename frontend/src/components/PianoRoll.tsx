"use client";

import { Song } from "@/lib/types";

interface PianoRollProps {
    song: Song | null;
}

export default function PianoRoll({ song }: PianoRollProps) {
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
        <div className="flex flex-col gap-8 p-10 h-full overflow-y-auto">
            <div className="flex justify-between items-end border-b border-zinc-800/50 pb-4">
                <div>
                    <h1 className="text-2xl font-semibold text-zinc-100">Arrangement</h1>
                    <p className="text-zinc-500 text-sm mt-1">Tempo: {song.tempo} BPM • Time Signature: {song.time_signature.join("/")}</p>
                </div>
            </div>

            {song.tracks.map(track => (
                <div key={track.id} className="bg-zinc-900/40 rounded-2xl border border-zinc-800/50 p-6 shadow-xl space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-medium text-zinc-200 text-lg">{track.id}</h3>
                        <span className="text-xs px-2 py-1 rounded-md bg-zinc-800/80 text-zinc-300 font-mono border border-zinc-700/30">
                            {track.instrument}
                        </span>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                        {track.notes.length === 0 ? (
                            <span className="text-zinc-600 italic text-sm">No notes generated for this track</span>
                        ) : (
                            track.notes.map((note, idx) => (
                                <div key={idx} className="flex gap-2.5 items-center bg-zinc-800/50 border border-zinc-700/50 px-3 py-1.5 rounded-lg text-zinc-300 transition-all hover:bg-zinc-800 hover:border-zinc-500 cursor-default">
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
            ))}
        </div>
    );
}
