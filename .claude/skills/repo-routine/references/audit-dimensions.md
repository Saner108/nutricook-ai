# AI-Firstify Audit Dimensions

Score each 1 (failing) to 5 (excellent).

## D1: Foundation
- CLAUDE.md exists and under 100 lines: +2
- .gitignore excludes .env, node_modules, keys: +1
- .claude/skills/ exists with at least one skill: +1
- Git history is clean (no credentials, no huge binary files): +1

## D2: De-agentification (P5)
- No direct LLM API calls in frontend/client code: +3
- Backend proxy pattern used for AI calls: +1
- No custom agent frameworks (langchain, crewai, autogen): +1

## D3: Scope Clarity (P2)
- Single clear purpose, no feature creep: +2
- CLAUDE.md describes one product/tool: +1
- Skills are single-purpose (not multi-concern): +2

## D4: Context Hygiene (P6)
- CLAUDE.md focused, under 100 lines: +2
- Reference material in separate files, not inlined: +1
- Skills use progressive disclosure: +2

## D5: Safety (P1)
- No credentials in source files: +2
- Human-in-the-loop before any external writes: +1
- Validation scripts for critical operations: +1
- Read-only access where possible: +1

## D6: Workflow Structure (P4, P8)
- Skills exist for repeated workflows: +2
- Sub-agents used for parallel work: +1
- Feedback loops (tests, validators): +2

## D7: UX & New User Experience (P9)
- Passes new user walk-through with no critical issues: +3
- All interactive elements have clear affordances: +1
- Mobile layout works at 375px: +1

## Notes on False Positives
- Frozen/legacy files (noted in CLAUDE.md) should be excluded from P5 and Safety checks
- Placeholder strings like `"sk-ant-api..."` in input hints are not real credentials
- Always cross-reference with CLAUDE.md "Frozen Contracts" section before flagging
