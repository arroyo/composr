"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Music, ChevronDown } from "lucide-react";
import { Song, AVAILABLE_MODELS, Model } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ChatProps {
    onUpdateSong: (song: Song, skipAudioReload?: boolean) => void;
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
    const [selectedModel, setSelectedModel] = useState<Model>(AVAILABLE_MODELS[0]); // Default to GPT 4o
    const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsModelDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput("");
        setMessages(prev => [...prev, { role: "user", content: userMessage }]);
        setIsLoading(true);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000);

        try {
            const res = await fetch("http://localhost:8000/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    message: userMessage,
                    model: selectedModel.id 
                }),
                signal: controller.signal,
            });

            const data = await res.json();

            if (!res.ok) {
                const detail = data?.detail || `Error ${res.status}: ${res.statusText}`;
                setMessages(prev => [...prev, { role: "agent", content: `⚠️ ${detail}` }]);
                return;
            }

            if (data.song_state) {
                onUpdateSong(data.song_state);
            }

            setMessages(prev => [...prev, { role: "agent", content: data.response }]);
        } catch (e: unknown) {
            if (e instanceof Error && e.name === "AbortError") {
                setMessages(prev => [...prev, { role: "agent", content: `⏱ Request timed out after 30 seconds. ${selectedModel.name} may be unavailable or overloaded — try again or switch to a different model.` }]);
            } else {
                setMessages(prev => [...prev, { role: "agent", content: "⚠️ Could not reach the backend. Is the server running?" }]);
            }
        } finally {
            clearTimeout(timeoutId);
            setIsLoading(false);
        }

    };

    return (
        <div className="flex flex-col h-full bg-zinc-950/50 backdrop-blur-xl border-r border-zinc-800/50">
            <div className="p-4 border-b border-zinc-800/50">
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl">
                        <Music className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-sm font-semibold text-zinc-100">AI Composer</h2>
                        <p className="text-xs text-zinc-400">Agentic Music Studio</p>
                    </div>
                </div>
                
                {/* Model Selection Dropdown */}
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                        className="w-full flex items-center justify-between p-3 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-colors"
                    >
                        <div className="text-left flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-zinc-100">{selectedModel.name}</span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                                    selectedModel.provider === 'anthropic'
                                        ? 'bg-orange-500/20 text-orange-400'
                                        : 'bg-emerald-500/20 text-emerald-400'
                                }`}>
                                    {selectedModel.provider === 'anthropic' ? 'Anthropic' : 'OpenAI'}
                                </span>
                            </div>
                            <div className="text-xs text-zinc-500 mt-0.5 truncate">{selectedModel.description}</div>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform flex-shrink-0 ml-2 ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {isModelDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto">
                            {AVAILABLE_MODELS.map((model) => (
                                <button
                                    key={model.id}
                                    onClick={() => {
                                        setSelectedModel(model);
                                        setIsModelDropdownOpen(false);
                                    }}
                                    className={`w-full p-3 text-left hover:bg-zinc-800 transition-colors border-b border-zinc-800 last:border-b-0 ${
                                        selectedModel.id === model.id ? 'bg-zinc-800' : ''
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-zinc-100">{model.name}</span>
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                                            model.provider === 'anthropic'
                                                ? 'bg-orange-500/20 text-orange-400'
                                                : 'bg-emerald-500/20 text-emerald-400'
                                        }`}>
                                            {model.provider === 'anthropic' ? 'Anthropic' : 'OpenAI'}
                                        </span>
                                    </div>
                                    <div className="text-xs text-zinc-500 mt-0.5">{model.description}</div>
                                </button>
                            ))}
                        </div>
                    )}
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
