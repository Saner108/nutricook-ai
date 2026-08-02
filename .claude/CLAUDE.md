## Agent Usage Rules

- Use **schema-planner** for ALL schema, RLS, or migration planning. It only plans —
  never writes files. MUST BE USED before any migration is written.
- Use **migration-executor** ONLY after a schema-planner plan has been reviewed and
  approved by Cesar. It implements exactly what was approved — no independent schema
  decisions.
- Use **api-auth-builder** for ALL changes to serverless/API auth, quota, or payment
  webhook logic. PROACTIVELY use whenever backend auth/quota work comes up.
- Use **test-runner** after ANY change from migration-executor or api-auth-builder, and
  always before a git commit. Report only pass/fail and failure messages.

### Non-negotiable frozen contracts (NutriCook AI)

- Streaming function signature `streamRecipes(apiKey, prompt, onUpdate, fetchFn)` must not
  change — arguments and order are frozen. `onUpdate` is a progress callback invoked with
  `{ complete, partialName }`; `fetchFn` is an injectable fetch (used by the tests).
- Error handling must follow the existing `if (data.error)` pattern — do not swap to
  throw/try-catch or a different error-surface shape.
- No `<form>` tags anywhere in the React components (existing convention).
- No `localStorage` / `sessionStorage` usage anywhere.
- The `T` token design palette is frozen — do not introduce raw hex/colors outside it.
- The 430px mobile frame width is frozen.
- `src/App.jsx` is frozen/legacy — do not edit it.
- Server-side quota enforcement only: `consume_quota` RPC is the source of truth. Never
  add client-side quota counting or client-writable Pro/subscription status.

### Workflow

1. Plan (schema-planner) → 2. Human approval (Cesar) → 3. Execute (migration-executor /
   api-auth-builder) → 4. Verify (test-runner, must stay green) → 5. Cesar reviews diff →
   6. `git commit` + push (manual, never automatic — no subagent commits or pushes).

### General delegation hints

- Delegate file reads/greps/log output you won't reference again — keep main context clean.
- Never let a subagent commit or push.
