import * as Tone from "tone";

/**
 * Standalone metronome audio engine.
 *
 * Deliberately separate from the drill metronome (src/lib/audio/metronome.ts)
 * — the drill engine is coupled to count-in / play / transition beat
 * semantics that the standalone metronome doesn't need. Sharing audio
 * across both would mean a refactor we don't want to take on now;
 * duplication is cheaper for this slice.
 *
 * Capabilities (Phase 21 v0.1):
 *  - BPM 30..300
 *  - Time signature (any beatsPerMeasure)
 *  - Subdivisions per beat (1 / 2 / 3 / 4)
 *  - Per-beat accent state (normal | accent | mute)
 *  - 4 sound presets (tonal click, wood block, electronic, stick)
 *  - Polyrhythm: optional secondary pulse at a different rate
 *  - Tempo ramping: gradually increase BPM over N measures, looping
 *  - Beat dropping: every Nth measure goes silent (ear training)
 *
 * State callbacks let the UI render per-beat indicators in sync with
 * the audio.
 */

export const METRONOME_SOUNDS = [
  "tonal",
  "wood",
  "electronic",
  "stick",
] as const;
export type MetronomeSound = (typeof METRONOME_SOUNDS)[number];

export const METRONOME_SOUND_LABELS: Record<MetronomeSound, string> = {
  tonal: "Tonal click",
  wood: "Wood block",
  electronic: "Electronic",
  stick: "Stick / rim",
};

export type BeatAccent = "normal" | "accent" | "mute";

export type MetronomeConfig = {
  bpm: number;
  beatsPerMeasure: number;
  beatUnit: number;
  /** Notes per beat for the subdivision layer (1 = no sub, 2 = 8ths over qtr, 3 = triplets, 4 = 16ths). */
  subdivisionsPerBeat: 1 | 2 | 3 | 4;
  /** Per-beat accent state, length = beatsPerMeasure. */
  accentPattern: BeatAccent[];
  sound: MetronomeSound;
  /** 0..1 master volume. */
  volume: number;
  /** Optional polyrhythm: a secondary pulse at a different rate. */
  polyrhythm: {
    enabled: boolean;
    /** Hits per measure for the secondary pulse. 2..9 typical. */
    hitsPerMeasure: number;
    sound: MetronomeSound;
  };
  /** Optional tempo ramp: gradually increase BPM over N measures, then loop. */
  tempoRamp: {
    enabled: boolean;
    startBpm: number;
    endBpm: number;
    overMeasures: number;
  };
  /** Beat dropping: every Nth measure goes silent. 0 = disabled. */
  dropEveryNthMeasure: number;
};

export type MetronomeState = {
  isPlaying: boolean;
  /** Current beat within the current measure (1-indexed). */
  currentBeat: number;
  /** Current measure (1-indexed) since start. */
  currentMeasure: number;
  /** Live BPM (mid-ramp this may differ from config.bpm). */
  liveBpm: number;
  /** True if the current measure is being dropped (silent). */
  isDroppedMeasure: boolean;
};

type StateListener = (state: MetronomeState) => void;

