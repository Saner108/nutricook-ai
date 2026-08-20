#!/bin/bash
# audit-repo.sh: Quick automated checks on a cloned repo
# Usage: ./audit-repo.sh <repo-path>

REPO="${1:-.}"
NAME=$(basename "$REPO")

echo "=============================="
echo "AUDIT: $NAME"
echo "=============================="

# Foundation checks
echo ""
echo "── Foundation ──"
[ -f "$REPO/CLAUDE.md" ] && echo "✓ CLAUDE.md exists ($(wc -l < "$REPO/CLAUDE.md") lines)" || echo "✗ CLAUDE.md MISSING"
[ -f "$REPO/.gitignore" ] && echo "✓ .gitignore exists" || echo "✗ .gitignore MISSING"
[ -d "$REPO/.claude/skills" ] && echo "✓ .claude/skills/ exists" || echo "✗ .claude/skills/ MISSING"

# De-agentification check  
echo ""
echo "── De-agentification (P5) ──"
DIRECT_LLM=$(grep -rn "anthropic\.com/v1\|openai\.com/v1" "$REPO/src" "$REPO/app" "$REPO/client" 2>/dev/null | grep -v "api/\|proxy\|server\|test\|\.md" | wc -l)
if [ "$DIRECT_LLM" -gt 0 ]; then
  echo "⚠️  $DIRECT_LLM direct LLM calls found in client code:"
  grep -rn "anthropic\.com/v1\|openai\.com/v1" "$REPO/src" "$REPO/app" "$REPO/client" 2>/dev/null | grep -v "api/\|proxy\|server\|test\|\.md" | head -5
else
  echo "✓ No direct LLM API calls in client code"
fi

# Credential check
echo ""
echo "── Safety (P1) ──"
CREDS=$(grep -rn "sk-ant\|sk-proj\|SUPABASE_SERVICE_ROLE\|stripe_secret" "$REPO/src" "$REPO/app" 2>/dev/null | grep -v "\.env\|example\|placeholder\|test\|your-" | wc -l)
if [ "$CREDS" -gt 0 ]; then
  echo "🔴 Potential credentials in source files!"
else
  echo "✓ No credentials detected in source"
fi

# Context hygiene
echo ""
echo "── Context Hygiene (P6) ──"
if [ -f "$REPO/CLAUDE.md" ]; then
  LINES=$(wc -l < "$REPO/CLAUDE.md")
  [ "$LINES" -le 100 ] && echo "✓ CLAUDE.md is $LINES lines (good)" || echo "⚠️  CLAUDE.md is $LINES lines (trim to <100)"
fi

# Tech stack detection
echo ""
echo "── Tech Stack ──"
[ -f "$REPO/package.json" ] && echo "Node.js: $(node -e "const p=require('$REPO/package.json'); console.log(Object.keys({...p.dependencies,...p.devDependencies}).slice(0,6).join(', '))" 2>/dev/null)"
[ -f "$REPO/requirements.txt" ] && echo "Python deps: $(wc -l < "$REPO/requirements.txt") packages"

echo ""
echo "── File Count ──"
find "$REPO/src" "$REPO/app" "$REPO/components" "$REPO/pages" 2>/dev/null -name "*.jsx" -o -name "*.tsx" -o -name "*.js" -o -name "*.ts" | grep -v node_modules | wc -l | xargs echo "Source files:"

echo ""
echo "=============================="
echo "AUDIT COMPLETE: $NAME"
echo "=============================="
