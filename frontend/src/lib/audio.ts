import * as Tone from 'tone';
import { Soundfont } from 'smplr';
import { Song, Track, Note } from './types';

export class AudioEngine {
    private synths: Record<string, Soundfont> = {};
    private parts: Tone.Part[] = [];
    private reverb: Tone.Reverb | null = null;

    // Initializes audio context on user interaction
    async init() {
        await Tone.start();
        
        if (!this.reverb) {
            this.reverb = new Tone.Reverb({
                decay: 1.5,
                preDelay: 0.01,
            }).toDestination();
        }

        Tone.Transport.stop();
        Tone.Transport.cancel();
        this.cleanup();
    }

    // Parses song state, downloads necessary soundfonts, and schedules all notes
    public async loadSong(song: Song) {
        this.cleanup();

        // Set global tempo
        Tone.Transport.bpm.value = song.tempo;
        Tone.Transport.timeSignature = song.time_signature;

        const loadPromises = song.tracks.map(async (track) => {
            // Load the soundfont dynamically based on the requested instrument
            // e.g. "acoustic_guitar_steel", "acoustic_grand_piano"
            let synth: Soundfont;
            try {
                synth = new Soundfont(Tone.getContext().rawContext as AudioContext, {
                    instrument: track.instrument as any,
                });
                await synth.load;
            } catch (error) {
                console.warn(`Failed to load instrument "${track.instrument}", falling back to acoustic_grand_piano.`, error);
                synth = new Soundfont(Tone.getContext().rawContext as AudioContext, {
                    instrument: "acoustic_grand_piano" as any,
                });
                await synth.load;
            }

            this.synths[track.id] = synth;

            // Schedule notes using Tone.js transport timing but triggering smplr
            const part = new Tone.Part((time, value) => {
                // Tone.js provides seconds (time), smplr needs seconds for triggering
                synth.start({
                    note: value.note,
                    time: time,
                    duration: Tone.Time(value.duration).toSeconds(),
                    velocity: Math.floor(value.velocity * 127), // smplr uses MIDI velocity [0-127]
                });
            }, track.notes.map(n => ({
                time: n.start_time,
                note: n.pitch,
                duration: n.duration,
                velocity: n.velocity
            }))).start(0);

            this.parts.push(part);
        });

        // Wait completely until all Soundfonts are downloaded before allowing playback
        await Promise.all(loadPromises);
    }

    public play() {
        if (Tone.Transport.state !== 'started') {
            Tone.Transport.start();
        }
    }

    public pause() {
        Tone.Transport.pause();
    }

    public stop() {
        Tone.Transport.stop();
        // Stop any lingering sounds in the instruments
        Object.values(this.synths).forEach(s => s.stop());
    }

    public isPlaying() {
        return Tone.Transport.state === 'started';
    }

    public cleanup() {
        this.parts.forEach(p => p.dispose());
        this.parts = [];
        // Optional: smplr doesn't have a rigid dispose(), but we clear references
        this.synths = {};
    }
}

// Export singleton instance
export const engine = new AudioEngine();
