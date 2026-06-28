import * as Tone from "tone";

/**
 * Arpeggio preview audio.
 *
 * Plays a single-chord arpeggio through a bass-flavored voice so the user
 * can hear what they're about to drill. Distinct from the metronome
 * engine: this is a one-shot audition, not the drill itself (per
 * PROJECT-DESIGN.md §4.7, the drill itself stays silent so the user can
 * hear themselves play). v1 ships a synthesized bass-ish voice; sampled
 * upright/electric bass tones are a polish slice.
 */

class PreviewPlayer {
  private synth: Tone.MonoSynth | null = null;
  private currentPart: Tone.Part | null = null;
  private currentTransportEvent: number | null = null;

  private ensureSynth(): void {
    if (this.synth) return;
    // MonoSynth with a sawtooth + low-pass filter sweep gives a passable
    // "warm bass" character. Not a great bass — good enough to audition
    // the pattern. Polish slice can swap in a Sampler with real bass
    // samples without changing the playArpeggio API.
    this.synth = new Tone.MonoSynth({
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.005, decay: 0.18, sustain: 0.25, release: 0.25 },
      filter: { type: "lowpass", Q: 1.5, rolloff: -24 },
      filterEnvelope: {
        attack: 0.005,
        decay: 0.15,
        sustain: 0.4,
        release: 0.3,
        baseFrequency: 180,
        octaves: 2.6,
      },
      volume: -6,
    }).toDestination();
  }

  /**
   * Play the arpeggio at `bpm`, one note per beat. Interrupts any
   * preview already in flight.
   */
  async playArpeggio(midiNotes: number[], bpm: number): Promise<void> {
    if (midiNotes.length === 0) return;

    await Tone.start();
    this.ensureSynth();
    this.cancel();

    const transport = Tone.getTransport();
    transport.bpm.value = bpm;
    transport.position = 0;

    const beatSeconds = 60 / bpm;
    const events: [number, number][] = midiNotes.map((midi, i) => [
      i * beatSeconds,
      midi,
    ]);

    const part = new Tone.Part((time, midi: number) => {
      // 90% of a beat so consecutive notes don't overlap into a sustained drone.
      this.synth?.triggerAttackRelease(
        Tone.Frequency(midi, "midi").toFrequency(),
        beatSeconds * 0.9,
        time,
      );
    }, events);
    part.start(0);
    this.currentPart = part;

    // Schedule auto-stop just after the last note's release tail.
    const totalSeconds = midiNotes.length * beatSeconds + 0.5;
    this.currentTransportEvent = transport.scheduleOnce(() => {
      this.cancel();
    }, totalSeconds);

    transport.start();
  }

  /** Cancel any in-flight preview. Safe to call when nothing is playing. */
  cancel(): void {
    const transport = Tone.getTransport();
    if (this.currentPart) {
      this.currentPart.stop(0);
      this.currentPart.dispose();
      this.currentPart = null;
    }
    if (this.currentTransportEvent !== null) {
      transport.clear(this.currentTransportEvent);
      this.currentTransportEvent = null;
    }
    transport.stop();
    transport.position = 0;
    // Silence the synth instantly so a held note doesn't ring out.
    this.synth?.triggerRelease();
  }

  dispose(): void {
    this.cancel();
    this.synth?.dispose();
    this.synth = null;
  }
}

/**
 * Module-level singleton — Tone.Transport is itself a singleton, so a
 * second preview player would race the metronome engine for transport
 * state. Only one of {preview, metronome} can use the transport at a
 * time, and the preview is short-lived.
 */
export const previewPlayer = new PreviewPlayer();
