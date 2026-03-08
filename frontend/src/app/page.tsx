"use client";

import { useState, useEffect } from "react";
import Chat from "@/components/Chat";
import PianoRoll from "@/components/PianoRoll";
import Mixer from "@/components/Mixer";
import TransportTime from "@/components/TransportTime";
import { Song } from "@/lib/types";
import { engine } from "@/lib/audio";
import { Play, Square, Save, FolderOpen, Trash2 } from "lucide-react";

export default function Home() {
  const [song, setSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioInitialized, setAudioInitialized] = useState(false);
  const [viewMode, setViewMode] = useState<"arrangement" | "mixer">("arrangement");

  useEffect(() => {
    engine.onPlaybackStop = () => setIsPlaying(false);
    
    // Load saved song from browser storage
    const savedSong = localStorage.getItem("composr_song");
    if (savedSong) {
      try {
        const parsedSong = JSON.parse(savedSong) as Song;
        setSong(parsedSong);
        
        // Sync the restored state with the backend silently
        fetch("http://localhost:8000/api/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: savedSong,
        }).catch(err => console.error("Failed to sync restored state to backend", err));
      } catch (e) {
        console.error("Failed to parse saved song from localStorage", e);
      }
    }
  }, []);

  const handleUpdateSong = async (newSong: Song) => {
    setSong(newSong);
    localStorage.setItem("composr_song", JSON.stringify(newSong));
    if (audioInitialized) {
      await engine.loadSong(newSong);
    }
  };

  const handleClear = () => {
    if (window.confirm("Are you sure you want to clear the current song? This cannot be undone.")) {
      const emptySong: Song = {
        name: "Untitled Song",
        tempo: 120,
        time_signature: [4, 4],
        tracks: []
      };
      
      setSong(null);
      localStorage.removeItem("composr_song");
      
      if (isPlaying) {
        engine.stop();
        setIsPlaying(false);
      }
      
      if (audioInitialized) {
        engine.loadSong(emptySong).catch(console.error);
      }
      
      // Notify backend about the cleared state
      fetch("http://localhost:8000/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emptySong),
      }).catch(err => console.error("Failed to clear state on backend", err));
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

  const handleSave = () => {
    if (!song) {
      alert("No song to save!");
      return;
    }
    try {
      let filename = "song.json";
      if (song.name) {
        let safeName = song.name.replace(/ /g, '-').slice(0, 35);
        safeName = safeName.replace(/[^a-zA-Z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
        if (safeName) filename = `${safeName}.json`;
      }

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(song, null, 2));
      const downloadAnchorNode = document.createElement("a");
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", filename);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    } catch (e) {
      console.error(e);
      alert("Failed to save song");
    }
  };

  const handleLoad = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const parsedSong = JSON.parse(text) as Song;
        await handleUpdateSong(parsedSong);

        // Sync back up with the backend so the AI agent knows the new state
        await fetch("http://localhost:8000/api/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: text,
        });

      } catch (err) {
        console.error(err);
        alert("Failed to load song from file");
      }
    };
    input.click();
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

        {/* Global View Header */}
        <div className="px-10 pt-10 pb-4 flex justify-between items-end border-b border-zinc-800/50 z-10 relative flex-shrink-0">
          <div>
            <div className="flex items-center gap-6">
              <h1 className="text-2xl font-semibold text-zinc-100 flex items-center gap-4">
                <button 
                  onClick={() => setViewMode('arrangement')} 
                  className={`transition-colors ${viewMode === 'arrangement' ? 'text-zinc-100' : 'text-zinc-600 hover:text-zinc-400'}`}
                >
                  Arrangement
                </button>
                <span className="text-zinc-800">/</span>
                <button 
                  onClick={() => setViewMode('mixer')} 
                  className={`transition-colors ${viewMode === 'mixer' ? 'text-zinc-100' : 'text-zinc-600 hover:text-zinc-400'}`}
                >
                  Mixer
                </button>
              </h1>
            </div>
            {song ? (
              <p className="text-zinc-500 text-sm mt-1">
                <strong className="text-zinc-300">{song.name || "Untitled Song"}</strong> • Tempo: {song.tempo} BPM • Time Signature: {song.time_signature.join("/")}
              </p>
            ) : (
              <p className="text-zinc-500 text-sm mt-1">Ready to create</p>
            )}
          </div>
        </div>

        <div className="flex-1 relative z-10 overflow-hidden flex">
          {viewMode === "arrangement" ? (
            <PianoRoll song={song} audioInitialized={audioInitialized} onEnsureAudioInit={async () => {
              if (!audioInitialized) {
                await engine.init();
                setAudioInitialized(true);
                if (song) await engine.loadSong(song);
              }
            }} />
          ) : (
            <Mixer song={song} onUpdateSong={handleUpdateSong} audioInitialized={audioInitialized} />
          )}
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
            <button onClick={handleClear} disabled={!song} className="flex flex-col items-center gap-1 text-zinc-500 hover:text-rose-400 disabled:opacity-50 disabled:hover:text-zinc-500 transition-colors">
              <Trash2 className="w-5 h-5" />
              <span className="text-[10px] uppercase font-bold tracking-wider">Clear</span>
            </button>
          </div>

          <div className="flex gap-10">
            <TransportTime isPlaying={isPlaying} />
            
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
