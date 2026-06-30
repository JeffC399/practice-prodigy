import * as Tone from "tone";
import { CHORD_INTERVALS } from "@/lib/music/intervals";
import { type Chord, type PitchClass } from "@/lib/music/chord";
import type {
  ChordBeat,
  MelodyDuration,
  MelodyNote,
  Sheet,
} from "@/lib/sheets/types";
import { MELODY_DURATION_BEATS } from "@/lib/sheets/types";

/**
 * Phase 27 — Lead-sheet live audio playback.
 *
 * Plays a Sheet aloud through two synth voices:
 *   - Chord comping: a PolySynth holds each ChordBeat for the
 *     duration until the next chord change (or end of sheet).
 *     Voiced in the bass-baritone range (root from C3) so it sits
 *     below the melody.
 *   - Melody: a MonoSynth plays each MelodyNote at its computed
 *     start beat for its computed duration (whole/half/.../dotted).
 *     Rests advance the clock without scheduling audio.
 *
 * One global Tone.Transport. Stops cleanly via .stop(). Per the
 * existing preview engine pattern, only one of {sheetPlayback,
 * preview, drillMetronome, standaloneMetronome} can own the
 * transport at a time. The editor's Play button cancels any
 * sibling engine before starting.
 */

const LEAD_IN_SECONDS = 0.1;
/** Default chord octave when none is implied. */
const CHORD_OCTAVE = 3;

const LETTER_TO_SEMITONE: Record<string, number> = {
  c: 0,
  d: 2,
  e: 4,
  f: 5,
  g: 7,
  a: 9,
  b: 11,
};

const PITCH_CLASS_TO_SEMITONE: Record<PitchClass, number> = {
  C: 0,
  "C#": 1,
  D: 2,
  "D#": 3,
  E: 4,
  F: 5,
  "F#": 6,
  G: 7,
  "G#": 8,
  A: 9,
  "A#": 10,
  B: 11,
};

/**
 * Convert a VexFlow-style pitch string ("c/4", "f#/5", "bb/3") to
 * an absolute MIDI note number. Returns null on unparseable input.
 */
export function vexPitchToMidi(pitch: string): number | null {
  const slash = pitch.indexOf("/");
  if (slash < 0) return null;
  const letter = pitch[0]?.toLowerCase();
  const accidental = pitch[1];
  const octaveStr = pitch.slice(slash + 1);
  const octave = parseInt(octaveStr, 10);
  if (!letter || Number.isNaN(octave)) return null;
  const base = LETTER_TO_SEMITONE[letter];
  if (base === undefined) return null;
  let semitone = base;
  if (accidental === "#") semitone += 1;
  else if (accidental === "b") semitone -= 1;
  return 12 * (octave + 1) + semitone;
}

/** Expand a Chord to its block-voicing MIDI notes at the given octave. */
export function chordToMidiNotes(
  chord: Chord,
  octave: number = CHORD_OCTAVE,
  bass?: PitchClass,
): number[] {
  const rootMidi = 12 * (octave + 1) + PITCH_CLASS_TO_SEMITONE[chord.root];
  const intervals = CHORD_INTERVALS[chord.quality];
  const notes = intervals.map((iv) => rootMidi + iv);
  if (bass) {
    // Slash chord: add a bass note one octave below the chord's root.
    const bassMidi =
      12 * octave + PITCH_CLASS_TO_SEMITONE[bass];
    return [bassMidi, ...notes];
  }
  return notes;
}

/** Beats for a duration token, with optional dotted modifier. */
function beatsForDuration(
  duration: MelodyDuration,
  dotted?: boolean,
): number {
  const base = MELODY_DURATION_BEATS[duration] ?? 1;
  return dotted ? base * 1.5 : base;
}

class SheetPlayback {
  private chordSynth: Tone.PolySynth | null = null;
  private melodySynth: Tone.MonoSynth | null = null;
  private scheduledEvents: number[] = [];
  private endEvent: number | null = null;
  private endCallback: (() => void) | null = null;
  private _isPlaying = false;

