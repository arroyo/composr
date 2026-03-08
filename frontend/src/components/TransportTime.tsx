"use client";

import { useState, useEffect, useRef } from "react";
import * as Tone from "tone";

interface TransportTimeProps {
    isPlaying: boolean;
}

export default function TransportTime({ isPlaying }: TransportTimeProps) {
    const [displayMode, setDisplayMode] = useState<"time" | "measures">("measures");
    const [currentTime, setCurrentTime] = useState<number>(0);
    const [currentBars, setCurrentBars] = useState<string>("1:1:1");
    const frameRef = useRef<number | null>(null);

    useEffect(() => {
        const updateTime = () => {
            if (Tone.Transport.state === "started") {
                setCurrentTime(Tone.Transport.seconds);
                // Tone.Transport.position returns 'bars:beats:sixteenths'
                let posString = "";
                const pos = Tone.Transport.position;
                if (typeof pos === "string") {
                    posString = pos.split('.')[0];
                } else if (typeof pos === "number") {
                    posString = Tone.Time(pos).toBarsBeatsSixteenths().split('.')[0];
                }
                
                // Parse 0-indexed format "bars:beats:sixteenths" and render 1-indexed
                if (posString) {
                    const parts = posString.split(':').map(Number);
                    if (parts.length === 3) {
                       setCurrentBars(`${parts[0] + 1}:${parts[1] + 1}:${parts[2] + 1}`);
                    }
                }
            }
            frameRef.current = requestAnimationFrame(updateTime);
        };

        if (isPlaying) {
            frameRef.current = requestAnimationFrame(updateTime);
        } else {
            if (frameRef.current) cancelAnimationFrame(frameRef.current);
            // Reset to 1:1:1 when stopped
            if (Tone.Transport.state === "stopped") {
                setCurrentTime(0);
                setCurrentBars("1:1:1");
            }
        }

        return () => {
            if (frameRef.current) cancelAnimationFrame(frameRef.current);
        };
    }, [isPlaying]);

    // Format absolute time mm:ss.ms
    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);
        return `${m}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
    };

    return (
        <div 
            className="flex flex-col items-center cursor-pointer group"
            onClick={() => setDisplayMode(prev => prev === "measures" ? "time" : "measures")}
            title="Click to toggle time format"
        >
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-1 group-hover:text-indigo-400 transition-colors">
                {displayMode === "measures" ? "Position" : "Time"}
            </span>
            <div className={`text-2xl font-light tabular-nums border border-zinc-800 bg-zinc-950/50 py-1.5 rounded-xl shadow-inner text-indigo-300 text-center transition-colors group-hover:border-indigo-500/30 ${displayMode === "time" ? "w-36" : "w-28"}`}>
                {displayMode === "measures" ? currentBars : formatTime(currentTime)}
            </div>
        </div>
    );
}
