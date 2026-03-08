export interface Note {
    pitch: string;
    start_time: string; // 'bars:beats:sixteenths' format
    duration: string;   // e.g. '4n'
    velocity: number;
}

export interface InstrumentState {
    engine: "smplr" | "tone";
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
    tempo: number;
    time_signature: [number, number];
    tracks: Track[];
}
