---
title: Mode B Webview Embedding — Research Report
status: Research complete — no code implemented
date: 2026-06-14
author: Claude Code (research pass)
context: ADR-009 hybrid composition, Mode B child webview mechanics
---

# Mode B Webview Embedding

Research into how Lattica embeds LumaWeave as a Tauri 2 child webview (ADR-009 Mode B).
No code was written or committed.

---

## Section 1 — Executive Summary

**Recommendation: Answer B (built dist/ bundle), with initialization_script for theme injection.**
Point Lattica's child webview at LumaWeave's built `dist/` output, served via Tauri's
built-in `tauri://` protocol. In dev Lattica uses `WebviewUrl::External("http://localhost:1420")`
targeting LumaWeave's already-running Vite dev server; in prod it uses `WebviewUrl::App`
against a bundled or sidecar copy of LumaWeave's dist. This keeps LumaWeave truly standalone
(no code changes), gives a clean prod story, and avoids Answer A's dev-server dependency
problem and Answer C's architectural impossibility. Embedding is done from Rust via
`window.add_child()` behind the `unstable` feature flag.

**The single most important constraint:** Tauri 2 multi-webview (`add_child`) is locked behind
`tauri = { version = "2", features = ["unstable"] }`. As of stable Tauri 2.x (through at
least 2.0.4 / early 2026) this flag carries real, reproducible bugs — on Linux webviews
stack vertically instead of positioning correctly (issue #13071, duped to #10420, both open);
on macOS/Windows z-order issues were reported but appear partially fixed. The `unstable` flag
is not aspirational — it is the literal only way to call `window.add_child()`. Lattica cannot
avoid it. The risk is architectural, not just cosmetic.

---

## Section 2 — Tauri 2 Child-Webview API Today

### WebviewWindow vs Webview

`WebviewWindow` is the normal case: it creates a native OS window that contains exactly one
webview. Everything in LumaWeave today is a `WebviewWindow`. It extends `Webview`.

`Webview` (standalone, without its own window) is the child-embedding primitive. It lives
inside an existing `Window` as one of potentially many children. This is the object Lattica
needs to create when embedding LumaWeave.

In the Rust API:
- `WebviewWindowBuilder` — creates a freestanding window+webview pair (normal app startup)
- `WebviewBuilder` — creates a webview-only object to be attached to an existing window
- `window.add_child(builder, position, size)` — attaches a `WebviewBuilder` to an existing
  window as a child; returns a `Webview` handle

### Builder Constructor

```rust
let luma_view = WebviewBuilder::new(
    "lumaweave",                                  // label — must be unique in the app
    WebviewUrl::External("http://localhost:1420".parse()?)  // dev path
)
.initialization_script(THEME_INIT_SCRIPT)         // runs before first paint
.auto_resize();                                   // fills parent when window resizes

let luma_child = lattica_window.add_child(
    luma_view,
    tauri::LogicalPosition::new(0.0, 0.0),
    lattica_window.inner_size()?
)?;
```

`WebviewUrl` variants:
- `App(PathBuf)` — resolves against the host app's `frontendDist`; always points at the
  same bundle that serves Lattica's own shell
- `External(Url)` — arbitrary HTTP/HTTPS URL; good for dev server targeting
- `CustomProtocol(Url)` — a registered scheme like `luma://`; most flexible in prod but
  requires a handler to be registered

### Size / Position / Z-order Control

In Rust on an existing `Webview` handle:
- `set_bounds(Rect)` — position + size in one call
- `set_position(LogicalPosition)` / `set_size(LogicalSize)`
- `auto_resize()` — builder option that causes the child to track parent window size

Z-order is first-created-on-top on macOS. On Windows there was a bug (tauri#9798) where the
second webview appeared behind the first; this was fixed in wry#1271. Linux z-order is not
documented and assumed paint order.

### Lifecycle Events

Child webviews fire `on_webview_event(closure)` callbacks. The `Listener` trait gives
`listen(event, handler)` / `once(event, handler)` for named events from the Tauri event bus.
There is no `DOMContentLoaded` analog at the Tauri layer — JS sends an explicit ready event
once loaded if needed.

On the JS side (inside the embedded LumaWeave webview), `getCurrentWebview()` and
`getCurrent()` both return the child webview's own handle; `Webview.getByLabel("lumaweave")`
from Lattica's shell also returns it.

### Known Bugs and Limitations (as of 2026-06)

| Issue | Platform | Status | Severity |
|---|---|---|---|
| Child webviews stack vertically, positions ignored | Linux | Open (duped #10420) | High — Mode B broken on Linux |
| `add_child` only renders last child | macOS 14 arm64 | Open, needs triage | High if reproducible |
| Z-order: new webview behind existing | Windows | Fixed (wry#1271) | Was high, now low |
| `WindowEvent::Focused` doesn't fire with unstable | all | Open #12568 | Low-medium |
| Windows: deadlock creating webviews from sync cmds | Windows | Documented | Medium — use async |

The Linux issue is the most load-bearing risk for this project. If the developer's workstation
is Linux, Mode B is functionally broken today on the stable Tauri 2 line.

### window.postMessage Across Webviews

Browsers route `window.postMessage` to the same browsing context by origin. Two child webviews
in the same Tauri window are separate browsing contexts; a `postMessage` from one does NOT
arrive in the other. Tauri's own event bus (`emit` / `listen`) is the correct mechanism for
cross-webview IPC. These events are routed by Tauri's Rust core and delivered via evaluated
JavaScript — they cross webview boundaries cleanly.

---

## Section 3 — Comparing A, B, C

---

### Answer A — Point child webview at LumaWeave's Vite dev server

**Mechanics**
```rust
WebviewBuilder::new("lumaweave", WebviewUrl::External(
    "http://localhost:1420".parse()?
))
```
No LumaWeave-side changes. Lattica just opens a URL.

**Dev workflow**
Developer must start `npm run dev` in the LumaWeave repo before starting Lattica. Lattica has
no knowledge of whether LumaWeave's dev server is up. Hot-reload works because HMR runs inside
the webview and the dev server is live.

**Prod workflow**
There is no LumaWeave prod server to point at. `localhost:1420` doesn't exist in a shipped
binary. Answer A has no prod path without additional infrastructure (a separate LumaWeave
binary that auto-starts, which is essentially Answer C).

**LumaWeave-side changes required**
None for dev. Impossible to ship without Answer C scaffolding.

**Lattica-side complexity**
~30 lines of Rust for the webview spawn. No prod path.

**Failure modes**
LumaWeave dev server not running → blank webview with no error surfacing. Must add health
check polling and "project unreachable" state manually.

**Theme propagation**
Works in dev: inject via `initialization_script` before page load. Has the same mechanism as
Answer B.

**Cross-webview communication**
Tauri `emit_to("lumaweave", event, payload)` from Lattica's Rust backend; LumaWeave listens
with `listen(event, handler)` in its JS.

**My take: Don't adopt as the primary path.** Usable only in dev. Not shippable.

---

### Answer B — Point child webview at LumaWeave's built dist/ bundle

**Mechanics — two sub-variants**

*B1 (prod): Bundle LumaWeave's dist into Lattica's resources dir*
```rust
// tauri.conf.json bundle.resources: ["../lumaweave-dist/**"]
// In Rust:
let dist_path = app.path().resource_dir()?.join("lumaweave-dist/index.html");
WebviewBuilder::new("lumaweave", WebviewUrl::App(
    PathBuf::from("lumaweave-dist/index.html")
))
```
Problem: `WebviewUrl::App` resolves against Lattica's own frontendDist, not an arbitrary path.
To use a dist/ outside Lattica's own bundle, a custom protocol is cleaner.

*B2 (prod): Custom protocol serving LumaWeave's dist*
```rust
// Register luma:// protocol in Lattica's Rust setup:
builder.register_uri_scheme_protocol("luma", move |app, request| {
    let path = request.uri().path(); // e.g. "/index.html"
    let dist = app.path().resource_dir()?.join("luma-dist").join(path.trim_start_matches('/'));
    let bytes = std::fs::read(dist)?;
    Response::builder().body(bytes).unwrap()
})
// Then:
WebviewBuilder::new("lumaweave", WebviewUrl::CustomProtocol(
    "luma://localhost/index.html".parse()?
))
```

*B-dev: In dev, use External URL (same as Answer A)*
```rust
let url = if cfg!(debug_assertions) {
    WebviewUrl::External("http://localhost:1420".parse()?)
} else {
    WebviewUrl::CustomProtocol("luma://localhost/index.html".parse()?)
};
```

**Dev workflow**
Dev behaves like Answer A: LumaWeave dev server must be running, hot-reload works.
In a `--no-dev-server` mode or for smoke-testing prod behavior, point at the dist/ build.

**Prod workflow**
LumaWeave's `dist/` is copied into Lattica's resource bundle at build time. A CI step or
Makefile target runs `npm run build` in the LumaWeave repo, then copies `dist/` to
`lattica/resources/luma-dist/`. Lattica's Tauri bundle includes this via `bundle.resources`.
On a fresh user machine everything is self-contained in Lattica's installer. LumaWeave's
Tauri binary is NOT included — only its compiled frontend.

**LumaWeave-side changes required**
None at the code level. One build artifact: `npm run build` must produce a standalone
`dist/` that works without LumaWeave's Tauri backend for pure-display purposes OR LumaWeave's
Tauri commands must be reimplemented/proxied through Lattica's backend. This is the key
architectural tension: LumaWeave's JS makes `invoke("read_file", ...)` calls that only work
if a Tauri backend process is running. In Mode B, that backend is LumaWeave's own Tauri
process (if running standalone) or it's absent.

Resolution: in Mode B, Lattica and LumaWeave run as separate processes. LumaWeave's full
Tauri binary launches independently; Lattica embeds only LumaWeave's frontend webview while
LumaWeave's Rust backend remains its own process. The two share IPC. This means:
- LumaWeave must be installed/running separately (not just its dist/)
- Lattica spawns LumaWeave's Tauri process (or requires it to be running) and points its
  child webview at LumaWeave's dev server / local file server

This is actually the hybrid of B + elements of A: *LumaWeave runs as a process; Lattica
embeds its UI in a child webview.*

**Lattica-side complexity**
~80–120 lines of Rust: protocol handler, process-spawn guard for LumaWeave, webview creation,
health-check, "project unreachable" fallback.

**Failure modes**
LumaWeave not installed or not running → blank webview. Lattica should detect this and show
an actionable "LumaWeave not running — start it with `cargo tauri dev` in LumaWeave repo"
state.

**Theme propagation**
`initialization_script` injects CSS vars before LumaWeave's JS runs. Reliable.

**Cross-webview communication**
Tauri's event bus: `app.emit_to("lumaweave", "switch-workspace", payload)` from Lattica's
Rust. LumaWeave's JS calls `listen("switch-workspace", handler)`. Both processes share the
same Tauri app context? No — they are separate Tauri instances. This is the fundamental IPC
question: can two Tauri apps communicate via Tauri events? They cannot by default. They need
an explicit IPC bridge: fossic subscriptions, a shared Unix socket, or a custom Tauri plugin
that exposes an IPC endpoint. This is a significant open design question.

**My take: Adopt as the primary architecture.** The "separate LumaWeave process, Lattica
embeds its webview" framing is the correct reading of ADR-009's "project's unchanged frontend
code hosted in a child webview." The IPC bridge is a required design deliverable.

---

### Answer C — Spawn LumaWeave's standalone Tauri binary, embed its window

**Mechanics**
LumaWeave runs as a fully independent OS process with its own native window. "Embedding"
would mean somehow reparenting its OS window into Lattica's window. This is OS window
manager territory — WM reparenting on X11/Wayland (xreparentwindow is X11-only and breaks
on Wayland), window embedding on macOS (not supported for foreign processes), and similar
hacks on Windows.

**Dev workflow**
`std::process::Command::new("lumaweave").spawn()` from Lattica, then... nothing useful to
embed. You cannot control a foreign window's position reliably.

**Prod workflow**
LumaWeave binary must be installed. Lattica finds it on PATH or at a known sidecar path.

**LumaWeave-side changes required**
None in the binary. But Lattica can't actually embed it — it can only launch it as a
floating window.

**Lattica-side complexity**
High, because it doesn't work. Process lifecycle management adds complexity.

**Failure modes**
LumaWeave binary not found → spawn fails. Foreign window reparenting → crashes or ignored.

**Theme propagation**
Impossible. You can't inject anything into a foreign process's webview.

**Cross-webview communication**
Would require LumaWeave to expose an IPC endpoint (stdio, socket, fossic subscription).

**My take: Don't adopt.** Technically unfeasible for the embedding goal. Running LumaWeave
as a separate process is correct for its backend, but the frontend must be in Lattica's
webview layer, not a separate OS window.

---

## Section 4 — The Recommendation

**Adopt Answer B, interpreted correctly: LumaWeave as a sibling Tauri process, frontend
embedded as a child webview in Lattica's window.**

The architecture is:
1. Lattica's Tauri process is the shell. It manages the native window and the Mode A React
   bundle.
2. LumaWeave's Tauri process runs alongside Lattica (either pre-launched by the user or
   launched by Lattica as a managed subprocess). LumaWeave's Rust backend is fully operational.
3. Lattica creates a child webview (via `window.add_child`, `unstable` feature) pointed at
   LumaWeave's dev server (`http://localhost:1420`) in dev, or at a locally served URL in prod.
4. In prod, LumaWeave serves its frontend from its own Tauri process's `tauri://localhost`
   URL. Lattica points its child webview at a known port that LumaWeave exposes, or LumaWeave
   is bundled as a Tauri sidecar so Lattica can launch it deterministically.

**What v0.2.0 needs to scaffold**
- Enable `tauri = { version = "2", features = ["unstable"] }` in Lattica's `src-tauri/Cargo.toml`
- A Rust function `spawn_child_webview(app, label, url)` in Lattica's backend
- A "project unreachable" fallback view for when LumaWeave's URL is not responsive
- The IPC bridge design (see Section 5 and Section 7)

**What LumaWeave eventually needs**
- A documented startup port convention (currently `devUrl: "http://localhost:1420"` — already
  in `tauri.conf.json`; make this canonical and stable)
- A "I am embedded in Lattica" signal via Tauri event (optional, for future workspace
  context sharing)
- Nothing else — the core ADR-009 constraint ("project's frontend runs unchanged") holds

**Developer workflow once working**
```bash
# Terminal 1 — LumaWeave
cd ~/Projects/lumaweave && npm run dev   # Vite + Tauri on :1420

# Terminal 2 — Lattica
cd ~/Projects/lattica && cargo tauri dev
# Lattica's child webview loads http://localhost:1420
```
Hot-reload in LumaWeave works independently. Lattica's shell hot-reloads separately.
Two dev server processes, two Tauri instances, one combined window.

---

## Section 5 — Theme Propagation Deep-Dive

### Why CSS custom properties don't cross document boundaries

CSS custom properties (`--portfolio-*` tokens from ADR-L-001) are inherited within a single
document's cascade. A child webview is a separate `document` object in a separate browsing
context. `:root { --portfolio-accent: #ff6b35 }` in Lattica's stylesheet does not cascade
into LumaWeave's document. There is no cross-document CSS inheritance in any browser engine.

### Three injection mechanisms

**Mechanism 1: initialization_script (recommended)**

```rust
// In Lattica's Rust, when creating the child webview:
let tokens = build_css_vars_js(); // reads Lattica's current theme tokens

WebviewBuilder::new("lumaweave", url)
    .initialization_script(&format!(
        r#"(function() {{
            const s = document.createElement('style');
            s.id = '--lattica-theme';
            s.textContent = ':root {{ {} }}';
            document.head.appendChild(s);
        }})();"#,
        tokens  // e.g. "--portfolio-accent: #ff6b35; --portfolio-bg: #0d0d0d;"
    ))
```

This runs before any other scripts in the child webview's document. LumaWeave's CSS that
reads `var(--portfolio-accent)` will find the value already set. Theme tokens are baked in
at webview creation time.

**Weakness:** Tokens are static after creation. If the user changes theme in Lattica's shell,
the child webview's tokens don't update without a reload or a separate `eval()` call.

For v0.2.0 (single theme, no dynamic switching), this is sufficient.

**Mechanism 2: postMessage / Tauri event handshake**

LumaWeave's JS listens for a `portfolio-theme` event:
```typescript
// In LumaWeave's bootstrap (small addition, but technically a LumaWeave-side change):
await listen<Record<string, string>>('portfolio-theme', (ev) => {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(ev.payload)) {
    root.style.setProperty(k, v);
  }
});
```
Lattica emits on every theme change. This allows live theme updates without a webview reload.

**Weakness:** Requires a small addition to LumaWeave. ADR-009 says "no conditional behavior
keyed on 'am I in Lattica'" — but a passive `listen` that only fires when Lattica sends the
event could be argued as acceptable. Needs developer sign-off.

**Mechanism 3: Custom Tauri protocol serving a shared stylesheet**

Register `portfolio-theme://` in Lattica's Rust, serve a stylesheet with current tokens.
LumaWeave's `index.html` includes `<link rel="stylesheet" href="portfolio-theme://tokens">`.

**Weakness:** Requires LumaWeave's `index.html` to be modified. Violates the "runs unchanged"
constraint unless it's a harmless no-op when the protocol isn't registered (link fetch will
404 silently). The mechanism is fragile and couples LumaWeave's HTML to Lattica's protocol
registration.

**Recommendation: Mechanism 1 (initialization_script) for v0.2.0.** It requires zero
LumaWeave-side changes, is reliable, and covers the initial-load case cleanly. Add Mechanism
2 in a later pass once dynamic theming is needed, with a minimal `listen` stub in LumaWeave
that fires only when the `portfolio-theme` event is present.

---

## Section 6 — Cerebra Forward-Compatibility Check

The recommendation (Answer B: sibling process, child webview pointed at its dev server or
local port) is compatible with two simultaneous Mode B embeds. Each project:
- Runs as its own Tauri process on its own port
- Gets its own child webview with its own label
- Receives its own `initialization_script` injection

Concrete two-project sketch:
```rust
// LumaWeave child
window.add_child(
    WebviewBuilder::new("lumaweave", WebviewUrl::External("http://localhost:1420".parse()?))
        .initialization_script(&theme_script),
    LogicalPosition::new(0.0, 0.0),
    LogicalSize::new(half_width, full_height)
)?;

// Cerebra child (post-Phase 11)
window.add_child(
    WebviewBuilder::new("cerebra", WebviewUrl::External("http://localhost:1421".parse()?))
        .initialization_script(&theme_script),
    LogicalPosition::new(half_width, 0.0),
    LogicalSize::new(half_width, full_height)
)?;
```

**One constraint that works for one but potentially strains at two:**
The Linux positioning bug (issue #13071) means both webviews stack vertically on Linux today
regardless of `set_position`. If this bug isn't resolved by the time Mode B ships, the
split-layout workspace (LumaWeave + Cerebra side-by-side) is broken on Linux. This is a
platform constraint on the whole Mode B approach, not specific to two embeds.

**Port convention:** Two Mode B projects need distinct, documented ports. LumaWeave already
has `:1420`. Cerebra will need a different port. Establish a port registry in `docs/` before
Cerebra's frontend ships.

No other two-project constraint found. The child webview model is inherently per-label, and
labels must be unique — that's automatically enforced.

---

## Section 7 — Open Questions Back to Developer

**Q1 (highest priority): What is the cross-process IPC mechanism between Lattica and LumaWeave?**

Tauri's `emit_to` and `listen` only work within a single Tauri app context. Lattica and
LumaWeave are separate `App` instances. The event bus is not shared. When Lattica wants to
tell LumaWeave "switch to workspace X" or "load source adapter Y," how does that message
travel?

Candidate answers:
- **fossic subscriptions** — LumaWeave listens on its fossic store; Lattica appends a
  workspace-switch event; LumaWeave's subscriber fires. Clean, event-sourced, but adds fossic
  as a required dependency for workspace control messages.
- **HTTP endpoint on LumaWeave** — LumaWeave exposes a local REST endpoint that Lattica POSTs
  to. Simple but requires LumaWeave to run an HTTP server.
- **Shared Unix domain socket / named pipe** — lowest latency; requires both sides to agree
  on a path convention. No existing infrastructure.
- **`window.postMessage` from Lattica's shell JS to LumaWeave's child webview JS** —
  `window.postMessage` does NOT cross Tauri process boundaries but does work between two
  webviews in the SAME Tauri process. If Lattica's main webview and the LumaWeave child
  webview are both inside Lattica's Tauri process (the B-correct model), `postMessage` from
  Lattica's React to LumaWeave's React IS possible with the right origin check. But LumaWeave's
  Tauri backend is in a DIFFERENT process, so commands from LumaWeave's JS that invoke
  `tauri://localhost` go to LumaWeave's Rust, not Lattica's Rust.

This is the deepest architectural ambiguity. The answer determines the IPC contract between
Mode B projects and the shell. It needs a decision before Mode B work begins.

**Q2: Linux developer workstation confirmation needed.**

Is the developer's primary workstation Linux? If yes, the `add_child` positioning bug
(issue #13071, open as of March 2025) is a blocking issue for Mode B. Upstreaming a fix or
waiting for the Tauri team to resolve it may be required. If macOS or Windows, the risk is
lower and the unstable flag can be accepted.

**Q3: Is LumaWeave's dist/ self-contained without its Rust backend?**

If LumaWeave's `dist/` is loaded in a child webview but LumaWeave's Tauri process is NOT
running, every `invoke("read_file", ...)` call will fail silently. For Mode B to work, either:
(a) LumaWeave's Tauri process must be running alongside Lattica at all times, OR
(b) LumaWeave's Tauri IPC calls are proxied through Lattica's Rust backend (significant work).

Option (a) is the right answer and matches ADR-009's constraint that "each project's backend
is unchanged." But it means Lattica's Mode B workspace requires LumaWeave to be running as a
process — not just its dist/. The "copy dist/ into Lattica's resource bundle" path described
in Section 3 Answer B is only viable for a hypothetical "LumaWeave frontend without backend"
mode, which doesn't exist and shouldn't be created. Developer should confirm: Mode B means
the user has both Lattica and LumaWeave installed and running simultaneously.
