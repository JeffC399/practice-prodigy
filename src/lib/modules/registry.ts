import {
  BookOpen,
  Ear,
  Eye,
  FileMusic,
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
    id: "bass-arpeggios",
    name: "Bass Arpeggios",
    shortName: "Bass Arpeggios",
    status: "live",
    bucket: "now",
    route: "/practice",
    description:
      "Drill arpeggio patterns over user-defined chord sequences. The v1 launch module.",
    icon: Music,
    routeMatch: (p) => p.startsWith("/practice"),
  },
  {
    id: "metronome",
    name: "Metronome",
    shortName: "Metronome",
    status: "designed",
    bucket: "next",
    description:
      "Standalone metronome — subdivisions, accents, polymetric, programmable sequences. Same audio engine.",
    icon: Timer,
  },
  {
    id: "tuner",
    name: "Tuner",
    shortName: "Tuner",
    status: "designed",
    bucket: "next",
    description:
      "Chromatic tuner via microphone input. Pairs with the future bass-profile setting.",
    icon: Mic,
  },
  {
    id: "scales",
    name: "Scale Driller",
    shortName: "Scales",
    status: "designed",
    bucket: "next",
    description:
      "Drill scales (major, minor pentatonic, modes, whole tone, ...) on the same shared substrate as arpeggios.",
    icon: ListMusic,
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
    status: "designed",
    bucket: "next",
    description:
      "Author lead sheets: title + composer + credits, key + time + tempo + style, chords + melody + lyrics, form markings (repeats, D.C. / D.S. / Coda), print + share. Basic tier designed (see LEAD-SHEET-DESIGN.md); advanced tier (MusicXML, multi-voice, mid-piece key/time changes) sketched separately.",
    icon: FileMusic,
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
