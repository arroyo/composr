import * as Tone from 'tone';
import { Soundfont } from 'smplr';
import { Song, Track, Note } from './types';

export class AudioEngine {
    private synths: Record<string, Soundfont> = {};
    private channels: Record<string, Tone.Channel> = {};
    private parts: Tone.Part[] = [];
    private reverb: Tone.Reverb | null = null;
    
    // User preferences
    public trackMutes: Record<string, boolean> = {};
    public trackSolos: Record<string, boolean> = {};

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
        Tone.Transport.stop();
        Tone.Transport.cancel();
        this.cleanup();

        // Set global tempo
        Tone.Transport.bpm.value = song.tempo;
        Tone.Transport.timeSignature = song.time_signature;

        let maxEndTime = 0;

        const loadPromises = song.tracks.map(async (track) => {
            // Create a channel for this track
            const channel = new Tone.Channel({
                mute: this.trackMutes[track.id] || false,
                solo: this.trackSolos[track.id] || false
            });
            this.channels[track.id] = channel;

            // Connect channel to our shared Tone.js reverb
            channel.connect(this.reverb!);

            // Create a native GainNode to act as a bridge from smplr to Tone.js
            const rawContext = Tone.getContext().rawContext as AudioContext;
            const nativeGain = rawContext.createGain();
            // In Tone js, native Web Audio nodes can connect to Tone objects seamlessly 
            Tone.connect(nativeGain as any, channel);

            // Load the soundfont dynamically based on the requested instrument
            // e.g. "acoustic_guitar_steel", "acoustic_grand_piano"
            let synth: Soundfont;
            try {
                synth = new Soundfont(rawContext, {
                    instrument: track.instrument as any,
                    destination: nativeGain
                });
                await synth.load;
            } catch (error) {
                console.warn(`Failed to load instrument "${track.instrument}", falling back to acoustic_grand_piano.`, error);
                synth = new Soundfont(rawContext, {
                    instrument: "acoustic_grand_piano" as any,
                    destination: nativeGain
                });
                await synth.load;
            }

            this.synths[track.id] = synth;

            // Calculate max end time for this track
            track.notes.forEach(n => {
                const startTime = Tone.Time(n.start_time).toSeconds();
                const duration = Tone.Time(n.duration).toSeconds();
                if (startTime + duration > maxEndTime) {
                    maxEndTime = startTime + duration;
                }
            });

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

        // Schedule automatic stop slightly after the last note ends
        if (maxEndTime > 0) {
            Tone.Transport.schedule((time) => {
                Tone.Draw.schedule(() => {
                    this.stop();
                }, time);
            }, maxEndTime + 2.0); // 2 second tail for reverb
        }
    }

    public setTrackMute(trackId: string, muted: boolean) {
        this.trackMutes[trackId] = muted;
        if (this.channels[trackId]) {
            this.channels[trackId].mute = muted;
        }
    }

    public setTrackSolo(trackId: string, solo: boolean) {
        this.trackSolos[trackId] = solo;
        if (this.channels[trackId]) {
            this.channels[trackId].solo = solo;
        }
    }

    public onPlaybackStop?: () => void;

    public play() {
        if (Tone.Transport.state !== 'started') {
            Tone.Transport.start();
        }
    }

    // Plays a single note immediately for previewing
    // We get the synth for the track, and trigger it using immediate time
    public playNote(trackId: string, pitch: string, duration: string | number = "8n", velocity: number = 0.8) {
        const synth = this.synths[trackId];
        if (!synth) {
            console.warn(`No synth found for track ${trackId} to play note`);
            return;
        }

        // Trigger note immediately
        synth.start({
            note: pitch,
            time: Tone.now(),
            duration: Tone.Time(duration).toSeconds(),
            velocity: Math.floor(velocity * 127)
        });
    }

    public pause() {
        Tone.Transport.pause();
    }

    public stop() {
        Tone.Transport.stop();
        // Stop any lingering sounds in the instruments
        Object.values(this.synths).forEach(s => s.stop());
        if (this.onPlaybackStop) {
            this.onPlaybackStop();
        }
    }

    public isPlaying() {
        return Tone.Transport.state === 'started';
    }

    public cleanup() {
        this.parts.forEach(p => p.dispose());
        this.parts = [];

        Object.values(this.channels).forEach(c => c.dispose());
        this.channels = {};

        // Optional: smplr doesn't have a rigid dispose(), but we clear references
        this.synths = {};
    }
}

// Export singleton instance
export const engine = new AudioEngine();
