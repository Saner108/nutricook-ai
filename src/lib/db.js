// Frontend data-access layer over the RLS-protected Supabase client.
// Every function is a no-op-safe wrapper: callers only reach these when a live
// session exists. RLS guarantees a user can only ever read/write their own rows,
// so these queries never filter by user_id explicitly — auth.uid() does it.
import { supabase } from "./supabase.js";

const lbsFromKg = kg => Math.round((kg / 0.45359) * 10) / 10;

// ── Load everything for the signed-in user in one shot ────────────────────
export async function loadAll() {
  const [profile, weights, favorites, recipes, tryRows, grocery, meals, water, sub] = await Promise.all([
    supabase.from("profiles").select("*").single(),
    supabase.from("weight_logs").select("*").order("logged_on", { ascending: true }),
    supabase.from("favorites").select("*").order("id", { ascending: true }),
    supabase.from("recipes").select("*").order("created_at", { ascending: true }),
    supabase.from("try_list").select("recipe_id"),
    supabase.from("grocery_items").select("*").order("id", { ascending: true }),
    supabase.from("meal_logs").select("*").order("eaten_on", { ascending: false }),
    supabase.from("water_logs").select("*").eq("logged_on", new Date().toISOString().slice(0, 10)).maybeSingle(),
    supabase.from("subscriptions").select("*").maybeSingle(),
  ]);

  const tryIds = new Set((tryRows.data || []).map(r => r.recipe_id));
  const recipeById = new Map((recipes.data || []).map(r => [r.id, r]));
  return {
    profile: profile.data || null,
    weights: (weights.data || []).map(w => ({ d: fmtDay(w.logged_on), w: Number(w.weight_lbs), logged_on: w.logged_on })),
    favorites: favorites.data || [],
    recipes: recipes.data || [],
    tryList: [...tryIds].map(id => recipeById.get(id)).filter(Boolean).map(fromRecipeRow),
    grocery: (grocery.data || []).map(g => ({ id: g.id, name: g.name, qty: g.qty || "", cat: g.category, done: g.done })),
    mealLogs: meals.data || [],
    water: water.data?.glasses ?? 0,
    sub: sub.data || null,
  };
}

