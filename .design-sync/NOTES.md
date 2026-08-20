# design-sync notes — nutricook-ai

## Setup for this repo

- The repo itself is an app, not a component library — `src/App.jsx` is
  frozen/legacy (single-file inline-style screens). Reusable pieces were
  extracted into `src/design-system/` (Button, Ring, MacroBar, MacroRow,
  MealCard, AICard, plus `tokens.js` for `T`/`shadow`/`card`/`radius`) so
  there'd be something to sync. `App.jsx` was not edited or refactored to
  use these — that's a separate follow-up if wanted.
- Library build: `vite.ds.config.js` (`npm run build:ds`) builds
  `src/design-system/index.js` → `dist-ds/index.es.js`, react/react-dom
  external. This is separate from the app's own `vite build` — do not
  merge them.
- Plain JS/JSX, no TypeScript — there's no real `.d.ts` tree to extract
  props from. `componentSrcMap` pins each component's src path and
  `dtsPropsFor` hand-supplies the props interface for all 6 components.
  **If a component's props change, update its `dtsPropsFor` entry by
  hand** — it will not auto-drift-detect.
- No CSS files anywhere — every component uses inline `style={{}}` objects
  built from the `T` token object. `[CSS_RUNTIME]` warning on build/validate
  is expected and non-blocking; do not chase it or set `cssEntry`.
- No provider/context needed by any component.

## Known render warns

- None recorded — render check was never run (see below).

## Re-sync risks — read this before the next sync

- **Render check was never performed.** Playwright's Chromium download is
  blocked by this environment's outbound proxy (`cdn.playwright.dev` →
  403 "host not permitted"). `package-validate.mjs` ran with
  `--no-render-check` on explicit user sign-off. All 6 components are
  therefore **floor cards** — functional (real compiled code, correct
  `.d.ts`/`.prompt.md`) but with **zero visual verification** and no
  authored preview stories. Next sync: if a machine with real network
  access is available, install Playwright + Chromium and re-run validate
  with the render check on, then author real previews (`.design-sync/previews/<Name>.tsx`)
  and grade them per the package-shape rubric.
- **`dtsPropsFor` is hand-maintained**, not extracted — it will silently
  go stale if a component's props change without updating the config.
- **`.design-sync/previews/` does not exist yet** — nothing has been
  authored. All 6 components are on the standing "authorable on any
  future re-sync" offer.
- The reused project (`projectId` in config.json) was an existing empty
  "Design System" project already in the account, not one this run
  created — it was pre-existing and empty, so reuse was safe, but rename
  it in the claude.ai/design UI to something identifiable if desired (the
  DesignSync tool has no rename method).
