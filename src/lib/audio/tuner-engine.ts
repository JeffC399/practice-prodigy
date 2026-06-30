/**
 * Tuner engine — microphone input + pitch detection.
 *
 * Uses Web Audio API (AudioContext + MediaStreamSource + AnalyserNode)
 * to capture microphone audio, then runs an autocorrelation pitch
 * detector on each frame. Autocorrelation works well for monophonic
 * instruments (bass, guitar, voice) and avoids the npm dependency on
 * a library like pitchy / pitchfinder.
 *
 * Reports back via a subscriber callback so the UI can render the
 * detected note, cents-offset, and frequency in real time.
 *
 * Separate module from the metronome engine — different I/O direction
 * (mic input vs synth output), no shared state, runs in its own
 * AudioContext.
 */

export type TunerReading = {
  /** Detected fundamental frequency in Hz, or null if no pitch detected. */
  frequencyHz: number | null;
  /** Nearest equal-tempered note name (C, C#, D, ...) or null. */
  noteName: string | null;
  /** Octave number of the nearest note (e.g. 4 for A4), or null. */
  octave: number | null;
  /** Cents offset from the nearest equal-tempered pitch (-50 to +50), or null. */
  cents: number | null;
  /** RMS level of the input frame (0..1 typical), for "is anything coming in?" UX. */
  rms: number;
};

type TunerListener = (reading: TunerReading) => void;

const NOTE_NAMES = [
  "C",
  "C♯",
  "D",
  "D♯",
  "E",
  "F",
  "F♯",
  "G",
  "G♯",
  "A",
  "A♯",
  "B",
] as const;

/** Autocorrelation pitch detection. Returns Hz, or null if no clear pitch. */
function detectPitch(buffer: Float32Array, sampleRate: number): number | null {
  const SIZE = buffer.length;

  // RMS gate — silence / very low input returns null.
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return null;

  // Trim leading/trailing samples below 20% peak to focus on the
  // sustained portion of the note.
  let r1 = 0;
  let r2 = SIZE - 1;
  const thresh = 0.2;
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buffer[i]) < thresh) {
      r1 = i;
      break;
    }
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buffer[SIZE - i]) < thresh) {
      r2 = SIZE - i;
      break;
    }
  }

  const trimmed = buffer.slice(r1, r2);
  const trimmedSize = trimmed.length;
  if (trimmedSize === 0) return null;

  // Autocorrelation.
  const c = new Array<number>(trimmedSize).fill(0);
  for (let i = 0; i < trimmedSize; i++) {
    for (let j = 0; j < trimmedSize - i; j++) {
      c[i] += trimmed[j] * trimmed[j + i];
    }
  }

  // Find the first dip (descent past d > 0 threshold) so we skip the
  // self-correlation peak at lag 0.
  let d = 0;
  while (d < c.length - 1 && c[d] > c[d + 1]) d++;

  // Find the maximum after that dip — its lag is the period.
  let maxval = -1;
  let maxpos = -1;
  for (let i = d; i < trimmedSize; i++) {
    if (c[i] > maxval) {
      maxval = c[i];
      maxpos = i;
    }
  }
  if (maxpos <= 0) return null;
  let T0 = maxpos;

  // Parabolic interpolation to refine the peak.
  const x1 = c[T0 - 1] ?? 0;
  const x2 = c[T0] ?? 0;
  const x3 = c[T0 + 1] ?? 0;
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  if (a !== 0) T0 = T0 - b / (2 * a);

  return sampleRate / T0;
}

/** Convert Hz to nearest-note + cents using equal temperament. */
function hzToNote(
  hz: number,
  referenceA4: number,
): { noteName: string; octave: number; cents: number } {
  // MIDI note = 69 + 12 * log2(hz / referenceA4)
  const midiFloat = 69 + 12 * Math.log2(hz / referenceA4);
  const midiRounded = Math.round(midiFloat);
  const cents = (midiFloat - midiRounded) * 100;
  const noteIdx = ((midiRounded % 12) + 12) % 12;
  const octave = Math.floor(midiRounded / 12) - 1;
  return {
    noteName: NOTE_NAMES[noteIdx],
    octave,
    cents,
  };
}

class TunerEngine {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  // Explicit ArrayBuffer-backed Float32Array to satisfy the typed
  // AnalyserNode.getFloatTimeDomainData signature on TS 5.x.
  private buffer: Float32Array<ArrayBuffer> | null = null;
  private rafId: number | null = null;
  private listeners = new Set<TunerListener>();
  private isRunning = false;
  private referenceA4 = 440;

  subscribe(listener: TunerListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  setReferenceA4(hz: number): void {
    this.referenceA4 = hz;
  }

  /** Start microphone capture + pitch detection loop. */
  async start(): Promise<void> {
    if (this.isRunning) return;
    if (typeof window === "undefined") return;

    // Request mic permission. Throws if denied.
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    this.mediaStream = stream;

    const AudioContextCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    this.audioContext = new AudioContextCtor();
    const source = this.audioContext.createMediaStreamSource(stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 4096; // ~85ms window @ 48kHz — long enough for low bass notes
    this.buffer = new Float32Array(
      new ArrayBuffer(this.analyser.fftSize * 4),
    );
    source.connect(this.analyser);

    this.isRunning = true;
    this.loop();
  }

  stop(): void {
    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.mediaStream?.getTracks().forEach((t) => t.stop());
    this.mediaStream = null;
    this.analyser?.disconnect();
    this.analyser = null;
    this.buffer = null;
    void this.audioContext?.close();
    this.audioContext = null;
    // Final emit so the UI clears to idle.
    this.emit({
      frequencyHz: null,
      noteName: null,
      octave: null,
      cents: null,
      rms: 0,
    });
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }

  private emit(reading: TunerReading): void {
    for (const l of this.listeners) l(reading);
  }

  private loop = (): void => {
    if (
      !this.isRunning ||
      !this.analyser ||
      !this.buffer ||
      !this.audioContext
    ) {
      return;
    }
    this.analyser.getFloatTimeDomainData(this.buffer);

    // RMS for "any input?" indicator.
    let rms = 0;
    for (let i = 0; i < this.buffer.length; i++) {
      rms += this.buffer[i] * this.buffer[i];
    }
    rms = Math.sqrt(rms / this.buffer.length);

    const freq = detectPitch(this.buffer, this.audioContext.sampleRate);
    if (freq === null) {
      this.emit({
        frequencyHz: null,
        noteName: null,
        octave: null,
        cents: null,
        rms,
      });
    } else {
      const { noteName, octave, cents } = hzToNote(freq, this.referenceA4);
      this.emit({
        frequencyHz: freq,
        noteName,
        octave,
        cents,
        rms,
      });
    }

    this.rafId = requestAnimationFrame(this.loop);
  };
}

/**
 * Module-level singleton. Browser has limited concurrent
 * MediaStreamSource instances and we only want one mic capture at a
 * time, so sharing one engine across the page is correct.
 */
export const tunerEngine = new TunerEngine();
