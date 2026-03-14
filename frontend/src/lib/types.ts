export interface Note {
    pitch: string;
    start_time: string; // 'bars:beats:sixteenths' format
    duration: string;   // e.g. '4n'
    velocity: number;
}

export interface InstrumentState {
    engine: "smplr" | "tonejs";
    plugin: string;
    bank: string;
    preset: string;
}

export interface Track {
    id: string;
    instrument: InstrumentState;
    notes: Note[];
    volume?: number;
    pan?: number;
}

export interface Song {
    name?: string;
    tempo: number;
    time_signature: [number, number];
    tracks: Track[];
}

export interface Model {
    id: string;
    name: string;
    description: string;
    provider: "openai" | "anthropic";
}

export const AVAILABLE_MODELS: Model[] = [
    {
        id: "gpt-5.4",
        name: "GPT 5.4",
        description: "Advanced reasoning and deep-thinking specialist (~9s)",
        provider: "openai"
    },
    {
        id: "gpt-4.1",
        name: "GPT 4.1",
        description: "Enhanced reasoning model (~2s)",
        provider: "openai"
    },
    {
        id: "gpt-4o",
        name: "GPT 4o",
        description: "Standard high-performance multimodal model (~1s)",
        provider: "openai"
    },
    {
        id: "claude-opus-4-6",
        name: "Claude Opus 4.6",
        description: "Anthropic's most intelligent and nuanced model (~5s)",
        provider: "anthropic"
    },
    {
        id: "claude-sonnet-4-6",
        name: "Claude Sonnet 4.6",
        description: "Balanced speed and intelligence for creative work (~24s)",
        provider: "anthropic"
    },
    {
        id: "claude-haiku-4-5",
        name: "Claude Haiku 4.5",
        description: "Ultra-fast response model for rapid composition (~3s)",
        provider: "anthropic"
    }
];
