# Design Coordination Workspace

This directory holds the intake, packets, and iteration outputs for visual
design work on the Lattica platform.

## Structure

- `REQUEST_TEMPLATE.md` — standardized template each project Claude uses to
  file their design request
- `requests/<project>/design-request.md` — each project's filed request
  (one per project; project Claudes own these)
- `packets/PACKET-NNN.md` — compiled packets submitted to frontend-design
  for iteration (each iteration round gets a new packet number)
- `iterations/<iteration-name>/` — outputs from frontend-design (layout
  proposals, component drafts, design tables, etc.)

## Workflow

1. Each project Claude files one design request at
   `requests/<project>/design-request.md` using the template
2. Lattica Claude compiles requests + reference material into a packet at
   `packets/PACKET-NNN.md`
3. Developer takes the packet to frontend-design for iteration
4. frontend-design outputs land in `iterations/<iteration-name>/`
5. Once a direction is chosen, a future pass extracts components + design
   tables back into the repo at `src/styles/design-tokens/` (canonical) and
   `src/components/` (shared components)
