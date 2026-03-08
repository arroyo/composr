import { useState, useEffect } from "react";
import { Song, Track } from "@/lib/types";
import { engine } from "@/lib/audio";

interface MixerProps {
  song: Song | null;
  onUpdateSong: (song: Song) => void;
  audioInitialized: boolean;
}

export default function Mixer({ song, onUpdateSong, audioInitialized }: MixerProps) {
  const [masterVolume, setMasterVolume] = useState(0); // 0 dB default

  // Sync master volume to engine real-time
  useEffect(() => {
    if (audioInitialized) {
      engine.setMasterVolume(masterVolume);
    }
  }, [masterVolume, audioInitialized]);

  if (!song) {
    return (
      <div className="flex-1 flex items-center justify-center h-full text-zinc-600">
        No tracks to mix. Ask the AI to generate a song first!
      </div>
    );
  }

  const handleVolumeChange = (trackIndex: number, newVolume: number) => {
    const updatedSong = { ...song };
    updatedSong.tracks[trackIndex].volume = newVolume;
    onUpdateSong(updatedSong);
    if (audioInitialized) {
      engine.setTrackVolume(updatedSong.tracks[trackIndex].id, newVolume);
    }
  };

  const handlePanChange = (trackIndex: number, newPan: number) => {
    const updatedSong = { ...song };
    updatedSong.tracks[trackIndex].pan = newPan;
    onUpdateSong(updatedSong);
    if (audioInitialized) {
      engine.setTrackPan(updatedSong.tracks[trackIndex].id, newPan);
    }
  };

  const toggleMute = (track: Track) => {
    const currentMute = engine.trackMutes[track.id] || false;
    engine.setTrackMute(track.id, !currentMute);
    // Force re-render locally by calling a dummy state or relying on parent
    // Next.js fast refresh or a local toggle tracker.
    // For simplicity, we just trigger a song update to re-render.
    onUpdateSong({ ...song });
  };

  const toggleSolo = (track: Track) => {
    const currentSolo = engine.trackSolos[track.id] || false;
    engine.setTrackSolo(track.id, !currentSolo);
    onUpdateSong({ ...song });
  };

  return (
    <div className="flex-1 h-full w-full bg-[#151518] p-8 overflow-x-auto flex items-stretch gap-6">
      
      {/* Individual Track Channels */}
      {song.tracks.map((track, i) => {
        const panVal = track.pan ?? 0;
        const volVal = track.volume ?? 0;
        const isMuted = engine.trackMutes[track.id] || false;
        const isSoloed = engine.trackSolos[track.id] || false;

        return (
          <div key={track.id} className="flex flex-col items-center justify-end w-24 bg-zinc-900/50 rounded-2xl border border-zinc-800/80 p-4 shadow-xl">
            {/* Spacer to push controls to bottom */}
            <div className="mb-auto" />

            {/* Pan Slider */}
            <div className="flex flex-col items-center mb-6 w-full">
              <span className="text-[9px] uppercase tracking-widest text-zinc-500 mb-2 font-semibold">
                {panVal === 0 ? "C" : panVal < 0 ? `L${Math.abs(Math.round(panVal * 100))}` : `R${Math.round(panVal * 100)}`}
              </span>
              <input 
                type="range" 
                min="-1" max="1" step="0.05" 
                value={panVal}
                onChange={(e) => handlePanChange(i, parseFloat(e.target.value))}
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>

            {/* Mute / Solo Buttons */}
            <div className="flex gap-2 w-full mb-6 relative">
              <button 
                onClick={() => toggleMute(track)}
                className={`flex-1 h-8 rounded-md text-xs font-bold transition-all ${isMuted ? 'bg-rose-500/20 text-rose-500 border border-rose-500/50' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
              >
                M
              </button>
              <button 
                onClick={() => toggleSolo(track)}
                className={`flex-1 h-8 rounded-md text-xs font-bold transition-all ${isSoloed ? 'bg-amber-500/20 text-amber-500 border border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
              >
                S
              </button>
            </div>

            {/* Volume Fader */}
            <div className="relative h-64 mb-6 flex justify-center group">
              {/* dB scale markings */}
              <div className="absolute -left-6 top-0 bottom-0 flex flex-col justify-between text-[9px] text-zinc-600 font-medium py-2 opacity-50">
                <span>+6</span>
                <span>0</span>
                <span>-20</span>
                <span>-40</span>
                <span>-60</span>
              </div>
              
              <input 
                type="range" 
                min="-60" max="6" step="0.5"
                value={volVal}
                onChange={(e) => {
                  engine.setTrackVolume(track.id, parseFloat(e.target.value));
                  // Debounce the state update if performance suffers, but for now we lift it up
                  const updatedSong = { ...song };
                  updatedSong.tracks[i].volume = parseFloat(e.target.value);
                  onUpdateSong(updatedSong);
                }}
                // We use writing-mode or CSS rotation for vertical sliders
                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                className="h-full w-2 appearance-none bg-zinc-950 border border-zinc-800 rounded-full cursor-pointer accent-indigo-500"
              />
            </div>

            {/* Track Name */}
            <div className="relative group w-full cursor-pointer">
              <div className="bg-zinc-950 w-full text-center py-2 rounded-lg border border-zinc-800 shadow-inner group-hover:border-indigo-500/50 transition-colors">
                <span className="text-xs font-semibold text-zinc-300 group-hover:text-indigo-300 transition-colors truncate px-1 block">{track.id}</span>
              </div>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs w-48 z-50 pointer-events-none shadow-2xl text-left">
                <div className="text-zinc-400 mb-1"><span className="text-zinc-500">Engine:</span> {track.instrument.engine}</div>
                <div className="text-zinc-400 mb-1"><span className="text-zinc-500">Plugin:</span> {track.instrument.plugin}</div>
                <div className="text-zinc-400 mb-1"><span className="text-zinc-500">Bank:</span> {track.instrument.bank}</div>
                <div className="text-indigo-300"><span className="text-zinc-500">Preset:</span> {track.instrument.preset}</div>
              </div>
            </div>
            {/* Decibel Readout */}
            <span className="text-[10px] tabular-nums text-zinc-500 mt-2 font-mono">{volVal.toFixed(1)} dB</span>
          </div>
        );
      })}

      {/* Spacer pushing Master to the right */}
      <div className="flex-1"></div>

      {/* Master Channel Strip */}
      <div className="flex flex-col items-center justify-end w-28 bg-zinc-900/80 rounded-2xl border border-zinc-700 p-4 shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-indigo-900/10 to-transparent pointer-events-none" />
        
        {/* Pan (Disabled for Master usually, just displaying Master text) */}
        <div className="text-[10px] uppercase tracking-widest text-indigo-400/50 font-bold mb-10">
          MAIN OUT
        </div>

        {/* Master Volume Fader */}
        <div className="relative h-64 mb-6 flex justify-center w-full z-10">
           <div className="absolute -left-4 top-0 bottom-0 flex flex-col justify-between text-[9px] text-zinc-500 font-medium py-2">
              <span>+6</span>
              <span>0</span>
              <span>-20</span>
              <span>-40</span>
              <span>-60</span>
            </div>
            <input 
              type="range" 
              min="-60" max="6" step="0.5"
              value={masterVolume}
              onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
              className="h-full w-3 appearance-none bg-zinc-950 border border-zinc-800 rounded-full cursor-pointer accent-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.3)]"
            />
        </div>

        <div className="bg-zinc-950 w-full text-center py-2 rounded-lg border border-zinc-700 shadow-inner z-10">
           <span className="text-xs font-bold text-rose-400 tracking-wider">MASTER</span>
        </div>
        <span className="text-[10px] tabular-nums text-zinc-400 mt-2 font-mono z-10">{masterVolume.toFixed(1)} dB</span>
      </div>

    </div>
  );
}
