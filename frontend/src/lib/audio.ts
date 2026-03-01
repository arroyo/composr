import * as Tone from 'tone';
import { Song, Track, Note } from './types';

export class AudioEngine {
    private synths: Record<string, Tone.PolySynth> = {};
    private parts: Tone.Part[] = [];

    // Initializes audio context on user interaction
    async init() {
        await Tone.start();
        Tone.Transport.stop();
        Tone.Transport.cancel();
        this.cleanup();
    }

    // Parses song state and schedules all notes
    public loadSong(song: Song) {
        this.cleanup();

        // Set global tempo
        Tone.Transport.bpm.value = song.tempo;
        Tone.Transport.timeSignature = song.time_signature;

        song.tracks.forEach(track => {
            // Map JSON instrument strings to Tone classes
            const SynthClass = this.getSynthClass(track.instrument);

            const synth = new Tone.PolySynth(SynthClass as any).toDestination();
            // Add slight reverb for a premium sound feel
            const reverb = new Tone.Reverb({
                decay: 1.5,
                preDelay: 0.01,
            }).toDestination();
            synth.connect(reverb);

            this.synths[track.id] = synth;

            // Schedule notes
            const trackEvents = track.notes.map(n => ({
                time: n.start_time,
                note: n.pitch,
                duration: n.duration,
                velocity: n.velocity
            }));

            const part = new Tone.Part((time, value) => {
                synth.triggerAttackRelease(value.note, value.duration, time, value.velocity);
            }, trackEvents).start(0);

            this.parts.push(part);
        });
    }

    private getSynthClass(name: string) {
        switch (name) {
            case 'FMSynth': return Tone.FMSynth;
            case 'AMSynth': return Tone.AMSynth;
            case 'MonoSynth': return Tone.MonoSynth;
            default: return Tone.Synth;
        }
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
    }

    public isPlaying() {
        return Tone.Transport.state === 'started';
    }

    public cleanup() {
        this.parts.forEach(p => p.dispose());
        this.parts = [];
        Object.values(this.synths).forEach(s => s.dispose());
        this.synths = {};
    }
}

// Export singleton instance
export const engine = new AudioEngine();