  private ensureSynths(): void {
    if (!this.chordSynth) {
      // Soft electric-piano-ish PolySynth for chord comping. Mellow so
      // it doesn't overpower the melody.
      this.chordSynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: {
          attack: 0.02,
          decay: 0.4,
          sustain: 0.5,
          release: 0.6,
        },
        volume: -14,
      }).toDestination();
    }
    if (!this.melodySynth) {
      // Brighter MonoSynth for the melody line so it cuts through.
      this.melodySynth = new Tone.MonoSynth({
        oscillator: { type: "sawtooth" },
        envelope: {
          attack: 0.01,
          decay: 0.15,
          sustain: 0.3,
          release: 0.25,
        },
        filter: { type: "lowpass", Q: 1, rolloff: -24 },
        filterEnvelope: {
          attack: 0.02,
          decay: 0.15,
          sustain: 0.5,
          release: 0.25,
          baseFrequency: 600,
          octaves: 1.6,
        },
        volume: -10,
      }).toDestination();
    }
  }

  isPlaying(): boolean {
    return this._isPlaying;
  }

  /**
   * Play the sheet end-to-end. Cancels any in-flight playback first.
   * Optional `bpmOverride` lets the caller play at a different tempo
   * than `sheet.bpm` (e.g. half-tempo practice mode).
   */
  async play(
    sheet: Sheet,
    options?: { bpmOverride?: number; onEnded?: () => void },
  ): Promise<void> {
    await Tone.start();
    this.ensureSynths();
    this.cancel();

    const bpm = options?.bpmOverride ?? sheet.bpm ?? 120;
    const transport = Tone.getTransport();
    transport.bpm.value = bpm;
    transport.position = 0;

    const beatSeconds = 60 / bpm;
    const beatsPerMeasure = sheet.timeSignature.beatsPerMeasure;
    const totalMeasureBeats = sheet.measures.length * beatsPerMeasure;

    // 1) Chord events: each ChordBeat starts at (measureIdx*bpm + beat-1)
    // beats; the chord sustains until the NEXT chord change in time
    // order, or until end-of-sheet.
    type FlatChord = { startBeat: number; midi: number[] };
    const flatChords: FlatChord[] = [];
    sheet.measures.forEach((m, mi) => {
      const sorted: ChordBeat[] = [...m.chords].sort(
        (a, b) => a.beat - b.beat,
      );
      for (const cb of sorted) {
        const start = mi * beatsPerMeasure + (cb.beat - 1);
        const midi = chordToMidiNotes(
          cb.chord,
          CHORD_OCTAVE,
          cb.bass,
        );
        flatChords.push({ startBeat: start, midi });
      }
    });
    flatChords.sort((a, b) => a.startBeat - b.startBeat);

    for (let i = 0; i < flatChords.length; i++) {
      const fc = flatChords[i];
      const nextStart =
        i + 1 < flatChords.length
          ? flatChords[i + 1].startBeat
          : totalMeasureBeats;
      const durBeats = Math.max(0.25, nextStart - fc.startBeat);
      const sustainSeconds = durBeats * beatSeconds * 0.95;
      const id = transport.schedule((time) => {
        const freqs = fc.midi.map((m) =>
          Tone.Frequency(m, "midi").toFrequency(),
        );
        this.chordSynth?.triggerAttackRelease(
          freqs,
          sustainSeconds,
          time,
        );
      }, LEAD_IN_SECONDS + fc.startBeat * beatSeconds);
      this.scheduledEvents.push(id);
    }

    // 2) Melody events: walk each measure's melody and accumulate a
    // beat cursor within the measure. Rests advance the cursor without
    // scheduling audio. Tied "follower" notes get skipped (their
    // duration is folded into the previous note).
    sheet.measures.forEach((m, mi) => {
      const melody: MelodyNote[] = m.melody ?? [];
      let cursor = 0;
      melody.forEach((n, ni) => {
        const beats = beatsForDuration(n.duration, n.dotted);
        const startBeat = mi * beatsPerMeasure + cursor;
        if (n.kind === "note") {
          // Check if previous note tied into this one — if so, skip:
          // the previous note's scheduling already covers it.
          const prev = melody[ni - 1];
          const isTiedFollower =
            prev &&
            prev.kind === "note" &&
            prev.tieToNext === true &&
            prev.pitch === n.pitch;
          if (!isTiedFollower) {
            // If THIS note ties to the next AND the next is same pitch,
            // extend the sustain to cover both.
            let sustainBeats = beats;
            const next = melody[ni + 1];
            if (
              n.tieToNext &&
              next &&
              next.kind === "note" &&
              next.pitch === n.pitch
            ) {
              sustainBeats += beatsForDuration(next.duration, next.dotted);
            }
            const midi = vexPitchToMidi(n.pitch);
            if (midi !== null) {
              const sustainSeconds =
                Math.max(0.05, sustainBeats * beatSeconds * 0.92);
              const id = transport.schedule((time) => {
                this.melodySynth?.triggerAttackRelease(
                  Tone.Frequency(midi, "midi").toFrequency(),
                  sustainSeconds,
                  time,
                );
              }, LEAD_IN_SECONDS + startBeat * beatSeconds);
              this.scheduledEvents.push(id);
            }
          }
        }
        cursor += beats;
      });
    });

    // 3) End-of-sheet stop. Schedule a tiny tail after the final beat
    // so the release of the last note completes.
    const totalSeconds =
      LEAD_IN_SECONDS + totalMeasureBeats * beatSeconds + 0.8;
    this.endCallback = options?.onEnded ?? null;
    this.endEvent = transport.scheduleOnce(() => {
      this.cancel();
      this.endCallback?.();
    }, totalSeconds);

    this._isPlaying = true;
    transport.start();
  }

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
    this.chordSynth?.releaseAll();
    this.melodySynth?.triggerRelease();
    this._isPlaying = false;
  }

  dispose(): void {
    this.cancel();
    this.chordSynth?.dispose();
    this.chordSynth = null;
    this.melodySynth?.dispose();
    this.melodySynth = null;
  }
}

/** Module-level singleton. Same Transport-ownership pattern as preview.ts. */
export const sheetPlayback = new SheetPlayback();
