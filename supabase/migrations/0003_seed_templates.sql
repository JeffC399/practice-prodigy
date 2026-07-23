-- System-owned routine templates. Re-running this migration is safe: each
-- template is inserted only if no row with the same name + is_system=true
-- already exists.
--
-- All block IDs below are arbitrary placeholders — they only need to be
-- unique within a routine. When a user loads a template into the builder we
-- regenerate them client-side so concurrent edits don't collide.

with templates(name, data) as (
  values
    (
      'Major Scale Mastery',
      $${
        "schemaVersion": 1,
        "instrument": "guitar",
        "blocks": [
          {
            "id": "t1-blk-a",
            "type": "scales",
            "roots": { "values": [0,1,2,3,4,5,6,7,8,9,10,11], "random": true },
            "scales": { "values": ["major", "lydian", "mixolydian", "dorian"], "random": true },
            "tempo": { "mode": "ladder", "low": 90, "high": 120, "stepBpm": 10, "holdReps": 4 },
            "subdivision": 16,
            "octaves": 2,
            "direction": "up_down",
            "duration": { "mode": "reps", "count": 16 },
            "countInBeats": 4,
            "referenceTone": { "enabled": true, "tone": "piano" }
          }
        ]
      }$$::jsonb
    ),
    (
      'Minor Scale Mastery',
      $${
        "schemaVersion": 1,
        "instrument": "guitar",
        "blocks": [
          {
            "id": "t2-blk-a",
            "type": "scales",
            "roots": { "values": [0,1,2,3,4,5,6,7,8,9,10,11], "random": true },
            "scales": { "values": ["natural_minor", "harmonic_minor", "melodic_minor"], "random": true },
            "tempo": { "mode": "ladder", "low": 80, "high": 120, "stepBpm": 10, "holdReps": 4 },
            "subdivision": 16,
            "octaves": 2,
            "direction": "up_down",
            "duration": { "mode": "reps", "count": 20 },
            "countInBeats": 4,
            "referenceTone": { "enabled": true, "tone": "piano" }
          }
        ]
      }$$::jsonb
    ),
    (
      '7th Chord Workout',
      $${
        "schemaVersion": 1,
        "instrument": "guitar",
        "blocks": [
          {
            "id": "t3-blk-a",
            "type": "arpeggios",
            "roots": { "values": [0,1,2,3,4,5,6,7,8,9,10,11], "random": true },
            "chords": { "values": ["maj7", "dom7", "min7", "min7b5"], "random": true },
            "pattern": [1,3,5,7,5,3],
            "tempo": { "mode": "ladder", "low": 80, "high": 120, "stepBpm": 10, "holdReps": 4 },
            "subdivision": 16,
            "octaves": 2,
            "direction": "up_down",
            "duration": { "mode": "reps", "count": 16 },
            "countInBeats": 4,
            "referenceTone": { "enabled": true, "tone": "piano" }
          }
        ]
      }$$::jsonb
    ),
    (
      'Pentatonic Speed Builder',
      $${
        "schemaVersion": 1,
        "instrument": "guitar",
        "blocks": [
          {
            "id": "t4-blk-a",
            "type": "scales",
            "roots": { "values": [9, 4, 2, 7, 0], "random": false },
            "scales": { "values": ["minor_pent"], "random": false },
            "tempo": { "mode": "ladder", "low": 100, "high": 160, "stepBpm": 10, "holdReps": 4 },
            "subdivision": 16,
            "octaves": 2,
            "direction": "up_down",
            "duration": { "mode": "reps", "count": 28 },
            "countInBeats": 4,
            "referenceTone": { "enabled": false, "tone": "guitar" }
          }
        ]
      }$$::jsonb
    ),
    (
      'Modes of Major',
      $${
        "schemaVersion": 1,
        "instrument": "guitar",
        "blocks": [
          {
            "id": "t5-blk-a",
            "type": "scales",
            "roots": { "values": [0], "random": false },
            "scales": { "values": ["major", "dorian", "phrygian", "lydian", "mixolydian", "natural_minor", "locrian"], "random": false },
            "tempo": { "mode": "single", "bpm": 100 },
            "subdivision": 16,
            "octaves": 2,
            "direction": "up_down",
            "duration": { "mode": "reps", "count": 14 },
            "countInBeats": 4,
            "referenceTone": { "enabled": true, "tone": "piano" }
          }
        ]
      }$$::jsonb
    ),
    (
      'Triad Drill',
      $${
        "schemaVersion": 1,
        "instrument": "guitar",
        "blocks": [
          {
            "id": "t6-blk-a",
            "type": "arpeggios",
            "roots": { "values": [0,1,2,3,4,5,6,7,8,9,10,11], "random": true },
            "chords": { "values": ["maj", "min", "dim", "aug"], "random": true },
            "pattern": [1,3,5],
            "tempo": { "mode": "ladder", "low": 80, "high": 120, "stepBpm": 10, "holdReps": 4 },
            "subdivision": 16,
            "octaves": 2,
            "direction": "up_down",
            "duration": { "mode": "reps", "count": 16 },
            "countInBeats": 4,
            "referenceTone": { "enabled": true, "tone": "piano" }
          }
        ]
      }$$::jsonb
    )
)
insert into public.routines (user_id, name, data, is_system)
select null, name, data, true
from templates t
where not exists (
  select 1 from public.routines r
  where r.is_system and r.name = t.name
);