class StandaloneMetronomeEngine {
  private synths: Partial<Record<MetronomeSound, SoundVoices>> = {};
  private masterVolume: Tone.Volume | null = null;
  private mainEventId: number | null = null;
  private polyEventId: number | null = null;
  private config: MetronomeConfig | null = null;
  private state: MetronomeState = {
    isPlaying: false,
    currentBeat: 0,
    currentMeasure: 0,
    liveBpm: 0,
    isDroppedMeasure: false,
  };
  private listeners = new Set<StateListener>();

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    for (const l of this.listeners) l(this.state);
  }

  private ensureSetup(): void {
    if (this.masterVolume) return;
    this.masterVolume = new Tone.Volume(0).toDestination();
  }

  private getSynth(sound: MetronomeSound): SoundVoices {
    if (!this.synths[sound]) {
      this.synths[sound] = makeSoundVoices(sound, this.masterVolume!);
    }
    return this.synths[sound]!;
  }

  async start(config: MetronomeConfig): Promise<void> {
    await Tone.start();
    this.ensureSetup();
    this.stop(); // tear down any previous run

    this.config = { ...config };
    this.applyVolume(config.volume);

    const transport = Tone.getTransport();
    transport.position = 0;
    const initialBpm = config.tempoRamp.enabled
      ? config.tempoRamp.startBpm
      : config.bpm;
    transport.bpm.value = initialBpm;

    // Pre-warm each sound's voices.
    this.getSynth(config.sound);
    if (config.polyrhythm.enabled) this.getSynth(config.polyrhythm.sound);

    // Primary pulse: schedule a callback at the subdivision rate so we
    // can hit sub-beats. The callback decides which beat/sub-beat we
    // are on based on accumulated transport position.
    const subInterval = `${4 * config.subdivisionsPerBeat}n`; // e.g. "4n" qtr, "8n" 8th, "16n" 16th
    // Triplets: there's no clean "12n" Tone notation; we use "8t" (eighth triplet).
    const intervalForSub =
      config.subdivisionsPerBeat === 3 ? "8t" : subInterval;

    let subCounter = 0;
    this.mainEventId = transport.scheduleRepeat((time) => {
      if (!this.config) return;
      const subIdx = subCounter % this.config.subdivisionsPerBeat;
      const beatIdx = Math.floor(
        subCounter / this.config.subdivisionsPerBeat,
      ) % this.config.beatsPerMeasure;
      const measureIdx =
        Math.floor(
          subCounter /
            (this.config.subdivisionsPerBeat * this.config.beatsPerMeasure),
        );
      const isMeasureDownbeat = subIdx === 0 && beatIdx === 0;

      // Beat-drop check (only on downbeats, evaluated per measure).
      const isDropped =
        this.config.dropEveryNthMeasure > 0 &&
        measureIdx > 0 &&
        (measureIdx + 1) % this.config.dropEveryNthMeasure === 0;

      const accentForBeat = this.config.accentPattern[beatIdx] ?? "normal";

      // Schedule audio if not muted / dropped.
      if (!isDropped && accentForBeat !== "mute") {
        const isSubBeat = subIdx !== 0;
        const voice = this.getSynth(this.config.sound);
        const intensity: ClickIntensity = isSubBeat
          ? "sub"
          : accentForBeat === "accent" || beatIdx === 0
            ? "accent"
            : "normal";
        voice.trigger(time, intensity);
      }

      // Update React-visible state on actual beats (not sub-beats).
      if (subIdx === 0) {
        Tone.getDraw().schedule(() => {
          this.state = {
            ...this.state,
            currentBeat: beatIdx + 1,
            currentMeasure: measureIdx + 1,
            isDroppedMeasure: isDropped,
            liveBpm: Math.round(transport.bpm.value),
          };
          this.emit();
        }, time);
      }

      // Tempo ramp: bump BPM at the start of each new measure.
      if (isMeasureDownbeat && this.config.tempoRamp.enabled) {
        const ramp = this.config.tempoRamp;
        const cycleMeasure = measureIdx % ramp.overMeasures;
        const t = ramp.overMeasures <= 1 ? 1 : cycleMeasure / (ramp.overMeasures - 1);
        const target = ramp.startBpm + (ramp.endBpm - ramp.startBpm) * t;
        transport.bpm.rampTo(target, 0.05);
      }

      subCounter++;
    }, intervalForSub);

    // Polyrhythm: secondary pulse at hitsPerMeasure rate.
    if (config.polyrhythm.enabled && config.polyrhythm.hitsPerMeasure > 0) {
      const polyInterval = `${config.polyrhythm.hitsPerMeasure}n`;
      // For non-standard hit counts (e.g. 5, 7), we approximate via
      // measure-relative scheduling: divide measure length by hits.
      const measureSeconds =
        (60 / initialBpm) * config.beatsPerMeasure * (4 / config.beatUnit);
      const hitSeconds = measureSeconds / config.polyrhythm.hitsPerMeasure;

      let polyCounter = 0;
      this.polyEventId = transport.scheduleRepeat(
        (time) => {
          if (!this.config?.polyrhythm.enabled) return;
          const voice = this.getSynth(this.config.polyrhythm.sound);
          const isFirst =
            polyCounter % this.config.polyrhythm.hitsPerMeasure === 0;
          voice.trigger(time, isFirst ? "accent" : "sub");
          polyCounter++;
        },
        hitSeconds,
      );
      // Note: with tempo ramping, the polyrhythm grid won't auto-rescale;
      // documented limitation. The simple poly interval is computed once
      // at start. Acceptable v0.1 behavior — tempo ramping + polyrhythm
      // together is an unusual combo.
      void polyInterval;
    }

    this.state = {
      isPlaying: true,
      currentBeat: 0,
      currentMeasure: 0,
      liveBpm: initialBpm,
      isDroppedMeasure: false,
    };
    this.emit();
    transport.start();
  }

  stop(): void {
    const transport = Tone.getTransport();
    if (this.mainEventId !== null) {
      transport.clear(this.mainEventId);
      this.mainEventId = null;
    }
    if (this.polyEventId !== null) {
      transport.clear(this.polyEventId);
      this.polyEventId = null;
    }
    transport.stop();
    transport.position = 0;
    this.state = {
      ...this.state,
      isPlaying: false,
      currentBeat: 0,
      currentMeasure: 0,
      isDroppedMeasure: false,
    };
    this.emit();
  }

  /**
   * Live update of BPM (call while playing or stopped). When playing,
   * the next beat picks up the new tempo via transport.bpm.rampTo.
   */
  setBpm(bpm: number): void {
    if (this.config) this.config.bpm = bpm;
    const transport = Tone.getTransport();
    transport.bpm.rampTo(bpm, 0.05);
    if (this.state.isPlaying) {
      this.state = { ...this.state, liveBpm: bpm };
      this.emit();
    }
  }

  setVolume(volume: number): void {
    if (this.config) this.config.volume = volume;
    this.applyVolume(volume);
  }

  private applyVolume(volume: number): void {
    if (!this.masterVolume) return;
    // Convert linear 0..1 to dB. 0 = mute (-Infinity dB), 1 = 0 dB.
    const db = volume <= 0 ? -Infinity : 20 * Math.log10(volume);
    this.masterVolume.volume.rampTo(db, 0.05);
  }

  /** Tear down everything — call on hot-reload / dev cleanup if needed. */
  dispose(): void {
    this.stop();
    for (const key of METRONOME_SOUNDS) {
      this.synths[key]?.dispose();
    }
    this.synths = {};
    this.masterVolume?.dispose();
    this.masterVolume = null;
  }
}

