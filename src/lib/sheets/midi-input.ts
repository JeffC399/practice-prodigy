/**
 * Phase 30 — Web MIDI input for melody entry.
 *
 * Plug a MIDI keyboard into your computer, toggle "MIDI in" in the
 * click-entry side panel, and each key press places a note at the
 * caret using the current rhythm / dotted / rest settings from the
 * panel. Serious musicians can author melodies at natural playing
 * speed instead of typing letter keys.
 *
 * Design notes:
 *   - Only NOTE-ON events with velocity > 0 trigger a placement.
 *     Note-off / velocity-0 events are ignored (we don't track note
 *     durations — the rhythm value comes from the side panel).
 *   - Chord input is out of scope (melody entry is monophonic). If
 *     the user presses two keys simultaneously we place both — they
 *     land in the melody one after the other, matching the rhythm
 *     value. The user can retreat + fix with arrow keys.
 *   - Chan-agnostic: we accept note-ons on any of the 16 MIDI
 *     channels (0x90 – 0x9F). Simplifies wiring for the common case
 *     of a single-channel controller.
 *   - Sharps-only pitch spelling: our data model uses sharp names
 *     throughout (C#, D#, F#, G#, A#). Flat spelling is a display
 *     concern handled downstream at render time via the key signature.
 */

/**
 * VexFlow-style pitch spelling for each MIDI pitch class (0-11).
 * Sharps only — flat spelling would need a key-signature-aware
 * lookup that's out of scope for input parsing.
 */
const MIDI_PITCH_LETTERS = [
  "c",
  "c#",
  "d",
  "d#",
  "e",
  "f",
  "f#",
  "g",
  "g#",
  "a",
  "a#",
  "b",
] as const;

/**
 * Convert a MIDI note number to a VexFlow pitch string.
 *   MIDI 60 = "c/4" (middle C)
 *   MIDI 69 = "a/4" (A above middle C, concert-pitch A4)
 *   MIDI 66 = "f#/4"
 * Returns null if the number is outside the standard MIDI range.
 */
export function midiNumberToVexPitch(midiNumber: number): string | null {
  if (
    !Number.isFinite(midiNumber) ||
    midiNumber < 0 ||
    midiNumber > 127
  ) {
    return null;
  }
  const pc = ((midiNumber % 12) + 12) % 12;
  const octave = Math.floor(midiNumber / 12) - 1;
  return `${MIDI_PITCH_LETTERS[pc]}/${octave}`;
}

type NavigatorWithMidi = Navigator & {
  requestMIDIAccess?: (options?: {
    sysex?: boolean;
  }) => Promise<MIDIAccess>;
};

export type MidiConnectionStatus =
  | "unsupported"
  | "requesting"
  | "denied"
  | "connected"
  | "disconnected";

export type MidiConnectionResult = {
  status: MidiConnectionStatus;
  /** Number of input ports currently attached (undefined when not connected). */
  deviceCount?: number;
  /** Cleanup fn — detaches all handlers and clears the onstatechange listener. */
  disconnect: () => void;
};

/**
 * Subscribe to note-on events across every MIDI input port on the
 * system. Fires `onNote(midiNumber, velocity)` for each note-on with
 * velocity > 0. Returns a status + a disconnect() cleanup.
 *
 * Re-subscribes whenever a device connects / disconnects (via the
 * MIDIAccess `statechange` event), so hot-plugging works.
 *
 * Also fires `onStatusChange` when the connection state or device
 * count shifts, so the UI can update the "3 devices connected" line.
 */
export async function connectMidiInput(handlers: {
  onNote: (midiNumber: number, velocity: number) => void;
  onStatusChange: (status: MidiConnectionStatus, deviceCount: number) => void;
}): Promise<MidiConnectionResult> {
  const nav = navigator as NavigatorWithMidi;
  if (typeof nav.requestMIDIAccess !== "function") {
    handlers.onStatusChange("unsupported", 0);
    return {
      status: "unsupported",
      deviceCount: 0,
      disconnect: () => {},
    };
  }

  handlers.onStatusChange("requesting", 0);

  let access: MIDIAccess;
  try {
    access = await nav.requestMIDIAccess({ sysex: false });
  } catch {
    handlers.onStatusChange("denied", 0);
    return {
      status: "denied",
      deviceCount: 0,
      disconnect: () => {},
    };
  }

  const attached = new Set<MIDIInput>();

  const handleMessage = (e: MIDIMessageEvent) => {
    const data = e.data;
    if (!data || data.length < 3) return;
    const statusHigh = data[0] & 0xf0;
    // Note-on messages are 0x90-0x9F. A note-on with velocity 0 is
    // conventionally treated as note-off (running-status compression).
    const isNoteOn = statusHigh === 0x90 && data[2] > 0;
    if (!isNoteOn) return;
    handlers.onNote(data[1], data[2]);
  };

  const attachAll = () => {
    // Detach anything currently attached; re-attach whatever exists
    // now. Simple + idempotent.
    for (const port of attached) {
      port.onmidimessage = null;
    }
    attached.clear();
    for (const port of access.inputs.values()) {
      port.onmidimessage = handleMessage;
      attached.add(port);
    }
    handlers.onStatusChange("connected", access.inputs.size);
  };

  attachAll();
  access.onstatechange = () => attachAll();

  return {
    status: "connected",
    deviceCount: access.inputs.size,
    disconnect: () => {
      for (const port of attached) {
        port.onmidimessage = null;
      }
      attached.clear();
      access.onstatechange = null;
      handlers.onStatusChange("disconnected", 0);
    },
  };
}
