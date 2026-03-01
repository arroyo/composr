"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Music } from "lucide-react";
import { Song } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ChatProps {
    onUpdateSong: (song: Song) => void;
}

interface Message {
    role: "user" | "agent";
    content: string;
}

export default function Chat({ onUpdateSong }: ChatProps) {
    const [messages, setMessages] = useState<Message[]>([
        { role: "agent", content: "Hi! I am your AI Music Producer. What would you like to compose today?" }
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput("");
        setMessages(prev => [...prev, { role: "user", content: userMessage }]);
        setIsLoading(true);

        try {
            const res = await fetch("http://localhost:8000/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: userMessage })
            });

            const data = await res.json();

            if (data.song_state) {
                onUpdateSong(data.song_state);
            }

            setMessages(prev => [...prev, { role: "agent", content: data.response }]);
        } catch (e) {
            setMessages(prev => [...prev, { role: "agent", content: "Oops, something went wrong communicating with the backend API." }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-zinc-950/50 backdrop-blur-xl border-r border-zinc-800/50">
            <div className="p-4 border-b border-zinc-800/50 flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl">
                    <Music className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h2 className="text-sm font-semibold text-zinc-100">AI Composer</h2>
                    <p className="text-xs text-zinc-400">Agentic Music Studio</p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans no-scrollbar">
                {messages.map((m, i) => (
                    <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                        <div className={cn(
                            "px-4 py-3 rounded-2xl max-w-[85%] text-sm shadow-sm",
                            m.role === "user"
                                ? "bg-indigo-600 text-white shadow-indigo-500/20"
                                : "bg-zinc-800/80 text-zinc-200 border border-zinc-700/50"
                        )}>
                            {m.content}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="px-4 py-3 rounded-2xl bg-zinc-800/80 border border-zinc-700/50">
                            <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
                        </div>
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            <div className="p-4 border-t border-zinc-800/50">
                <div className="relative flex items-center">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSend()}
                        placeholder="e.g. Write a C minor chord progression"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-4 pr-12 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        className="absolute right-2 p-1.5 rounded-lg text-zinc-400 hover:text-indigo-400 hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
