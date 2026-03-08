import * as Tone from 'tone';
import { Soundfont } from 'smplr';
import { Song, Track, Note } from './types';

// Tone.js synth instance types
type ToneSynthInstance =
    | Tone.PolySynth
    | Tone.MembraneSynth
    | Tone.MetalSynth
    | Tone.NoiseSynth;

type AnySynth = Soundfont | ToneSynthInstance;

/**
 * Maps an explicit plugin class and instrument preset to a configured
 * Tone.js synthesizer connected to the given channel.
 */
function createToneSynth(plugin: string, preset: string, channel: Tone.Channel): ToneSynthInstance {
    const name = preset.toLowerCase();

    switch (plugin) {
        case 'MembraneSynth':
            return new Tone.MembraneSynth({
                pitchDecay: 0.08,
                octaves: name.includes('808') ? 6 : 4,
                envelope: { attack: 0.001, decay: name.includes('808') ? 1.0 : 0.35, sustain: 0, release: 0.15 },
            }).connect(channel);

        case 'NoiseSynth':
            return new Tone.NoiseSynth({
                noise: { type: 'white' },
                envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 },
            }).connect(channel);

        case 'MetalSynth':
            const metalSynth = new Tone.MetalSynth({
                envelope: { attack: 0.001, decay: 0.1, release: 0.1 },
                harmonicity: 5.1,
                modulationIndex: 32,
                resonance: 4000,
                octaves: 1.5,
            }).connect(channel);
            metalSynth.frequency.value = 400;
            return metalSynth;

        case 'FMSynth':
            return new Tone.PolySynth(Tone.FMSynth, {
                harmonicity: 3,
                modulationIndex: 10,
                envelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.8 },
                modulation: { type: 'square' },
                modulationEnvelope: { attack: 0.2, decay: 0.01, sustain: 1, release: 0.5 },
            }).connect(channel);

        case 'AMSynth':
            return new Tone.PolySynth(Tone.AMSynth, {
                harmonicity: 2,
                envelope: { attack: 0.05, decay: 0.1, sustain: 0.7, release: 1.0 },
                modulation: { type: 'sine' },
                modulationEnvelope: { attack: 0.5, decay: 0, sustain: 1, release: 0.5 },
            }).connect(channel);

        case 'PolySynth':
        default:
            return new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: 'sawtooth' },
                envelope: { attack: 0.005, decay: 0.1, sustain: 0.6, release: 0.4 },
            }).connect(channel);
    }
}

/**
 * Trigger a note on any Tone.js synth, handling mono vs poly vs noise correctly.
 */
function triggerToneNote(
    synth: ToneSynthInstance,
    pitch: string,
    durationSecs: number,
    time: number,
    velocity: number
) {
    if (synth instanceof Tone.NoiseSynth) {
        synth.triggerAttackRelease(durationSecs, time, velocity);
    } else if (synth instanceof Tone.MembraneSynth || synth instanceof Tone.MetalSynth) {
        synth.triggerAttackRelease(pitch, durationSecs, time, velocity);
    } else {
        (synth as Tone.PolySynth).triggerAttackRelease(pitch, durationSecs, time, velocity);
    }
}

function isToneSynth(s: AnySynth): s is ToneSynthInstance {
    return (
        s instanceof Tone.PolySynth ||
        s instanceof Tone.MembraneSynth ||
        s instanceof Tone.MetalSynth ||
        s instanceof Tone.NoiseSynth
    );
}

export class AudioEngine {
    private synths: Record<string, AnySynth> = {};
    private channels: Record<string, Tone.Channel> = {};
    private parts: Tone.Part[] = [];
    private reverb: Tone.Reverb | null = null;

    public trackMutes: Record<string, boolean> = {};
    public trackSolos: Record<string, boolean> = {};

    async init() {
        await Tone.start();

        if (!this.reverb) {
            this.reverb = new Tone.Reverb({ decay: 1.5, preDelay: 0.01 }).toDestination();
        }

        Tone.Transport.stop();
        Tone.Transport.cancel();
        this.cleanup();
    }

