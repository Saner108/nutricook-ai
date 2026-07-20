# Changelog

## v2.5.0 — 2026-07-18

### Meal History (Plan)
- Browse up to a month back: week pager (This Week → 3 Weeks Ago) with date ranges above the day strip.
- Past days show a Daily Summary card (total kcal vs target + P/C/F) and the four meals eaten that day, fully expandable. Today and future days behave as before.

### Recipe Box (Favorites + Want to Try)
- Tapping ♡ on any meal saves it to Favorite Dishes; hearts sync app-wide.
- Saving an AI recipe now also files it under Want to Try (and still sends ingredients to Grocery).
- Profile → My Recipe Box: Favorite Dishes and Want to Try pages with counts, macro pills, expandable steps, remove buttons, and helpful empty states.

### Motion polish (same palette)
- New slideUp / popIn / shimmer / pulseGlow keyframes; every tab change glides in; Home cards stagger; springy chips, pills, and day buttons; bottom-nav icons lift on select; the FAB breathes; dropdowns, accordions, and FAQ answers animate in.


## v2.4.0 — 2026-07-18

### NutriCook Pro — Stripe subscription (test-mode ready)
- `api/checkout.js`: creates a Stripe Checkout Session (subscription mode, $4.99/mo) using STRIPE_SECRET_KEY + STRIPE_PRICE_ID; returns `{simulated:true}` when keys are absent so the flow demos end-to-end without a Stripe account.
- `api/stripe-webhook.js`: signature-verified webhook for checkout.session.completed / customer.subscription.deleted (logs events; DB persistence is the documented next phase).
- Paywall bottom sheet (T-token styled): unlimited generation, unlimited fridge scans, unlimited remixes, priority speed. `?upgraded=1` return URL activates Pro.
- Free tier metering: 3 generations + 1 fridge scan per day (session-scoped; per-user enforcement requires auth + datastore). Live meter under the Generate button; exhausting quota opens the paywall — including on the Scan button itself. PRO badge in the status bar and on Profile; Upgrade banner on Profile for free users.

### AI Recipe Remix agent
- Every generated recipe card has a Remix row: 🌶 Spicier, 💪 More protein, 🔥 Fewer calories, x2 Servings, and 🔄 Swap ingredient (with inline input). Claude rewrites the recipe in the same JSON schema and the card updates in place with adjusted macros/ingredients/steps. Dev mock supports remixes offline.

### Fixed
- Scan quota was checked after the photo picker opened; the gate now fires on button tap.
- "1 ingredients" grammar on the Generate button.

### Docs
- README: environment variable table (Anthropic + optional Stripe keys) and Business Model section.


## v2.3.0 — 2026-07-18

### Plan
- Rotating "Did you know?" nutrition fact card fills the space below Snack (changes with the selected day).

### Grocery — reorganized
- "What is this?" explainer header so the page purpose is obvious.
- Saving an AI recipe now pushes its ingredients into the list under a "From Recipes" group (recipes now include shopping-list ingredients with quantities).
- Add-your-own-item input with automatic category detection and duplicate protection.
- Simpler layout: items to buy grouped flat by aisle, checked items sink to a "✓ In cart" section; celebration state when everything is bought.

### Profile — rebuilt
- Header: identity on the left, live weight-trend SVG chart on the right, with manual weight logging.
- "My Goals" section header with lbs ⇄ kg unit toggle (converts weights everywhere).
- Achievements redesigned as circular badges.
- All five settings rows now open real pages: Notification Preferences (working toggles), Dietary Restrictions (synced with the AI Generator), Connected Apps (Apple Health / Garmin / Google Fit / MyFitnessPal interest stubs), Privacy Settings (written policy), Help & Support (FAQ accordion + contact).

### Shared
- App-level state: dietary prefs, units, weight log, and grocery list persist across tab switches.


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
