import {
  BookOpen,
  CalendarCheck,
  Ear,
  Eye,
  FileMusic,
  KeyRound,
  ListMusic,
  Mic,
  Music,
  Timer,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * Single source of truth for Practice Prodigy's 9-item platform vision.
 * Drives the persistent header's module switcher and the /roadmap page.
 *
 * Adding a future module = one entry in MODULES. The shell + roadmap
 * surface it automatically; no per-page wiring needed.
 *
 * Status taxonomy (see also PROJECT-DESIGN.md §9):
 *   live      — built and shipped, has a working route
 *   in-build  — actively under construction this milestone
 *   designed  — design locked, build window scheduled (v1.x / v2)
 *   sketch    — vision-level item, no committed build window yet
 *
 * Roadmap bucket bucketizes for the /roadmap Now/Next/Later columns.
 * Status is finer-grained (and surfaced as a chip on each card); the
 * bucket is what the column layout uses.
 */

export type ModuleStatus = "live" | "in-build" | "designed" | "sketch";
export type RoadmapBucket = "now" | "next" | "later";

export type ModuleEntry = {
  id: string;
  name: string;
  /** Short label for compact UI surfaces (header switcher). */
  shortName: string;
  status: ModuleStatus;
  bucket: RoadmapBucket;
  /** Only present when status === "live". */
  route?: string;
  /** One-line copy used in the switcher dropdown + roadmap cards. */
  description: string;
  icon: LucideIcon;
  /**
   * Used to decide which module is "active" given the current
   * pathname. Defaults to exact route match when omitted.
   */
  routeMatch?: (pathname: string) => boolean;
};

export const MODULES: ModuleEntry[] = [
  {
    id: "arpeggios",
    name: "Arpeggios",
    shortName: "Arpeggios",
    status: "live",
    bucket: "now",
    route: "/practice",
    description:
      "Drill arpeggio patterns over user-defined chord sequences. Bass-tuned today; guitar + other instruments land with the upcoming instrument selector.",
    icon: Music,
    // Phase 46 — narrow the matcher so /practice/keys (Key Sequencer)
    // doesn't get swallowed. Phase 62 adds /practice/scales to the
    // exclusion list so the module switcher highlights the right one.
    routeMatch: (p) =>
      p.startsWith("/practice") &&
      !p.startsWith("/practice/keys") &&
      !p.startsWith("/practice/scales"),
  },
  {
    id: "my-practice",
    name: "My Practice",
    shortName: "My Practice",
    status: "designed",
    bucket: "next",
    description:
      "Compose practice routines across every module: chain a metronome warmup → arpeggio drills → scale focus → sight-reading into one playable session. The cross-module composition layer. Design locked in ROUTINE-DESIGN.md; ships paired with the Metronome module.",
    icon: CalendarCheck,
  },
  {
    id: "metronome",
    name: "Metronome",
    shortName: "Metronome",
    status: "live",
    bucket: "now",
    route: "/metronome",
    description:
      "Premium-tier metronome — subdivisions (quarter / 8th / triplet / 16th), per-beat accents, 4 sound presets, 3 visual styles (dots / pulse / pendulum), polyrhythms, tempo ramping, silent measures for ear training. Tap tempo + keyboard shortcuts. First module to implement the cross-module RoutineItem interface (see ROUTINE-DESIGN.md).",
    icon: Timer,
    routeMatch: (p) => p.startsWith("/metronome"),
  },
  {
    id: "tuner",
    name: "Tuner",
    shortName: "Tuner",
    status: "live",
    bucket: "now",
    route: "/tuner",
    description:
      "Chromatic tuner via microphone input. Real-time pitch detection (autocorrelation), big note display, cents needle, configurable A4 reference (415–466 Hz for baroque / 432 / standard / 442 / 444). Works for any monophonic instrument: bass, guitar, voice.",
    icon: Mic,
    routeMatch: (p) => p.startsWith("/tuner"),
  },
  {
    id: "key-sequencer",
    name: "Key Sequencer",
    shortName: "Key Sequencer",
    status: "live",
    bucket: "now",
    route: "/practice/keys",
    description:
      "Composability-first: pick a pool of 12 keys + layer up to 3 rows of your own prompt words on top (quality, pattern, direction, or anything you type). Each measure surfaces one key + one word per row. Instrument-neutral — silent + metronome only. See KEY-SEQUENCER-DESIGN.md.",
    icon: KeyRound,
    routeMatch: (p) => p.startsWith("/practice/keys"),
  },
  {
    id: "scales",
    name: "Scale Driller",
    shortName: "Scales",
    status: "live",
    bucket: "now",
    route: "/practice/scales",
    description:
      "Drill scales (major, modes, pentatonic, blues, harmonic/melodic minor, whole tone, diminished, chromatic) across a user-built pool of scale × key combos. Instrument-neutral: silent + metronome only. See PROJECT-DESIGN.md §11 Phase 62.",
    icon: ListMusic,
    routeMatch: (p) => p.startsWith("/practice/scales"),
  },
  {
    id: "theory",
    name: "Theory Course",
    shortName: "Theory",
    status: "sketch",
    bucket: "later",
    description:
      "Curriculum-driven theory lessons + drills. Intervals, chord construction, modes, voice leading, basic counterpoint.",
    icon: BookOpen,
  },
  {
    id: "ear-training",
    name: "Ear Training",
    shortName: "Ear Training",
    status: "sketch",
    bucket: "later",
    description:
      "Recognize intervals, chord qualities, scale degrees, progressions, melodic and rhythmic dictation. The highest-leverage musical skill.",
    icon: Ear,
  },
  {
    id: "lead-sheets",
    name: "Lead Sheet Builder",
    shortName: "Lead Sheets",
    status: "live",
    bucket: "now",
    route: "/sheets",
    description:
      "Author lead sheets — Phase 24a MVP is shipped: title + composer + style + key + time signature + per-measure chord grid (1 or 2 chords per bar) + read-only display + print-to-PDF via browser dialog. Melody / lyrics / form markings ship in subsequent phases (see LEAD-SHEET-DESIGN.md).",
    icon: FileMusic,
    routeMatch: (p) => p.startsWith("/sheets"),
  },
  {
    id: "sight-reading",
    name: "Sight Reading",
    shortName: "Sight Reading",
    status: "sketch",
    bucket: "later",
    description:
      "Adaptive notation snippets calibrated to your level — difficulty advances as you read cleanly. Starts with bass and guitar.",
    icon: Eye,
  },
  {
    id: "teacher-student",
    name: "Teacher / Student",
    shortName: "Teacher / Student",
    status: "sketch",
    bucket: "later",
    description:
      "Studio relationship model: assign drills, comment on patterns, submit recordings for review, optional live sessions.",
    icon: Users,
  },
];

export const STATUS_LABELS: Record<ModuleStatus, string> = {
  live: "Live",
  "in-build": "In build",
  designed: "Designed",
  sketch: "Sketch",
};

export const BUCKET_LABELS: Record<RoadmapBucket, string> = {
  now: "Now",
  next: "Next",
  later: "Later",
};

export const BUCKET_DESCRIPTIONS: Record<RoadmapBucket, string> = {
  now: "Available to use today.",
  next: "Designed and on the build schedule — coming with the next platform expansions.",
  later: "Sketched at the vision level. Build window not yet committed; included so the long-term shape is visible.",
};

/** Find the module matching the current route, if any. */
export function activeModule(pathname: string): ModuleEntry | null {
  for (const m of MODULES) {
    if (m.routeMatch?.(pathname)) return m;
    if (m.route && pathname === m.route) return m;
  }
  return null;
}
