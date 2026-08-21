// Tests the pure extractRecipes helper that lives inside src/NutriCookAI_v2.tsx.
// NutriCookAI_v2.tsx contains JSX so it can't be imported by node directly; we lift the
// function's source text out and evaluate it. Run: node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function loadFn(name) {
  const src = readFileSync(fileURLToPath(new URL("../artifacts/NutriCookAI_v2.tsx", import.meta.url)), "utf8");
  const match = src.match(new RegExp(`(?:async )?function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`));
  assert.ok(match, `${name} not found in NutriCookAI_v2.tsx`);
  return new Function(`${match[0]}; return ${name};`)();
}
const loadExtractRecipes = () => loadFnWith("extractRecipes", ["sanitizeMacros"]);

// like loadFn but also pulls in helper functions the target calls
function loadFnWith(name, deps) {
  const src = readFileSync(fileURLToPath(new URL("../artifacts/NutriCookAI_v2.tsx", import.meta.url)), "utf8");
  const parts = [name, ...deps].map(n => {
    const m = src.match(new RegExp(`(?:async )?function ${n}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`));
    assert.ok(m, `${n} not found in NutriCookAI_v2.tsx`);
    return m[0];
  });
  return new Function(`${parts.join("\n")}; return ${name};`)();
}

const r1 = { name: "Chicken Stir-Fry", difficulty: "Easy", prepTime: "15 min", servings: 2, macros: { calories: 450, protein: 42, carbs: 30, fat: 16 }, steps: ["Heat oil", "Cook chicken"] };
const r2 = { name: "Rice Bowl {spicy}", difficulty: "Medium", prepTime: "20 min", servings: 2, macros: { calories: 500, protein: 35, carbs: 60, fat: 12 }, steps: ["Cook rice"] };

test("extractRecipes: mid-stream, finished recipes parse and in-progress recipe yields partial name", () => {
  const extractRecipes = loadExtractRecipes();
  const full = JSON.stringify({ recipes: [r1, r2] });
  // cut inside recipe 2, after its name
  const cut = full.indexOf('"difficulty"', full.indexOf("Rice Bowl"));
  const { complete, partialName } = extractRecipes(full.slice(0, cut));
  assert.equal(complete.length, 1);
  assert.deepEqual(complete[0], r1);
  assert.equal(partialName, "Rice Bowl {spicy}"); // braces inside strings must not confuse depth tracking
});

test("readSSEText: accumulates text deltas across arbitrary chunk boundaries", async () => {
  const readSSEText = loadFn("readSSEText");
  const enc = new TextEncoder();
  const sse =
    'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hel"}}\n\n' +
    'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"lo"}}\n\n' +
    'data: {"type":"message_stop"}\n\n';
  // split mid-JSON to prove line buffering works
  const chunks = [sse.slice(0, 45), sse.slice(45)].map(s => enc.encode(s));
  let i = 0;
  const reader = { read: async () => (i < chunks.length ? { done: false, value: chunks[i++] } : { done: true }) };
  const calls = [];
  const final = await readSSEText(reader, t => calls.push(t));
  assert.equal(final, "Hello");
  assert.deepEqual(calls, ["Hel", "Hello"]);
});

test("streamRecipes: streams the request, reports progressive updates, resolves with all recipes", async () => {
  const streamRecipes = loadFnWith("streamRecipes", ["readSSEText", "extractRecipes"]);
  const payload = JSON.stringify({ recipes: [r1, r2] });
  const mk = s => `data: ${JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: s } })}\n\n`;
  const sse = mk(payload.slice(0, 30)) + mk(payload.slice(30));
  const enc = new TextEncoder();
  let sent = false;
  const reader = { read: async () => (sent ? { done: true } : ((sent = true), { done: false, value: enc.encode(sse) })) };
  const fetchFn = async (url, opts) => {
    assert.equal(JSON.parse(opts.body).stream, true);
    return { ok: true, body: { getReader: () => reader } };
  };
  const updates = [];
  const recipes = await streamRecipes("sk-ant-test", "prompt", u => updates.push(u), fetchFn);
  assert.equal(recipes.length, 2);
  assert.deepEqual(recipes[1], r2);
  assert.ok(updates.length >= 1, "expected progressive updates during the stream");
});

