"use client";

import { useState } from "react";
import Chat from "@/components/Chat";
import PianoRoll from "@/components/PianoRoll";
import { Song } from "@/lib/types";
import { engine } from "@/lib/audio";
import { Play, Square, Save, FolderOpen } from "lucide-react";

export default function Home() {
  const [song, setSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioInitialized, setAudioInitialized] = useState(false);

  const handleUpdateSong = async (newSong: Song) => {
    setSong(newSong);
    if (audioInitialized) {
      await engine.loadSong(newSong);
    }
  };

  const handlePlayPause = async () => {
    if (!audioInitialized) {
      await engine.init();
      setAudioInitialized(true);
      if (song) {
        await engine.loadSong(song);
      }
    }

    if (isPlaying) {
      engine.stop();
      setIsPlaying(false);
    } else {
      if (!song) return; // Nothing to play
      engine.play();
      setIsPlaying(true);
    }
  };

  const handleSave = async () => {
    try {
      await fetch("http://localhost:8000/api/save", { method: "POST" });
      alert("Song saved successfully!");
    } catch (e) {
      console.error(e);
      alert("Failed to save song");
    }
  };

  const handleLoad = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/load", { method: "POST" });
      const data = await res.json();
      await handleUpdateSong(data);
    } catch (e) {
      console.error(e);
      alert("Failed to load song");
    }
  };

  return (
    <div className="flex h-screen w-full bg-zinc-950 text-white overflow-hidden selection:bg-indigo-500/30 font-sans">
      {/* Sidebar: Chat Interface */}
      <div className="w-[380px] h-full flex-shrink-0 relative z-20 shadow-2xl border-r border-zinc-800">
        <Chat onUpdateSong={handleUpdateSong} />
      </div>

      {/* Main Content: Piano Roll & Transport */}
      <div className="flex-1 flex flex-col relative bg-[#111] z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/15 via-zinc-950 to-zinc-950 pointer-events-none" />

        <div className="flex-1 relative z-10 overflow-hidden">
          <PianoRoll song={song} />
        </div>

        {/* Transport Controls */}
        <div className="h-[88px] bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-800 flex items-center justify-between z-20 px-8 flex-shrink-0 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.5)]">
          <div className="flex items-center gap-6">
            <button
              onClick={handlePlayPause}
              disabled={!song || song.tracks.length === 0}
              className={`w-14 h-14 flex items-center justify-center rounded-2xl transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed ${isPlaying
                ? "bg-rose-500/20 text-rose-500 hover:bg-rose-500/30 border border-rose-500/50"
                : "bg-indigo-600 text-white hover:bg-indigo-500 border border-indigo-400/20"
                }`}
            >
              {isPlaying ? <Square className="w-5 h-5 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
            </button>
            <div className="flex flex-col opacity-60">
              <span className="text-xs uppercase tracking-widest text-zinc-400 font-semibold mb-0.5">Global Pitch</span>
              <span className="text-sm font-medium text-zinc-300">440Hz / Standard</span>
            </div>
          </div>

          <div className="flex items-center gap-4 ml-8 border-l border-zinc-800/80 pl-8 mr-auto">
            <button onClick={handleSave} className="flex flex-col items-center gap-1 text-zinc-500 hover:text-indigo-400 transition-colors">
              <Save className="w-5 h-5" />
              <span className="text-[10px] uppercase font-bold tracking-wider">Save</span>
            </button>
            <button onClick={handleLoad} className="flex flex-col items-center gap-1 text-zinc-500 hover:text-indigo-400 transition-colors">
              <FolderOpen className="w-5 h-5" />
              <span className="text-[10px] uppercase font-bold tracking-wider">Load</span>
            </button>
          </div>

          <div className="flex gap-10">
            <div className="flex flex-col items-center">
              <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-1">Tempo</span>
              <div className="text-2xl font-light tabular-nums border border-zinc-800 bg-zinc-950/50 px-4 py-1.5 rounded-xl shadow-inner text-indigo-300">
                {song?.tempo || "--"}
              </div>
            </div>

            <div className="flex flex-col items-center">
              <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-1">Time Sig</span>
              <div className="text-2xl font-light tabular-nums border border-zinc-800 bg-zinc-950/50 px-4 py-1.5 rounded-xl shadow-inner text-zinc-300">
                {song?.time_signature ? song.time_signature.join("/") : "--"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
