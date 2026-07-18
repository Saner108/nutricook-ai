# Changelog

## v2.2.0 — 2026-07-17

### Added
- **Ingredient autocomplete search.** Typing in the ingredient bar now searches a 120-item pantry database and shows a tap-to-add dropdown (matched prefix bolded, already-added items excluded). Pressing Enter on a partial match adds the top suggestion.

### Improved
- **Generate button always responds.** Tapping it with an empty pantry now shows a friendly hint (search, quick-add, or Scan Fridge) instead of doing nothing.
- **Uniform AI-tab layout.** Consistent card spacing top to bottom.


## v2.1.0 — 2026-07-17

### Fixed
- **App now actually ships v2.** `src/main.jsx` previously rendered the old `src/App.jsx`; it now renders `artifacts/NutriCookAI_v2.tsx`. The deployed site was serving the old version with in-browser API-key entry.
- **Removed direct Anthropic calls from the frontend.** v2's generate flow called `api.anthropic.com` with no auth headers (always failed). All AI traffic now goes through `/api/generate`.

### Added
- **`api/generate.js`** — Vercel serverless proxy. `ANTHROPIC_API_KEY` stays server-side; supports SSE streaming passthrough; clear error when the env var is missing.
- **`vercel.json`** — SPA rewrites (all non-`/api` routes → `index.html`).
- **Streaming recipe generation.** New tested helpers `extractRecipes`, `readSSEText`, `streamRecipes`: recipes render progressively as Claude writes them, with a live skeleton card showing the in-progress recipe name. All 6 unit tests pass.
- **📷 Fridge Scan.** Camera/file picker → base64 → Claude Vision via `/api/generate` → detected ingredients merge into the chip list (deduped, lowercase). Handles oversized photos (>4MB), unreadable files, and empty results with friendly errors.
- **Local dev API.** Vite dev middleware serves `/api/generate` under `npm run dev` — proxies to Anthropic when `ANTHROPIC_API_KEY` is set, otherwise returns realistic streamed mocks so the full UX works offline.
- **Wired dead CTAs.** Home "Generate New Plan" / "Customize" and Plan "Generate with AI" now navigate to the AI tab.

### Notes
- `src/App.jsx` intentionally untouched (legacy standalone version).
- Set `ANTHROPIC_API_KEY` in Vercel → Project Settings → Environment Variables for the live site.
