// Unit tests for parseIngredientInput and ingLabel.
// Importable directly since src/lib/ingredients.js has no JSX.
// Run: node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseIngredientInput, ingLabel } from "../src/lib/ingredients.js";

// ── parseIngredientInput ──────────────────────────────────────────────────────

test("prefix: '8 oz chicken breast' → qty=8 oz, name=chicken breast", () => {
  const r = parseIngredientInput("8 oz chicken breast");
  assert.equal(r.qty, "8 oz");
  assert.equal(r.name, "chicken breast");
});

test("prefix no space: '200g salmon' → qty=200g, name=salmon", () => {
  const r = parseIngredientInput("200g salmon");
  assert.equal(r.qty, "200g");
  assert.equal(r.name, "salmon");
});

test("prefix fraction: '1/2 cup oats' → qty=1/2 cup, name=oats", () => {
  const r = parseIngredientInput("1/2 cup oats");
  assert.equal(r.qty, "1/2 cup");
  assert.equal(r.name, "oats");
});

test("prefix decimal: '1.5 lb ground beef' → qty=1.5 lb, name=ground beef", () => {
  const r = parseIngredientInput("1.5 lb ground beef");
  assert.equal(r.qty, "1.5 lb");
  assert.equal(r.name, "ground beef");
});

test("prefix size word: '3 large eggs' → qty=3 large, name=eggs", () => {
  const r = parseIngredientInput("3 large eggs");
  assert.equal(r.qty, "3 large");
  assert.equal(r.name, "eggs");
});

test("prefix tbsp: '2 tbsp olive oil' → qty=2 tbsp, name=olive oil", () => {
  const r = parseIngredientInput("2 tbsp olive oil");
  assert.equal(r.qty, "2 tbsp");
  assert.equal(r.name, "olive oil");
});

test("prefix plural: '2 cups spinach' → qty=2 cups, name=spinach", () => {
  const r = parseIngredientInput("2 cups spinach");
  assert.equal(r.qty, "2 cups");
  assert.equal(r.name, "spinach");
});

test("no qty: plain 'chicken' → qty='', name=chicken", () => {
  const r = parseIngredientInput("chicken");
  assert.equal(r.qty, "");
  assert.equal(r.name, "chicken");
});

test("no qty: multi-word 'chicken breast' → qty='', name=chicken breast", () => {
  const r = parseIngredientInput("chicken breast");
  assert.equal(r.qty, "");
  assert.equal(r.name, "chicken breast");
});

test("trims and lowercases: '  Salmon  ' → name=salmon", () => {
  const r = parseIngredientInput("  Salmon  ");
  assert.equal(r.name, "salmon");
  assert.equal(r.qty, "");
});

test("trims and lowercases qty: '  8 OZ  Chicken  ' → qty=8 OZ, name=chicken", () => {
  const r = parseIngredientInput("  8 OZ Chicken  ");
  assert.equal(r.name, "chicken");
  assert.ok(r.qty, "qty should be present");
  assert.match(r.qty, /8/);
});

test("grams: '150g broccoli' → qty=150g, name=broccoli", () => {
  const r = parseIngredientInput("150g broccoli");
  assert.equal(r.qty, "150g");
  assert.equal(r.name, "broccoli");
});

test("whole: '1 whole avocado' → qty=1 whole, name=avocado", () => {
  const r = parseIngredientInput("1 whole avocado");
  assert.equal(r.qty, "1 whole");
  assert.equal(r.name, "avocado");
});

// ── ingLabel ─────────────────────────────────────────────────────────────────

test("ingLabel: with qty prepends it", () => {
  assert.equal(ingLabel({ qty: "8 oz", name: "chicken" }), "8 oz chicken");
});

test("ingLabel: without qty returns name only", () => {
  assert.equal(ingLabel({ qty: "", name: "eggs" }), "eggs");
});

test("ingLabel: null/undefined qty returns name", () => {
  assert.equal(ingLabel({ qty: null, name: "rice" }), "rice");
  assert.equal(ingLabel({ qty: undefined, name: "rice" }), "rice");
});

// ── saveRecipeToGrocery parsing contract (source-level) ──────────────────────
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

test("saveRecipeToGrocery: uses parseIngredientInput to split qty from name", () => {
  const src = readFileSync(
    fileURLToPath(new URL("../artifacts/NutriCookAI_v2.tsx", import.meta.url)), "utf8"
  );
  // Must call parseIngredientInput inside saveRecipeToGrocery
  const fn = src.slice(src.indexOf("saveRecipeToGrocery"), src.indexOf("saveRecipeToGrocery") + 900);
  assert.match(fn, /parseIngredientInput/, "saveRecipeToGrocery must call parseIngredientInput");
});

test("saveRecipeToGrocery: uses Date.now() * 1000 + i for collision-safe IDs", () => {
  const src = readFileSync(
    fileURLToPath(new URL("../artifacts/NutriCookAI_v2.tsx", import.meta.url)), "utf8"
  );
  const fn = src.slice(src.indexOf("saveRecipeToGrocery"), src.indexOf("saveRecipeToGrocery") + 900);
  assert.match(fn, /Date\.now\(\)\s*\*\s*1000/, "IDs must use Date.now() * 1000 to prevent index-offset collisions");
});

test("parseIngredientInput round-trip: claude ingredient strings parse correctly", () => {
  // Typical strings Claude returns in recipe.ingredients[]
  const cases = [
    ["1 lb chicken breast",    { qty: "1 lb",   name: "chicken breast" }],
    ["2 cups cooked rice",     { qty: "2 cups", name: "cooked rice" }],
    ["3 large eggs",           { qty: "3 large",name: "eggs" }],
    ["200g salmon fillet",     { qty: "200g",   name: "salmon fillet" }],
    ["1/2 cup Greek yogurt",   { qty: "1/2 cup",name: "greek yogurt" }],
    ["salt and pepper to taste",{ qty: "",      name: "salt and pepper to taste" }],
  ];
  for (const [input, expected] of cases) {
    const result = parseIngredientInput(input);
    assert.equal(result.name, expected.name, `name for '${input}'`);
    assert.equal(result.qty, expected.qty,   `qty for '${input}'`);
  }
});
