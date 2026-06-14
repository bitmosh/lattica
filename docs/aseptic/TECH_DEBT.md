---
title: Tech Debt — Living Report (Lattica)
last_reviewed: v0.2.1v
---

# Tech Debt — Living Report

Functional but known-bad implementation choices. Every entry has a trigger condition.
See `LIVING_REPORTS.md` for entry format and resolution conventions.

---

---
id: TD-001
type: tech_debt
status: open
pass_opened: v0.1.0
severity: LOW
---

### TD-001 — LumaWeave capabilities.md claims commandRegistry and moduleRegistry that don't exist on disk

**What it is:** LumaWeave's `docs/requirements/lumaweave/capabilities.md` (filed
round 1) claims `commandRegistry` and `moduleRegistry` exist as live T2
registries. The Lattica reality-check investigation (round 0) found neither file
in LumaWeave's codebase. Inconsistency in the deposit, not a Lattica synthesis
error.

**Why it was necessary:** N/A — this is debt in the cross-project deposit
process, not Lattica-side architectural debt. ADR-009 doesn't require these
registries to exist (they're no longer assumed extension points), so this is
informational debt rather than blocking.

**Known cost:** If LumaWeave Claude is asked to implement cross-project commands
or module registration referencing these registries, they'd need to build them.
For now the work is unscoped. The cost is: future planning may reference
non-existent infrastructure without realizing it.

**Trigger:** LumaWeave round-3a `capabilities.md` correction arrived this pass:
`commandRegistry` corrected to T1 tier; `moduleRegistry` removed as aspirational.
This resolves the uncertainty — close this entry in the next cleanup pass.

**Evidence:** `docs/requirements/lumaweave/capabilities.md` claim (original);
`docs/requirements/lumaweave/lumaweave_round3a.md` (correction).

---

---
id: TD-002
type: tech_debt
status: open
pass_opened: v0.2.0
severity: LOW
---

### TD-002 — postMessage sendToEmbedded uses targetOrigin "*"

**What it is:** `src/ipc/postMessageBridge.ts` calls `target.postMessage(msg, "*")`.
Using `"*"` as the `targetOrigin` skips origin verification on the sending side —
any receiver on any origin sees the message. For v0.2.0 this is a stub (no Mode B
webview exists), so there is no actual receiver to protect.

**Why it was necessary:** Mode B integration is deferred to v0.3+ (Linux positioning
bug). The correct origin would be the embedded LumaWeave's URL
(`http://localhost:1420` in dev, `tauri://localhost` in production). Since that URL
isn't fully pinned yet, `"*"` is a placeholder.

**Known cost:** If Mode B goes live before this is fixed, the shell sends postMessage
commands without origin pinning — an attack surface if a malicious page is somehow
loaded in the embedded webview.

**Trigger:** When Mode B integration begins (v0.3+), replace `"*"` with the concrete
LumaWeave origin constant. Also add `event.origin` check on the LumaWeave receiver
side (already documented in ADR-010).

**Evidence:** `src/ipc/postMessageBridge.ts` line with `target.postMessage(msg, "*")`.