type ClickIntensity = "accent" | "normal" | "sub";

type SoundVoices = {
  trigger: (time: number, intensity: ClickIntensity) => void;
  dispose: () => void;
};

/**
 * Per-sound loudness trim in dB. Calibrated by ear. Electronic is
 * the only sound that was at the right level after the previous
 * pass; the others got further boosts so they match.
 */
const SOUND_VOLUME_DB: Record<MetronomeSound, number> = {
  tonal: 14, // Bumped +8 → +14; also swapped MonoSynth → Synth to drop the filter chain
  wood: 12,
  electronic: -4, // Reference, unchanged
  stick: -2,
};

/**
 * Build the synth voices for a given sound preset. Each preset uses a
 * different synth flavor; intensity (accent / normal / sub) controls
 * pitch + velocity so the listener can hear which beat is which.
 * Loudness across the four presets is normalized via SOUND_VOLUME_DB.
 */
function makeSoundVoices(
  sound: MetronomeSound,
  destination: Tone.Volume,
): SoundVoices {
  switch (sound) {
    case "tonal": {
      // Pitched click via plain Synth burst. Switched away from
      // MonoSynth because its built-in filter chain (Oscillator →
      // AmpEnv → Filter → FilterEnv) was quietly cutting brightness
      // even at higher dB — at the very short 50ms decay the filter
      // wasn't fully opening before it closed again. Plain Synth is
      // just Oscillator → AmpEnv → output. Triangle wave for tonal
      // character; full velocity on the accent + pitch jump
      // (G5 → C7, a full octave + a fourth) makes the downbeat
      // unmissable.
      const synth = new Tone.Synth({
        oscillator: { type: "triangle" },
        envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.05 },
        volume: SOUND_VOLUME_DB.tonal,
      }).connect(destination);
      return {
        trigger: (time, intensity) => {
          if (intensity === "accent") {
            synth.triggerAttackRelease("C7", "32n", time, 1.0);
          } else if (intensity === "sub") {
            synth.triggerAttackRelease("E5", "32n", time, 0.4);
          } else {
            synth.triggerAttackRelease("G5", "32n", time, 0.6);
          }
        },
        dispose: () => synth.dispose(),
      };
    }
    case "wood": {
      // Wood block via MembraneSynth + bandpass filter. The previous
      // narrow Q=8 was choking most of the signal — wider Q (2) lets
      // more of the membrane synth's body through while still
      // shaping it into a wood-like timbre. Centered higher (1200 Hz)
      // for better cut through the mix.
      const filter = new Tone.Filter(1200, "bandpass", -12).connect(destination);
      filter.Q.value = 2;
      const synth = new Tone.MembraneSynth({
        pitchDecay: 0.005,
        octaves: 2,
        envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.02 },
        volume: SOUND_VOLUME_DB.wood,
      }).connect(filter);
      return {
        trigger: (time, intensity) => {
          const freq =
            intensity === "accent"
              ? "G4"
              : intensity === "sub"
                ? "C4"
                : "E4";
          synth.triggerAttackRelease(freq, "32n", time);
        },
        dispose: () => {
          synth.dispose();
          filter.dispose();
        },
      };
    }
    case "electronic": {
      // Pure sine pulse — modern electronic metronome flavor. Sine
      // waves are the QUIETEST perceptually because they have no
      // harmonic content, so this gets the loudest trim setting.
      const synth = new Tone.Synth({
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
        volume: SOUND_VOLUME_DB.electronic,
      }).connect(destination);
      return {
        trigger: (time, intensity) => {
          const freq =
            intensity === "accent"
              ? "A6"
              : intensity === "sub"
                ? "A4"
                : "A5";
          synth.triggerAttackRelease(freq, "32n", time);
        },
        dispose: () => synth.dispose(),
      };
    }
    case "stick": {
      // Two-voice stick / rim:
      //   STICK (normal beat) = bright filtered-noise click — short,
      //   dry, sharp. Sounds like a stick hit on a drum head.
      //   RIM (accent beat)   = lower-filtered noise burst PLUS a
      //   short pitched "tock" — a quick sine burst at 900 Hz with
      //   ultra-short envelope (decay 0.015s) so the pitched
      //   element decays completely before the next beat lands.
      //   The previous MetalSynth had a 170ms tail that bled into
      //   beat 2 and colored it differently from beats 3 + 4.
      //   SUB-BEAT            = very bright, very short noise burst —
      //   spitty / quiet so it doesn't compete with the main beats.
      const filter = new Tone.Filter(3000, "highpass").connect(destination);
      const noise = new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: 0.03, sustain: 0 },
        volume: SOUND_VOLUME_DB.stick,
      }).connect(filter);
      // Pitched "tock" for rim-shot accents — extremely short
      // envelope so the next beat starts on a clean slate.
      const tock = new Tone.Synth({
        oscillator: { type: "sine" },
        envelope: {
          attack: 0.0005,
          decay: 0.015,
          sustain: 0,
          release: 0.01,
        },
        volume: SOUND_VOLUME_DB.stick - 2,
      }).connect(destination);
      return {
        trigger: (time, intensity) => {
          if (intensity === "accent") {
            // RIM: low-mid filtered noise + quick pitched tock
            filter.frequency.value = 1500;
            noise.triggerAttackRelease("16n", time);
            tock.triggerAttackRelease("A4", "64n", time, 1.0);
          } else if (intensity === "sub") {
            // SUB: thin, spitty
            filter.frequency.value = 5000;
            noise.triggerAttackRelease("64n", time);
          } else {
            // STICK: bright, dry, mid-range click — no pitched element
            filter.frequency.value = 3500;
            noise.triggerAttackRelease("32n", time);
          }
        },
        dispose: () => {
          noise.dispose();
          filter.dispose();
          tock.dispose();
        },
      };
    }
  }
}

/**
 * Module-level singleton — Tone.Transport is a singleton, so the
 * metronome engine and other audio surfaces (drill metronome, preview
 * player) must coordinate. The standalone metronome owns the
 * transport while it's playing; calling start() here stops anything
 * else that was using transport (a drill or a preview).
 */
export const standaloneMetronome = new StandaloneMetronomeEngine();

/** Default config for a fresh metronome session. */
export const DEFAULT_METRONOME_CONFIG: MetronomeConfig = {
  bpm: 90,
  beatsPerMeasure: 4,
  beatUnit: 4,
  subdivisionsPerBeat: 1,
  accentPattern: ["accent", "normal", "normal", "normal"],
  sound: "tonal",
  volume: 0.75,
  polyrhythm: {
    enabled: false,
    hitsPerMeasure: 3,
    sound: "wood",
  },
  tempoRamp: {
    enabled: false,
    startBpm: 60,
    endBpm: 120,
    overMeasures: 8,
  },
  dropEveryNthMeasure: 0,
};