function fmtDay(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function fromRecipeRow(r) {
  return { id: r.id, name: r.name, difficulty: r.difficulty, prepTime: r.prep_time, servings: r.servings,
    macros: r.macros, ingredients: r.ingredients || [], steps: r.steps || [] };
}

// ── Profile ───────────────────────────────────────────────────────────────
export async function updateProfile(patch) {
  const { data: u } = await supabase.auth.getUser();
  await supabase.from("profiles").update(patch).eq("id", u.user.id);
}

// ── Weight ────────────────────────────────────────────────────────────────
export async function logWeight(weightLbs) {
  const { data: u } = await supabase.auth.getUser();
  const logged_on = new Date().toISOString().slice(0, 10);
  await supabase.from("weight_logs").upsert(
    { user_id: u.user.id, logged_on, weight_lbs: weightLbs },
    { onConflict: "user_id,logged_on" }
  );
}

// ── Favorites (snapshot keyed by name) ────────────────────────────────────
export async function addFavorite(meal) {
  const { data: u } = await supabase.auth.getUser();
  await supabase.from("favorites").upsert(
    { user_id: u.user.id, name: meal.name, emoji: meal.emoji, kcal: meal.kcal, protein: meal.protein, carbs: meal.carbs, fat: meal.fat },
    { onConflict: "user_id,name" }
  );
}
export async function removeFavorite(name) {
  await supabase.from("favorites").delete().eq("name", name);
}

// ── Save an AI recipe: recipes + try_list + grocery rows ──────────────────
// shortcut: retries reuse confirmed IDs only; add server idempotency to resolve lost insert responses.
export async function saveRecipe(recipe, groceryToAdd, savedId = null) {
  let id = savedId;
  try {
    const auth = await supabase.auth.getUser();
    if (auth.error || !auth.data?.user) return { data: { id }, error: auth.error || { message: "Please sign in again." } };
    const uid = auth.data.user.id;
    if (!id) {
      const result = await supabase.from("recipes").insert({
        user_id: uid, name: recipe.name, difficulty: recipe.difficulty, prep_time: recipe.prepTime,
        servings: recipe.servings, macros: recipe.macros, ingredients: recipe.ingredients || [], steps: recipe.steps || [],
      }).select("id").single();
      if (result.error) return { data: { id }, error: result.error };
      id = result.data?.id;
      if (!id) return { data: { id: null }, error: { message: "Recipe save wasn't confirmed. Please retry." } };
    }
    const result = await supabase.from("try_list").upsert({ user_id: uid, recipe_id: id }, { onConflict: "user_id,recipe_id" });
    if (result.error) return { data: { id }, error: { ...result.error, message: `Recipe saved, but Want to Try failed: ${result.error.message}` } };
    let grocery = [];
    if (groceryToAdd?.length) {
      const result = await supabase.from("grocery_items").insert(
        groceryToAdd.map(g => ({ user_id: uid, name: g.name, qty: g.qty || "", category: g.cat || "From Recipes", done: false, source: "recipe" }))
      ).select("*");
      if (result.error) return { data: { id }, error: { ...result.error, message: `Recipe saved, but Basket failed: ${result.error.message}` } };
      if (result.data?.length !== groceryToAdd.length) return { data: { id }, error: { message: "Basket save wasn't confirmed. Please reload before retrying." } };
      grocery = result.data.map(g => ({ id: g.id, name: g.name, qty: g.qty || "", cat: g.category, done: g.done }));
    }
    return { data: { id, grocery }, error: null };
  } catch (error) {
    return { data: { id }, error };
  }
}
export async function removeTryList(name) {
  const { data: rows } = await supabase.from("recipes").select("id").eq("name", name);
  const ids = (rows || []).map(r => r.id);
  if (ids.length) await supabase.from("try_list").delete().in("recipe_id", ids);
}

// ── Grocery ───────────────────────────────────────────────────────────────
export async function addGrocery(item) {
  try {
    const auth = await supabase.auth.getUser();
    if (auth.error || !auth.data?.user) return { data: null, error: auth.error || { message: "Please sign in again." } };
    const result = await supabase.from("grocery_items").insert({
      user_id: auth.data.user.id, name: item.name, qty: item.qty || "", category: item.cat || "Other", done: false, source: "manual",
    }).select("id").single();
    if (result.error) return result;
    if (!result.data?.id) return { data: null, error: { message: "Basket save wasn't confirmed. Please retry." } };
    return { data: { ...item, id: result.data.id }, error: null };
  } catch (error) {
    return { data: null, error };
  }
}
export async function toggleGrocery(id, done) {
  try {
    return await supabase.from("grocery_items").update({ done }).eq("id", id).select("id").single();
  } catch (error) {
    return { data: null, error };
  }
}

// ── Water ─────────────────────────────────────────────────────────────────
export async function setWaterGlasses(glasses) {
  const { data: u } = await supabase.auth.getUser();
  const logged_on = new Date().toISOString().slice(0, 10);
  await supabase.from("water_logs").upsert(
    { user_id: u.user.id, logged_on, glasses },
    { onConflict: "user_id,logged_on" }
  );
}

// ── Meal logging (builds real history + streak) ───────────────────────────
export async function markMeal(meal, done) {
  const { data: u } = await supabase.auth.getUser();
  const eaten_on = new Date().toISOString().slice(0, 10);
  await supabase.from("meal_logs").upsert(
    { user_id: u.user.id, eaten_on, slot: meal.type, name: meal.name, emoji: meal.emoji,
      kcal: meal.kcal, protein: meal.protein, carbs: meal.carbs, fat: meal.fat, done },
    { onConflict: "user_id,eaten_on,slot" }
  );
}

// Seed a starter grocery list + starter weight on first login.
// Grocery rows and the weight log are independent writes (different tables,
// neither depends on the other's result) so they run in parallel.
export async function seedStarter(starterGrocery, startWeightLbs) {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user.id;
  await Promise.all([
    starterGrocery?.length
      ? supabase.from("grocery_items").insert(
          starterGrocery.map(g => ({ user_id: uid, name: g.name, qty: g.qty || "", category: g.cat || "Other", done: !!g.done, source: "seed" }))
        )
      : Promise.resolve(),
    startWeightLbs
      ? supabase.from("weight_logs").upsert(
          { user_id: uid, logged_on: new Date().toISOString().slice(0, 10), weight_lbs: startWeightLbs },
          { onConflict: "user_id,logged_on" }
        )
      : Promise.resolve(),
  ]);
}

export { lbsFromKg };
