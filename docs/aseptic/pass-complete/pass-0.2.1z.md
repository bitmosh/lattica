── PASS COMPLETE · v0.2.1z · 2026-06-14 ──────────────────────

Title: Contract ADRs filed, ADR-009 dangling refs cleaned, version format documented

Summary: Documentation cleanup pass. The contracts implemented at v0.2.0 (token namespace, tile registration, payload renderer registry) now have formal ADRs at sequential numbers 015/016/017. ADR-009's references to the abandoned ADR-L-NNN namespace are swept. VERSION_CONVENTION documents the recent format drift so future readers understand the historical blast-radius archive.

Project: lattica

Highlights:
· Three contract ADRs filed (015 token namespace, 016 tile registration, 017 payload renderer registry)
· ADR-009 reference sweep — five ADR-L-NNN references resolved
· VERSION_CONVENTION format drift note added
· First pass on resumed Blog Bumper pipeline

Learnings:
· Sequential ADR numbering replaces the ADR-L-NNN sub-namespace from earlier drafts; one numbering scheme is cleaner than two
· Cleanup passes that document previously-implemented decisions are normal Aseptic flow — the code didn't wait for the ADR; the ADR catches up

Commit: 40817bc
Tests: 0 passed · 0 failed · 0 skipped (no test suite yet; lands in v0.3+)
Branch: clean
