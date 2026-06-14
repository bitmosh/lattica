---
pass: 0.0.0z
version: v0.0.0z
sha: 4615664
date: 2026-06-13
summary: "Cleanup — relocate fossic historical blast-radius files to examples/"
---

# Blast Radius — Pass 0.0.0z (v0.0.0z)

First descending-letter cleanup pass off the v0.0.0 bootstrap base.
Single concern: file hygiene. The Aseptic working copy adopted into
Lattica during the bootstrap included fossic's pass history; this
pass moves those files out of `docs/aseptic/blast-radius/` into
a clearly-labeled examples directory.

## Files

### Modified

None.

### Created

- `docs/aseptic/examples/` (directory)
- `docs/aseptic/examples/fossic-pass-history/` (directory)
- `docs/aseptic/examples/fossic-pass-history/README.md` — explains
  what the directory contains and why it exists
- `docs/aseptic/blast-radius/pass-0.0.0z.md` — this file

### Moved (git rename, history preserved)

- `docs/aseptic/blast-radius/pass-01.md` → `docs/aseptic/examples/fossic-pass-history/pass-01.md`
- `docs/aseptic/blast-radius/pass-02.md` → `docs/aseptic/examples/fossic-pass-history/pass-02.md`
- `docs/aseptic/blast-radius/pass-03.md` → `docs/aseptic/examples/fossic-pass-history/pass-03.md`
- `docs/aseptic/blast-radius/pass-04.md` → `docs/aseptic/examples/fossic-pass-history/pass-04.md`
- `docs/aseptic/blast-radius/pass-05.md` → `docs/aseptic/examples/fossic-pass-history/pass-05.md`
- `docs/aseptic/blast-radius/pass-06.md` → `docs/aseptic/examples/fossic-pass-history/pass-06.md`
- `docs/aseptic/blast-radius/pass-07.md` → `docs/aseptic/examples/fossic-pass-history/pass-07.md`
- `docs/aseptic/blast-radius/pass-08.md` → `docs/aseptic/examples/fossic-pass-history/pass-08.md`
- `docs/aseptic/blast-radius/pass-09.md` → `docs/aseptic/examples/fossic-pass-history/pass-09.md`
- `docs/aseptic/blast-radius/pass-10.md` → `docs/aseptic/examples/fossic-pass-history/pass-10.md`
- `docs/aseptic/blast-radius/pass-10.0q.md` → `docs/aseptic/examples/fossic-pass-history/pass-10.0q.md`
- `docs/aseptic/blast-radius/pass-10.0r.md` → `docs/aseptic/examples/fossic-pass-history/pass-10.0r.md`
- `docs/aseptic/blast-radius/pass-10.0s.md` → `docs/aseptic/examples/fossic-pass-history/pass-10.0s.md`
- `docs/aseptic/blast-radius/pass-10.0.t.md` → `docs/aseptic/examples/fossic-pass-history/pass-10.0.t.md`
- `docs/aseptic/blast-radius/pass-10.0.u.md` → `docs/aseptic/examples/fossic-pass-history/pass-10.0.u.md`
- `docs/aseptic/blast-radius/pass-10.1.md` → `docs/aseptic/examples/fossic-pass-history/pass-10.1.md`
- `docs/aseptic/blast-radius/pass-10.v.md` → `docs/aseptic/examples/fossic-pass-history/pass-10.v.md`
- `docs/aseptic/blast-radius/pass-10.w.md` → `docs/aseptic/examples/fossic-pass-history/pass-10.w.md`
- `docs/aseptic/blast-radius/pass-10.x.md` → `docs/aseptic/examples/fossic-pass-history/pass-10.x.md`
- `docs/aseptic/blast-radius/pass-11.md` → `docs/aseptic/examples/fossic-pass-history/pass-11.md`
- `docs/aseptic/blast-radius/pass-8.5.md` → `docs/aseptic/examples/fossic-pass-history/pass-8.5.md`
- `docs/aseptic/blast-radius/pass-8.6.md` → `docs/aseptic/examples/fossic-pass-history/pass-8.6.md`

### Deleted

None.

## Public APIs

### Added / Modified / Removed

None — docs-only cleanup pass.

## Schema changes

None.

## Configuration changes

None.

## Dependency changes

None.

## Behavior changes

None — no production code exists; no consumer behavior affected.

## Living report updates

### New entries this pass

- TECH_DEBT: **No new entries this pass.**
- POLISH_DEBT: **No new entries this pass.**
- DEVIATION: **No new entries this pass.**

### Entries resolved this pass

None. PD-001 (ES toolkit / lattica-es naming drift) and DV-001 (ADR-001
registry hooks assumed to exist but do not) remain open — they are
load-bearing and will be addressed in v0.1.0 and v0.1.1, not in a
cleanup pass.

## Adjacent project impact

None. This is internal Lattica file hygiene. No cross-pollination file
generated.
