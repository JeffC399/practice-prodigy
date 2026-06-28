import * as Tone from "tone";

/**
 * Arpeggio preview audio.
 *
 * Plays a single-chord arpeggio through a bass-flavored voice so the user
 * can hear what they're about to drill. Distinct from the metronome
 * engine: this is a one-shot audition, not the drill itself (per
 * PROJECT-DESIGN.md §4.7, the drill itself stays silent so the user can
 * hear themselves play). v1 ships a synthesized bass voice; sampled
 * upright/electric bass tones are a polish slice.
 */

/**
 * A small head-room before the first note so the audio engine has a
 * moment to warm up after transport.start(). Scheduling the first event
 * at transport position exactly 0 can produce a faint click or appear to
 * fire twice on some browsers; a 50 ms lead-in eliminates that.
 */
const LEAD_IN_SECONDS = 0.05;

class PreviewPlayer {
  private synth: Tone.MonoSynth | null = null;
  private scheduledEvents: number[] = [];
  private endEvent: number | null = null;

  private ensureSynth(): void {
    if (this.synth) return;
    // Smooth bass-flavored MonoSynth. A gentle filter envelope opens the
    // tone over the note's attack without the dramatic "wah" sweep that
    // a wider envelope would produce — the wah was making the first
    // note read as a click followed by the note instead of one event.
    this.synth = new Tone.MonoSynth({
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.015, decay: 0.18, sustain: 0.3, release: 0.3 },
      filter: { type: "lowpass", Q: 1, rolloff: -24 },
      filterEnvelope: {
        attack: 0.04,
        decay: 0.2,
        sustain: 0.6,
        release: 0.3,
        baseFrequency: 350,
        octaves: 1.4,
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
    // Direct transport.schedule rather than Tone.Part — one explicit
    // event per note, no Part-internal scheduling between us and the
    // synth. Easier to reason about and rules out any double-fire on
    // the time-0 event.
    for (let i = 0; i < midiNotes.length; i++) {
      const midi = midiNotes[i];
      const id = transport.schedule((time) => {
        this.synth?.triggerAttackRelease(
          Tone.Frequency(midi, "midi").toFrequency(),
          beatSeconds * 0.9,
          time,
        );
      }, LEAD_IN_SECONDS + i * beatSeconds);
      this.scheduledEvents.push(id);
    }

    // Schedule auto-stop just after the last note's release tail.
    const totalSeconds =
      LEAD_IN_SECONDS + midiNotes.length * beatSeconds + 0.5;
    this.endEvent = transport.scheduleOnce(() => {
      this.cancel();
    }, totalSeconds);

    transport.start();
  }

  /** Cancel any in-flight preview. Safe to call when nothing is playing. */
  cancel(): void {
    const transport = Tone.getTransport();
    for (const id of this.scheduledEvents) transport.clear(id);
    this.scheduledEvents = [];
    if (this.endEvent !== null) {
      transport.clear(this.endEvent);
      this.endEvent = null;
    }
    transport.stop();
    transport.position = 0;
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