    public async loadSong(song: Song) {
        Tone.Transport.stop();
        Tone.Transport.cancel();
        this.cleanup();

        Tone.Transport.bpm.value = song.tempo;
        Tone.Transport.timeSignature = song.time_signature;

        let maxEndTime = 0;

        const loadPromises = song.tracks.map(async (track) => {
            // Create mixing channel
            const channel = new Tone.Channel({
                mute: this.trackMutes[track.id] || false,
                solo: this.trackSolos[track.id] || false,
            });
            this.channels[track.id] = channel;
            channel.connect(this.reverb!);

            // Calculate max end time
            track.notes.forEach(n => {
                const startTime = Tone.Time(n.start_time).toSeconds();
                const duration = Tone.Time(n.duration).toSeconds();
                if (startTime + duration > maxEndTime) maxEndTime = startTime + duration;
            });

            // Determine audio engine: explicit field > infer from instrument name
            const electronicKeywords = ['kick', '808', 'snare', 'clap', 'hihat', 'hi_hat',
                'cymbal', 'crash', 'ride', 'synth', 'pad', 'arp', 'lead',
                'bass_synth', 'fm_bass', 'fm_', 'am_', 'lead_synth', 'acid'];
            
            // Acoustic drums that might incorrectly trigger electronic if 'drum' was in the array above
            const acousticKeywords = ['taiko_drum', 'synth_drum', 'woodblock', 'reverse_cymbal', 'melodic_tom', 'steel_drums'];

            const instrumentLower = (track.instrument.preset || '').toLowerCase();
            
            // Explicit engine setting takes precedence. 
            // If missing, look for acoustic exact matches, otherwise check electronic keywords.
            let useElectronic = false;
            // Support legacy save files that might have `engine` at the top level
            const trackEngine = track.instrument.engine || (track as any).engine;
            
            if (trackEngine === 'tone') {
                useElectronic = true;
            } else if (trackEngine === 'smplr') {
                useElectronic = false;
            } else if (acousticKeywords.some(kw => instrumentLower.includes(kw))) {
                useElectronic = false;
            } else if (instrumentLower.startsWith('tone:') || electronicKeywords.some(kw => instrumentLower.includes(kw))) {
                useElectronic = true;
            }

            if (useElectronic) {
                console.log(`[AudioEngine] "${track.id}" → Tone.js (${track.instrument.plugin}:${track.instrument.preset})`);

                const synth = createToneSynth(track.instrument.plugin, track.instrument.preset, channel);
                this.synths[track.id] = synth;

                const isMonoSynth = synth instanceof Tone.MembraneSynth || 
                                    synth instanceof Tone.MetalSynth || 
                                    synth instanceof Tone.NoiseSynth;

                let mappedEvents = track.notes.map(n => ({
                    time: n.start_time,
                    note: n.pitch,
                    duration: n.duration,
                    velocity: n.velocity,
                }));

                // Prevent Tone.js crash: Monophonic synths cannot schedule multiple notes at the exact same time
                if (isMonoSynth) {
                    const seenTimes = new Set<string>();
                    mappedEvents = mappedEvents.filter(e => {
                        if (seenTimes.has(e.time)) return false;
                        seenTimes.add(e.time);
                        return true;
                    });
                }

                const part = new Tone.Part((time, value) => {
                    const durationSecs = Tone.Time(value.duration).toSeconds();
                    triggerToneNote(synth, value.note, durationSecs, time, value.velocity);
                }, mappedEvents).start(0);

                this.parts.push(part);

            } else {
                console.log(`[AudioEngine] "${track.id}" → smplr (${track.instrument.plugin}:${track.instrument.preset})`);

                const rawContext = Tone.getContext().rawContext as AudioContext;
                const nativeGain = rawContext.createGain();
                Tone.connect(nativeGain as any, channel);

                let synth: any; // Soundfont | DrumMachine | SplendidGrandPiano
                const SmplrPluginClass = (window as any).smplr?.[track.instrument.plugin] || Soundfont;

                try {
                    synth = new SmplrPluginClass(rawContext, {
                        instrument: track.instrument.preset as any,
                        destination: nativeGain,
                    });
                    await synth.load;
                } catch (error) {
                    console.warn(`Failed to load smplr plugin "${track.instrument.plugin}" with preset "${track.instrument.preset}", falling back to Soundfont acoustic_grand_piano.`, error);
                    synth = new Soundfont(rawContext, {
                        instrument: 'acoustic_grand_piano' as any,
                        destination: nativeGain,
                    });
                    await synth.load;
                }

                this.synths[track.id] = synth;

                const part = new Tone.Part((time, value) => {
                    (synth as Soundfont).start({
                        note: value.note,
                        time,
                        duration: Tone.Time(value.duration).toSeconds(),
                        velocity: Math.floor(value.velocity * 127),
                    });
                }, track.notes.map(n => ({
                    time: n.start_time,
                    note: n.pitch,
                    duration: n.duration,
                    velocity: n.velocity,
                }))).start(0);

                this.parts.push(part);
            }
        });

        await Promise.all(loadPromises);

        if (maxEndTime > 0) {
            Tone.Transport.schedule((time) => {
                Tone.Draw.schedule(() => { this.stop(); }, time);
            }, maxEndTime + 2.0);
        }
    }

    public setTrackMute(trackId: string, muted: boolean) {
        this.trackMutes[trackId] = muted;
        if (this.channels[trackId]) this.channels[trackId].mute = muted;
    }

    public setTrackSolo(trackId: string, solo: boolean) {
        this.trackSolos[trackId] = solo;
        if (this.channels[trackId]) this.channels[trackId].solo = solo;
    }

    public onPlaybackStop?: () => void;

    public play() {
        if (Tone.Transport.state !== 'started') Tone.Transport.start();
    }

    public playNote(trackId: string, pitch: string, duration: string | number = '8n', velocity: number = 0.8) {
        const synth = this.synths[trackId];
        if (!synth) {
            console.warn(`No synth for track "${trackId}"`);
            return;
        }

        if (isToneSynth(synth)) {
            const durationSecs = Tone.Time(duration).toSeconds();
            triggerToneNote(synth, pitch, durationSecs, Tone.now(), velocity);
        } else {
            (synth as Soundfont).start({
                note: pitch,
                time: Tone.now(),
                duration: Tone.Time(duration).toSeconds(),
                velocity: Math.floor(velocity * 127),
            });
        }
    }

    public pause() {
        Tone.Transport.pause();
    }

    public stop() {
        Tone.Transport.stop();
        Object.values(this.synths).forEach(s => {
            if (isToneSynth(s)) {
                (s as Tone.PolySynth).releaseAll?.();
            } else {
                (s as Soundfont).stop();
            }
        });
        if (this.onPlaybackStop) this.onPlaybackStop();
    }

    public isPlaying() {
        return Tone.Transport.state === 'started';
    }

    public cleanup() {
        this.parts.forEach(p => p.dispose());
        this.parts = [];

        Object.values(this.synths).forEach(s => {
            if (isToneSynth(s)) s.dispose();
        });
        this.synths = {};

        Object.values(this.channels).forEach(c => c.dispose());
        this.channels = {};
    }
}

export const engine = new AudioEngine();
