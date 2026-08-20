---
name: repo-routine
description: Full multi-repo audit + AI-firstify + UX review. Run on any GitHub repo list to clone, analyze, generate a fix plan, and execute improvements. Designed for parallel execution across N repos.
---

# Repo Routine

Run this routine on one or more GitHub repos to: clone → AI-firstify → act as a new user → fix all issues → report.

## Trigger
Invoke when asked to:
- "run the routine on [repo URLs]"
- "audit my repos"
- "AI-firstify [repo]"
- "check [repo] as a new user"
- Any time a new repo needs onboarding into this workflow system

## Phase 0: Setup

For each repo URL provided, run in parallel:

```bash
git clone <repo-url> /tmp/routine/<repo-name>
```

Then for each cloned repo, spawn a **Repo Agent** (sub-agent) with its own isolated context. All agents run simultaneously.

Read `references/repo-agent.md` for the Repo Agent prompt template.

## Phase 1: Foundation (per repo)

1. Check for `CLAUDE.md` at root
   - Missing → create from template in `references/claude-md-template.md`
   - Exists but >100 lines → refactor to under 100 lines
2. Check `.gitignore` — must exclude `.env`, `node_modules`, `*.pem`, `*.key`
3. Check `.claude/skills/` exists — create if missing

## Phase 2: AI-Firstify Audit (per repo)

Run the 7-dimension check. Read `references/audit-dimensions.md` for scoring criteria.

Score each dimension 1–5. Log findings in `references/last-audit.md`.

Key checks:
- **P5** (Don't Build Agents): grep for direct LLM API calls in frontend/client code
- **P2** (Narrow Scope): CLAUDE.md line count, skill step count
- **P3** (Build for Yourself): auth/multi-user systems in personal tools?
- **P6** (Context Hygiene): CLAUDE.md focused? Skills use progressive disclosure?

## Phase 3: New User UX Walk-Through (per repo)

Act as a brand-new user with no prior context. For web apps:

1. Land on the page — what's the first thing you see? Is it clear?
2. Try every button and link — log dead interactions
3. Try the primary user flow (the #1 thing the app does) — does it work end-to-end?
4. Check mobile layout at 375px
5. Check nav/wayfinding — can you find everything?

Read `references/ux-checklist.md` for the full walk-through checklist.

## Phase 4: Fix Execution (per repo)

Prioritize fixes by impact:

| Priority | Type | Examples |
|---|---|---|
| 🔴 Critical | Broken functionality | Dead buttons, broken layout, scroll bugs |
| 🟡 High | UX friction | Missing mobile nav, confusing copy, no feedback |
| 🟢 Medium | Polish | CLAUDE.md missing, link text not readable |

Fix in order. For each fix: describe what was wrong → what was changed → why.

## Phase 5: Report

After all repos are processed, output a unified report using `references/report-template.md`.

Structure:
- Repo name + URL
- AI-firstify scores (7 dimensions, 1–5)
- Critical fixes applied
- High/medium fixes applied  
- Still needs human decision (architectural choices, scope questions)
- Recommended next steps

## Running on Multiple Repos

The routine is designed to fan out. When given N repos:
1. Phase 0 runs sequentially (clone in parallel)
2. Phases 1–4 run as independent sub-agents per repo
3. Phase 5 aggregates all results into one report

To add a new repo to the rotation, just pass its URL — no architecture changes needed.
