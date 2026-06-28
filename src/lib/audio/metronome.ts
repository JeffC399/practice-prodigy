import * as Tone from "tone";

/**
 * Metronome engine for Practice Prodigy.
 *
 * Uses Tone.js's Transport for sample-accurate scheduling. Distinguishes
 * count-in phase from playing phase, and emits state on every beat so the UI
 * can stay perfectly in sync via Tone's Draw scheduler.
 *
 * v1-foundation slice: produces a click on each beat. Count-in beats use a
 * dry stick-click timbre (filtered noise) so the transition into the playing
 * portion is unmistakable; playing beats use a tonal sine click with a
 * higher-pitched downbeat. Future work plugs additional audio (preview,
 * reference) into the same Transport.
 */

export type MetronomePhase = "idle" | "count-in" | "playing";

export type MetronomeState = {
  phase: MetronomePhase;
  /**
   * 1-indexed beat within the current PLAY measure (1..beatsPerMeasure).
   * 0 during idle, count-in, AND inter-chord prep beats — prep beats are
   * "outside" the measure structure so the next chord change always lands
   * on beat 1 of a new measure.
   */
  beatInMeasure: number;
  /**
   * 1-indexed PLAY measure within the playing portion of the session.
   * Doesn't advance during prep beats (they don't consume measure slots).
   * 0 during count-in/idle.
   */
  measureInSession: number;
  /** Beats of count-in still remaining (decrements after each count-in beat). 0 when not in count-in. */
  countInBeatsRemaining: number;
  /**
   * 1-indexed absolute beat within the playing portion of the session.
   * Counts BOTH play and prep beats — used by the drill UI to index into
   * the beat-level sequence. 0 during idle/count-in.
   */
  absoluteBeat: number;
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
  /**
   * Optional per-beat style override for the playing portion. Index 0 = the
   * first playing beat (counter=0). "transition" beats use the count-in
   * stick-click synth so the user can audibly tell prep beats from play
   * beats; "play" beats use the tonal playing click. Beats past the array
   * default to "play".
   */
  beatStyles?: Array<"play" | "transition">;
};

export type MetronomeListener = (state: MetronomeState) => void;

const IDLE_STATE: MetronomeState = {
  phase: "idle",
  beatInMeasure: 0,
  measureInSession: 0,
  countInBeatsRemaining: 0,
  absoluteBeat: 0,
};

