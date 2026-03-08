export interface Note {
    pitch: string;
    start_time: string; // 'bars:beats:sixteenths' format
    duration: string;   // e.g. '4n'
    velocity: number;
}

export interface Track {
    id: string;
    engine: "smplr" | "tone";
    instrument: string; // e.g. 'kick', 'snare', 'acoustic_grand_piano'
    notes: Note[];
}

export interface Song {
    tempo: number;
    time_signature: [number, number];
    tracks: Track[];
}
