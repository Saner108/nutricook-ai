# /repo-routine

Run the full repo routine on one or more GitHub repos: clone → AI-firstify audit → new user UX walk-through → fix all issues → commit and push.

## Arguments
$ARGUMENTS — one or more GitHub repo URLs, space-separated.
If no arguments provided, run on the current repo.

## What you do

### Step 1 — Setup
For each URL in $ARGUMENTS, run in parallel using the Task tool (sub-agents):
```bash
bash .claude/skills/repo-routine/scripts/clone-repos.sh $ARGUMENTS
```
If no URL given, set REPO_PATH to the current working directory.

### Step 2 — Automated Audit (per repo, parallel)
For each repo, spawn a sub-agent via the Task tool with this prompt:

> You are a Repo Agent. Run the automated audit script on this repo:
> ```bash
> bash .claude/skills/repo-routine/scripts/audit-repo.sh <REPO_PATH>
> ```
> Read the output carefully. Note every ✗ and ⚠️. Then read:
> - CLAUDE.md (if exists) — check line count, structure, frozen contracts
> - src/ or app/ — check for dead buttons, broken layout, direct LLM API calls
> Report back: scores per dimension, list of issues found, severity (🔴/🟡/🟢).

### Step 3 — UX Walk-Through (per repo)
Act as a brand-new user who has never seen this product. Read `.claude/skills/repo-routine/references/ux-checklist.md` and work through every item. For web apps:
- Read all component files under src/components/
- Identify every button, link, and interactive element
- Flag any that have empty handlers (`() => {}`, `onPress={() => {}}`, `href="#"`)
- Check mobile layout (look for `hidden md:` classes without mobile equivalents)
- Check nav completeness (all sections reachable?)

### Step 4 — Fix Execution
Fix in priority order. For each fix, make the actual file change, then log:
```
FIXED [🔴/🟡/🟢]: <what was wrong> → <what was changed>
```

Priority rules:
- 🔴 Fix immediately: broken functionality, dead buttons, broken layout, missing mobile nav
- 🟡 Fix now: confusing UX, raw URLs as link text, no scroll-to-top, hardcoded data
- 🟢 Fix if time: CLAUDE.md missing/too long, .gitignore gaps, skill structure

**Foundation fixes always run:**
1. CLAUDE.md missing → create from `.claude/skills/repo-routine/references/claude-md-template.md`
2. CLAUDE.md > 100 lines → refactor to under 100
3. .gitignore missing .env or *.key → add them
4. .claude/skills/ missing → create it and copy repo-routine in

### Step 5 — Commit & Push
After all fixes, for each repo:
```bash
cd <REPO_PATH>
git add -A
git commit -m "<one-line summary of what was fixed>"
git push origin main
```

Commit message format: `Fix <top issue> + AI-firstify (<N> changes)`

### Step 6 — Report
Output a clean summary using `.claude/skills/repo-routine/references/report-template.md`:
- Repo name + scores per dimension (1–5)
- Every fix applied with severity
- What still needs human decision
- Recommended next steps

---

## Running on multiple repos
All Step 2 sub-agents run in parallel via the Task tool. Each is fully isolated.
Results are aggregated in Step 6.

## To add a new repo to the rotation forever
Just pass its URL: `/repo-routine https://github.com/user/new-repo`
