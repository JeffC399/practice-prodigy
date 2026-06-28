import * as Tone from "tone";

/**
 * Metronome engine for Practice Prodigy.
 *
 * Uses Tone.js's Transport for sample-accurate scheduling. Distinguishes
 * count-in phase from playing phase, and emits state on every beat so the UI
 * can stay perfectly in sync via Tone's Draw scheduler.
 *
 * v1-foundation slice: produces a click on each beat, with a higher pitch on
 * the downbeat (beat 1 of every measure). Future work plugs additional
 * audio (preview, reference) into the same Transport.
 */

export type MetronomePhase = "idle" | "count-in" | "playing";

export type MetronomeState = {
  phase: MetronomePhase;
  /** 1-indexed beat within the current measure (1..beatsPerMeasure). 0 when idle. */
  beatInMeasure: number;
  /** 1-indexed measure within the playing portion of the session. 0 during count-in/idle. */
  measureInSession: number;
  /** Beats of count-in still remaining (decrements after each count-in beat). 0 when not in count-in. */
  countInBeatsRemaining: number;
};

export type MetronomeConfig = {
  bpm: number;
  /** Numerator of the time signature (e.g., 4 for 4/4, 3 for 3/4). */
  beatsPerMeasure: number;
  /** Denominator of the time signature (4 = quarter-note beat, 8 = eighth-note beat). */
  beatUnit: number;
  /** Total count-in beats before the playing portion begins (0 = no count-in). */
  countInBeats: number;
  /**
   * Optional total beats of the playing portion. When this many playing beats
   * have elapsed the engine stops. Omit to loop indefinitely until stop().
   */
  totalPlayingBeats?: number;
};

export type MetronomeListener = (state: MetronomeState) => void;

const IDLE_STATE: MetronomeState = {
  phase: "idle",
  beatInMeasure: 0,
  measureInSession: 0,
  countInBeatsRemaining: 0,
};

class MetronomeEngine {
  private downbeatSynth: Tone.Synth | null = null;
  private offbeatSynth: Tone.Synth | null = null;
  private scheduledId: number | null = null;
  private listeners = new Set<MetronomeListener>();
  private state: MetronomeState = IDLE_STATE;
  private config: MetronomeConfig | null = null;
  /**
   * Monotonic beat counter. Starts at -countInBeats. Negative values =
   * count-in; non-negative values = playing. Increments once per scheduled beat.
   */
  private beatCounter = 0;

  subscribe(listener: MetronomeListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): MetronomeState {
    return this.state;
  }

  private setState(partial: Partial<MetronomeState>): void {
    this.state = { ...this.state, ...partial };
    for (const listener of this.listeners) listener(this.state);
  }

  private ensureSynths(): void {
    if (!this.downbeatSynth) {
      this.downbeatSynth = new Tone.Synth({
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.04 },
        volume: -6,
      }).toDestination();
    }
    if (!this.offbeatSynth) {
      this.offbeatSynth = new Tone.Synth({
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.03 },
        volume: -10,
      }).toDestination();
    }
  }

  private beatInMeasureFor(counter: number): number {
    if (!this.config) return 1;
    const m = this.config.beatsPerMeasure;
    const shifted = counter + this.config.countInBeats;
    return ((shifted % m) + m) % m + 1; // 1-indexed
  }

  private isDownbeatFor(counter: number): boolean {
    return this.beatInMeasureFor(counter) === 1;
  }

  async start(config: MetronomeConfig): Promise<void> {
    if (this.state.phase !== "idle") this.stop();

    // Unlock audio context on the user gesture that called start().
    await Tone.start();
    this.ensureSynths();

    this.config = config;
    this.beatCounter = -config.countInBeats - 1; // first scheduled tick increments to -countInBeats

    const transport = Tone.getTransport();
    transport.bpm.value = config.bpm;
    transport.timeSignature = [config.beatsPerMeasure, config.beatUnit];

    // Initial UI state before first tick fires.
    if (config.countInBeats > 0) {
      this.setState({
        phase: "count-in",
        beatInMeasure: 0,
        measureInSession: 0,
        countInBeatsRemaining: config.countInBeats,
      });
    } else {
      this.setState({
        phase: "playing",
        beatInMeasure: 0,
        measureInSession: 1,
        countInBeatsRemaining: 0,
      });
    }

    const beatNotation = `${config.beatUnit}n`;
    this.scheduledId = transport.scheduleRepeat((time) => {
      this.beatCounter += 1;
      const counter = this.beatCounter;
      const isDownbeat = this.isDownbeatFor(counter);

      // Audio: trigger click at the exact sample-accurate time.
      const synth = isDownbeat ? this.downbeatSynth : this.offbeatSynth;
      const pitch = isDownbeat ? "C6" : "G5";
      synth?.triggerAttackRelease(pitch, "32n", time);

      // Visual: schedule UI update tied to the same sample-accurate time.
      Tone.getDraw().schedule(() => this.advanceUiState(counter), time);

      // If we've finished the configured playing length, schedule stop AFTER this beat.
      if (
        config.totalPlayingBeats !== undefined &&
        counter >= config.totalPlayingBeats - 1
      ) {
        const oneBeatMs = (60 / config.bpm) * 1000;
        setTimeout(() => this.stop(), oneBeatMs + 80);
      }
    }, beatNotation);

    transport.start();
  }

  private advanceUiState(counter: number): void {
    if (!this.config) return;
    const beatInMeasure = this.beatInMeasureFor(counter);

    if (counter < 0) {
      this.setState({
        phase: "count-in",
        beatInMeasure,
        measureInSession: 0,
        countInBeatsRemaining: -counter,
      });
    } else {
      this.setState({
        phase: "playing",
        beatInMeasure,
        measureInSession: Math.floor(counter / this.config.beatsPerMeasure) + 1,
        countInBeatsRemaining: 0,
      });
    }
  }

  stop(): void {
    const transport = Tone.getTransport();
    if (this.scheduledId !== null) {
      transport.clear(this.scheduledId);
      this.scheduledId = null;
    }
    transport.stop();
    transport.position = 0;
    this.beatCounter = 0;
    this.config = null;
    this.setState(IDLE_STATE);
  }

  dispose(): void {
    this.stop();
    this.downbeatSynth?.dispose();
    this.downbeatSynth = null;
    this.offbeatSynth?.dispose();
    this.offbeatSynth = null;
    this.listeners.clear();
  }
}

/**
 * Singleton metronome engine. We use a module-level singleton because Tone.js's
 * Transport is itself a singleton — having multiple engines would race over
 * shared Transport state.
 */
export const metronomeEngine = new MetronomeEngine();