// Component glue is not unit-testable without a DOM test stack, which this
// project deliberately doesn't carry. This source-level contract pins the
// wiring: the AI screen must generate via the tested streamRecipes pipeline.
test("generate flow: AIScreen delegates to streamRecipes and renders progressive updates", () => {
  const src = readFileSync(fileURLToPath(new URL("../artifacts/NutriCookAI_v2.tsx", import.meta.url)), "utf8");
  assert.match(src, /await streamRecipes\([^,]*, prompt/, "generate must call streamRecipes");
  assert.match(src, /setStreamName\(partialName\)/, "streaming updates must drive the skeleton name");
  assert.doesNotMatch(src, /const data = await res\.json\(\);\s*if \(data\.error\)/, "old non-streaming fetch parsing must be gone");
});

test("results screen: skeleton card renders while streaming, showing partial recipe name", () => {
  const src = readFileSync(fileURLToPath(new URL("../artifacts/NutriCookAI_v2.tsx", import.meta.url)), "utf8");
  assert.match(src, /loading && recipes\.length < 3 &&/, "skeleton must show only while streaming with recipes pending");
  assert.match(src, /\{streamName\}/, "skeleton must render the live partial recipe name");
});

test("extractRecipes: escaped quotes inside strings don't break parsing", () => {
  const extractRecipes = loadExtractRecipes();
  const { complete } = extractRecipes('{"recipes":[{"name":"Say \\"yum\\"","macros":{"calories":400,"protein":30,"carbs":40,"fat":10},"steps":["a"]},');
  assert.equal(complete.length, 1);
  assert.equal(complete[0].name, 'Say "yum"');
});

// ── getMealSteps ─────────────────────────────────────────────────────────────

const getMealSteps = loadFn("getMealSteps");

test("getMealSteps: Breakfast yogurt gets bowl instructions, not pan-fry", () => {
  const steps = getMealSteps({ type: "Breakfast", name: "Greek Yogurt & Berries" });
  assert.match(steps, /bowl|scoop|cold/i, "yogurt should get bowl-style steps");
  assert.doesNotMatch(steps, /heat pan|cook.*minut/i, "yogurt must not get pan-fry steps");
});

test("getMealSteps: Breakfast toast gets toast instructions", () => {
  const steps = getMealSteps({ type: "Breakfast", name: "Egg & Avocado Toast" });
  assert.match(steps, /toast/i, "toast dish should reference toasting");
});

test("getMealSteps: Breakfast egg/omelette gets egg-specific steps", () => {
  const steps = getMealSteps({ type: "Breakfast", name: "Veggie Omelette" });
  assert.match(steps, /whisk|non-stick|fold/i, "egg dish should get egg-cooking steps");
});

test("getMealSteps: Snack yogurt gets cold/no-cook steps", () => {
  const steps = getMealSteps({ type: "Snack", name: "Cottage Cheese & Pineapple" });
  assert.match(steps, /No cooking|bowl|cold/i, "snack should not require cooking");
});

test("getMealSteps: Snack protein shake gets blender steps", () => {
  const steps = getMealSteps({ type: "Snack", name: "Protein Smoothie Bowl" });
  assert.match(steps, /blender|blend/i, "smoothie should reference blender");
});

test("getMealSteps: salmon gets fish-specific cooking steps", () => {
  const steps = getMealSteps({ type: "Dinner", name: "Salmon & Quinoa" });
  assert.match(steps, /fish|fillet|flake/i, "salmon should get fish-specific steps");
  assert.doesNotMatch(steps, /Heat pan over medium heat\. Add oil and cook/i, "must not get generic steps");
});

test("getMealSteps: chicken gets sear/internal-temp instructions", () => {
  const steps = getMealSteps({ type: "Lunch", name: "Grilled Chicken Breast" });
  assert.match(steps, /chicken|165|sear/i, "chicken should get chicken-specific steps");
});

test("getMealSteps: bowl/rice dish gets grain cooking instructions", () => {
  const steps = getMealSteps({ type: "Lunch", name: "Beef & Broccoli Rice Bowl" });
  assert.match(steps, /grain|rice|quinoa|base/i, "bowl should reference grain cooking");
});

test("getMealSteps: wrap/taco gets tortilla warming steps", () => {
  const steps = getMealSteps({ type: "Dinner", name: "Chicken Fajita Wraps" });
  assert.match(steps, /tortilla|wrap/i, "wrap dish should reference tortilla");
});

test("getMealSteps: returns a non-empty string for any input", () => {
  const unknown = getMealSteps({ type: "Dinner", name: "Mystery Casserole XYZ123" });
  assert.ok(typeof unknown === "string" && unknown.length > 10, "fallback must return a usable string");
});
