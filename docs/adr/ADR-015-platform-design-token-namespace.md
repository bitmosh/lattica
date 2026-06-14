# ADR-015: Platform Design Token Namespace

**Status:** Accepted
**Date:** 2026-06-14
**Version:** v0.2.1z

---

## Decision

The Lattica platform's CSS design tokens use the `--portfolio-*` namespace, defined
in `src/styles/portfolio-tokens.css` (copied verbatim from LumaWeave's source of
truth at v0.2.0). The namespace is shared across Lattica's shell and any Mode B
embedded webviews via theme injection (ADR-010).

## Constraints

- All Lattica-side CSS uses `--portfolio-*` tokens; no `--lw-*` or other namespaces
  appear in Lattica's own files
- The token CSS file is the source of truth, not duplicated elsewhere
- Mode B embedded webviews receive tokens via Tauri `initialization_script`
  injection at webview creation time (ADR-010 mechanism)
- New tokens are added by appending to `portfolio-tokens.css`; renames require
  a deprecation cycle to give consumers time to migrate

## Boundaries

- Modifications to `src/styles/portfolio-tokens.css` require revisiting this ADR
- Tailwind v4 utility-class generation from these tokens is a separate concern
  (ADR-011 references Tailwind config; this ADR is about the token namespace itself)

## Invariants

- A grep for non-`--portfolio-*` CSS variables in `src/**/*.{ts,tsx,css}` returns
  zero results
- Mode B embedded webviews can read `--portfolio-*` values via `getComputedStyle`
  from their `:root` element after Lattica's injection script runs

## Context

Locked at v0.2.0 alongside the verbatim copy from LumaWeave. ADR-009 had referenced
this decision as `ADR-L-001`; this ADR formalizes it under the sequential ADR
numbering. ADR-009's references are updated in v0.2.1z (this pass).

## Failure mode

If `portfolio-tokens.css` fails to load, Lattica's shell renders with browser-default
styling — visually broken but functional. Mode B webviews without injected tokens
fall back to their own default styling (LumaWeave standalone style for LumaWeave's
webview); not a crash, just visually inconsistent with Lattica's shell.