class MetronomeEngine {
  private downbeatSynth: Tone.Synth | null = null;
  private offbeatSynth: Tone.Synth | null = null;
  private countInDownbeatSynth: Tone.NoiseSynth | null = null;
  private countInOffbeatSynth: Tone.NoiseSynth | null = null;
  private countInFilter: Tone.Filter | null = null;
  private scheduledId: number | null = null;
  private listeners = new Set<MetronomeListener>();
  private state: MetronomeState = IDLE_STATE;
  private config: MetronomeConfig | null = null;
  /**
   * Monotonic beat counter. Starts at -countInBeats. Negative values =
   * count-in; non-negative values = playing. Increments once per scheduled beat.
   */
  private beatCounter = 0;
  /**
   * Counter that advances ONLY on play beats (skips prep/transition beats).
   * Drives the user-visible measure / beat-in-measure so that after a prep
   * window, the next play beat is beat 1 of a new measure (regardless of
   * how many prep beats slipped in between). Starts at -1; first play beat
   * increments to 0.
   */
  private playBeatCounter = 0;

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
    if (!this.countInFilter) {
      // High-pass filtered noise yields a dry, woody "stick-click" tick —
      // distinctly un-musical compared to the tonal playing clicks. The
      // count-in is preparation, not the song; the timbre should say so.
      this.countInFilter = new Tone.Filter({
        type: "highpass",
        frequency: 3000,
        Q: 1,
      }).toDestination();
    }
    if (!this.countInDownbeatSynth) {
      this.countInDownbeatSynth = new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: 0.025, sustain: 0, release: 0.015 },
        volume: -6,
      }).connect(this.countInFilter);
    }
    if (!this.countInOffbeatSynth) {
      this.countInOffbeatSynth = new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: 0.02, sustain: 0, release: 0.012 },
        volume: -12,
      }).connect(this.countInFilter);
    }
  }

  /**
   * Beat-in-measure for COUNT-IN beats only (counter < 0). Negative
   * counter shifted by total countInBeats so the very first count-in
   * beat reads as beat 1 of a count-in measure.
   */
  private beatInMeasureForCountIn(counter: number): number {
    if (!this.config) return 1;
    const m = this.config.beatsPerMeasure;
    const shifted = counter + this.config.countInBeats;
    return ((shifted % m) + m) % m + 1;
  }

  async start(config: MetronomeConfig): Promise<void> {
    if (this.state.phase !== "idle") this.stop();

    // Unlock audio context on the user gesture that called start().
    await Tone.start();
    this.ensureSynths();

    this.config = config;
    this.beatCounter = -config.countInBeats - 1; // first scheduled tick increments to -countInBeats
    this.playBeatCounter = -1; // first play tick increments to 0

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
        absoluteBeat: 0,
      });
    } else {
      this.setState({
        phase: "playing",
        beatInMeasure: 0,
        measureInSession: 1,
        countInBeatsRemaining: 0,
        absoluteBeat: 0,
      });
    }

    const beatNotation = `${config.beatUnit}n`;
    this.scheduledId = transport.scheduleRepeat((time) => {
      this.beatCounter += 1;
      const counter = this.beatCounter;

      // Hard end-of-session boundary: as soon as the counter steps PAST the
      // configured number of playing beats, stop the engine and skip this
      // tick's click. Deferring stop via setTimeout AFTER playing the last
      // beat (previous approach) left a window for one or two more beats
      // to slip through due to Tone.js audio-callback lookahead — audio
      // events scheduled at specific sample times play even if the
      // Transport stops after they were scheduled.
      if (
        config.totalPlayingBeats !== undefined &&
        counter >= config.totalPlayingBeats
      ) {
        setTimeout(() => this.stop(), 0);
        return;
      }

      // Classify this beat.
      const isPrep =
        counter >= 0 &&
        (config.beatStyles?.[counter] ?? "play") === "transition";
      const isPlay = counter >= 0 && !isPrep;
      if (isPlay) this.playBeatCounter += 1;

      // Downbeat semantics:
      //   - count-in (counter < 0): use raw counter % beatsPerMeasure
      //     so the count-in's own first beat reads as a downbeat.
      //   - play: use playBeatCounter so the first play beat after a
      //     prep window is beat 1 of a new measure (the user explicitly
      //     wants chord changes to land on downbeats regardless of
      //     intervening prep beats).
      //   - prep: not really a measure beat — always use the softer
      //     offbeat stick-click for consistency across the prep window.
      const m = config.beatsPerMeasure;
      const isCountInDownbeat =
        counter < 0 && this.beatInMeasureForCountIn(counter) === 1;
      const isPlayDownbeat = isPlay && this.playBeatCounter % m === 0;

      // Audio: trigger click at the exact sample-accurate time.
      if (counter < 0) {
        const synth = isCountInDownbeat
          ? this.countInDownbeatSynth
          : this.countInOffbeatSynth;
        synth?.triggerAttackRelease("32n", time);
      } else if (isPrep) {
        // All prep beats use the softer offbeat stick-click — keeps the
        // prep window aurally consistent so the user can lock onto it.
        this.countInOffbeatSynth?.triggerAttackRelease("32n", time);
      } else {
        const synth = isPlayDownbeat ? this.downbeatSynth : this.offbeatSynth;
        const pitch = isPlayDownbeat ? "C6" : "G5";
        synth?.triggerAttackRelease(pitch, "32n", time);
      }

      // Visual: schedule UI update tied to the same sample-accurate time.
      // Capture the play counter snapshot for this beat so a delayed draw
      // doesn't see a stale value if subsequent beats have advanced it.
      const playBeatSnapshot = this.playBeatCounter;
      Tone.getDraw().schedule(
        () => this.advanceUiState(counter, playBeatSnapshot),
        time,
      );
    }, beatNotation);

    transport.start();
  }

  private advanceUiState(counter: number, playBeat: number): void {
    if (!this.config) return;
    if (counter < 0) {
      // Count-in beat. beatInMeasure of 0 keeps the BeatDots dim during
      // count-in (the count-in label + sticky-click sound carry the
      // signal); leaving them all dim matches the prep-beat treatment.
      this.setState({
        phase: "count-in",
        beatInMeasure: 0,
        measureInSession: 0,
        countInBeatsRemaining: -counter,
        absoluteBeat: 0,
      });
      return;
    }
    const m = this.config.beatsPerMeasure;
    const isPrep =
      (this.config.beatStyles?.[counter] ?? "play") === "transition";
    if (isPrep) {
      // Prep beat — keep measureInSession at the last-played value,
      // beatInMeasure = 0 (no active dot). The next play beat will
      // resume at beat 1 of a fresh measure.
      const measure = playBeat >= 0 ? Math.floor(playBeat / m) + 1 : 0;
      this.setState({
        phase: "playing",
        beatInMeasure: 0,
        measureInSession: measure,
        countInBeatsRemaining: 0,
        absoluteBeat: counter + 1,
      });
    } else {
      // Play beat — derived from the play-only counter so chord
      // changes always land on beat 1.
      this.setState({
        phase: "playing",
        beatInMeasure: (playBeat % m) + 1,
        measureInSession: Math.floor(playBeat / m) + 1,
        countInBeatsRemaining: 0,
        absoluteBeat: counter + 1,
      });
    }
  }

  /**
   * Update the transport BPM live. Tone.js handles the change cleanly
   * — the next scheduled tick uses the new tempo. Used by the drill
   * screen's ±5 tempo nudge so users can adjust mid-drill without
   * stopping and reopening the setup form.
   */
  setBpm(bpm: number): void {
    Tone.getTransport().bpm.value = bpm;
  }

  stop(): void {
    const transport = Tone.getTransport();
    if (this.scheduledId !== null) {
      transport.clear(this.scheduledId);
      this.scheduledId = null;
    }
    transport.stop();
    transport.position = 0;
    // Cancel any UI draw callbacks queued via Tone.getDraw().schedule that
    // haven't fired yet — without this, a stale draw can briefly bounce
    // the UI back into a non-idle state immediately after stop.
    Tone.getDraw().cancel();
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
    this.countInDownbeatSynth?.dispose();
    this.countInDownbeatSynth = null;
    this.countInOffbeatSynth?.dispose();
    this.countInOffbeatSynth = null;
    this.countInFilter?.dispose();
    this.countInFilter = null;
    this.listeners.clear();
  }
}

/**
 * Singleton metronome engine. We use a module-level singleton because Tone.js's
 * Transport is itself a singleton — having multiple engines would race over
 * shared Transport state.
 */
export const metronomeEngine = new MetronomeEngine();
