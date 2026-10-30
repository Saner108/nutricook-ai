import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseIngredientInput, ingLabel } from "../src/lib/ingredients.js";

const appSource = readFileSync(new URL("../artifacts/NutriCookAI_v2.tsx", import.meta.url), "utf8");
const dbSource = readFileSync(new URL("../src/lib/db.js", import.meta.url), "utf8");
const recipe = { name: "Rice Bowl", servings: 2, macros: { calories: 400 }, ingredients: ["1 cup rice"], steps: ["Cook rice"] };
const ingredient = { id: 999999, name: "Rice", qty: "1 cup", cat: "From Recipes", done: false };
const groceryRow = { id: 83, name: "Rice", qty: "1 cup", category: "From Recipes", done: false };

function mockDatabase(plan, auth = { data: { user: { id: "user-1" } }, error: null }) {
  const calls = [];
  const supabase = {
    auth: { getUser: async () => auth },
    from(table) {
      const call = { table };
      const execute = async () => {
        calls.push(call);
        const expected = plan.shift();
        assert.ok(expected, `Unexpected ${table} write`);
        assert.equal(table, expected.table);
        assert.equal(call.operation, expected.operation);
        if (expected.reject) throw expected.reject;
        return expected.result;
      };
      const query = {
        insert(value) { Object.assign(call, { operation: "insert", value }); return query; },
        upsert(value, options) { Object.assign(call, { operation: "upsert", value, options }); return query; },
        update(value) { Object.assign(call, { operation: "update", value }); return query; },
        eq(column, value) { call.filter = { column, value }; return query; },
        select() { return query; },
        single: execute,
        then(resolve, reject) { return execute().then(resolve, reject); },
      };
      return query;
    },
  };
  const source = dbSource.replace(/^import .*;$/m, "").replace(/export async function/g, "async function").replace(/export \{ lbsFromKg \};/, "");
  const db = new Function("supabase", `${source}; return { saveRecipe, addGrocery, toggleGrocery };`)(supabase);
  return { db, calls, done: () => assert.equal(plan.length, 0) };
}

function callback(name, endMarker, scope, within = "") {
  const start = appSource.indexOf(`  const ${name} =`, appSource.indexOf(within));
  const end = appSource.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `${name} callback not found`);
  return new Function(...Object.keys(scope), `${appSource.slice(start, end)}; return ${name};`)(...Object.values(scope));
}

function helper(name, scope) {
  const match = appSource.match(new RegExp(`async function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`));
  assert.ok(match, `${name} helper not found`);
  return new Function(...Object.keys(scope), `${match[0]}; return ${name};`)(...Object.values(scope));
}

const success = data => ({ data, error: null });
const failure = message => ({ data: null, error: { message } });
const write = (table, operation, result) => ({ table, operation, result });

function authHarness({ initial, profiles = [], loads = [] } = {}) {
  const start = appSource.indexOf('  const [phase, setPhase]', appSource.indexOf('export default function NutriCookApp'));
  const end = appSource.indexOf('\n  // Theme the pre-app screens', start);
  assert.ok(start >= 0 && end > start);
  const slots = [];
  let cursor;
  let dirty;
  let view;
  let listener;
  let insideCallback = false;
  let reads = 0;
  let unsubscribed = 0;
  let pendingEffects;
  const scope = {
    useState(initialValue) {
      const position = cursor++;
      if (!slots[position]) slots[position] = { value: initialValue };
      return [slots[position].value, value => {
        if (!Object.is(slots[position].value, value)) { slots[position].value = value; dirty = true; }
      }];
    },
    useRef(value) {
      const position = cursor++;
      if (!slots[position]) slots[position] = { current: value };
      return slots[position];
    },
    useEffect(setup, deps) {
      const position = cursor++;
      const previous = slots[position];
      if (!previous || deps.some((dep, index) => !Object.is(dep, previous.deps[index]))) {
        const effect = { deps, cleanup: null };
        slots[position] = effect;
        pendingEffects.push(() => { previous?.cleanup?.(); effect.cleanup = setup(); });
      }
    },
    supabase: {
      auth: {
        getSession: async () => initial || success({ session: null }),
        onAuthStateChange(callback) {
          listener = callback;
          return { data: { subscription: { unsubscribe: () => { unsubscribed++; } } } };
        },
      },
      from() {
        assert.equal(insideCallback, false, "database reads must run outside auth callbacks");
        reads++;
        return { select: () => ({ maybeSingle: async () => profiles.shift() || success({ onboarded: true }) }) };
      },
    },
    db: { loadAll: async () => loads.shift() || { profile: { name: "Signed in" } } },
  };
  const component = new Function(...Object.keys(scope), `${appSource.slice(start, end)}; return { phase, session, boot, bootstrap };`);
  const render = () => {
    cursor = 0; dirty = false; pendingEffects = [];
    view = component(...Object.values(scope));
    pendingEffects.forEach(run => run());
  };
  render();
  return {
    get view() { return view; }, get reads() { return reads; }, get unsubscribed() { return unsubscribed; },
    emit(event, session) { insideCallback = true; listener(event, session); insideCallback = false; },
    async flush() {
      for (let attempt = 0; attempt < 12; attempt++) {
        await new Promise(resolve => setImmediate(resolve));
        if (!dirty) return;
        render();
      }
      assert.fail("auth effects did not settle");
    },
    unmount() { slots.forEach(slot => slot.cleanup?.()); dirty = false; },
  };
}

test("sign-in after an initial empty session bootstraps outside the auth listener", async () => {
  const auth = authHarness();
  await auth.flush();
  assert.equal(auth.view.phase, "auth");
  assert.equal(auth.reads, 0);
  const session = { user: { id: "user-1" } };
  auth.emit("SIGNED_IN", session);
  assert.equal(auth.reads, 0);
  await auth.flush();
  assert.equal(auth.view.phase, "ready");
  assert.equal(auth.view.session, session);
  assert.equal(auth.reads, 1);
  auth.emit("TOKEN_REFRESHED", { ...session, access_token: "refreshed" });
  await auth.flush();
  assert.equal(auth.view.phase, "ready");
  assert.equal(auth.reads, 1);
  auth.unmount();
  assert.equal(auth.unsubscribed, 1);
});

test("a stale initial session read cannot undo a newer sign-in", async () => {
  let resolveInitial;
  const auth = authHarness({ initial: new Promise(resolve => { resolveInitial = resolve; }) });
  auth.emit("SIGNED_IN", { user: { id: "user-1" } });
  await auth.flush();
  assert.equal(auth.view.phase, "ready");
  resolveInitial(success({ session: null }));
  await auth.flush();
  assert.equal(auth.view.phase, "ready");
  assert.equal(auth.view.session.user.id, "user-1");
  auth.unmount();
});

for (const stage of ["profile", "loadAll"]) {
  test(`sign-out invalidates an in-flight ${stage} bootstrap`, async () => {
    let resolvePending;
    const pending = new Promise(resolve => { resolvePending = resolve; });
    const auth = authHarness(stage === "profile" ? { profiles: [pending] } : { loads: [pending] });
    await auth.flush();
    auth.emit("SIGNED_IN", { user: { id: "user-1" } });
    await auth.flush();
    auth.emit("SIGNED_OUT", null);
    await auth.flush();
    resolvePending(stage === "profile" ? success({ onboarded: true }) : { profile: { name: "Old user" } });
    await auth.flush();
    assert.equal(auth.view.phase, "auth");
    assert.equal(auth.view.boot, null);
    auth.unmount();
  });
}

test("switching users rejects stale boot data from the previous session", async () => {
  let resolveOld;
  const auth = authHarness({ loads: [new Promise(resolve => { resolveOld = resolve; }), { profile: { name: "New user" } }] });
  await auth.flush();
  auth.emit("SIGNED_IN", { user: { id: "old" } });
  await auth.flush();
  auth.emit("SIGNED_IN", { user: { id: "new" } });
  await auth.flush();
  resolveOld({ profile: { name: "Old user" } });
  await auth.flush();
  assert.equal(auth.view.phase, "ready");
  assert.equal(auth.view.boot.profile.name, "New user");
  assert.equal(auth.view.session.user.id, "new");
  auth.unmount();
});

test("recipe insert errors stop dependent writes and reach the caller", async () => {
  const mock = mockDatabase([write("recipes", "insert", failure("insert denied"))]);
  const result = await mock.db.saveRecipe(recipe, [ingredient]);
  assert.equal(result.error.message, "insert denied");
  assert.equal(result.data.id, null);
  assert.equal(mock.calls.length, 1);
  mock.done();
});

test("AI-provided IDs cannot skip inserting a new recipe", async () => {
  const mock = mockDatabase([
    write("recipes", "insert", success({ id: 42 })),
    write("try_list", "upsert", success(null)),
  ]);
  const result = await mock.db.saveRecipe({ ...recipe, id: 999 }, []);
  assert.equal(result.data.id, 42);
  assert.equal(result.error, null);
  assert.equal(mock.calls[1].value.recipe_id, 42);
  mock.done();
});

for (const stage of ["try_list", "grocery_items"]) {
  test(`retry after ${stage} failure reuses the recipe ID`, async () => {
    const plan = [write("recipes", "insert", success({ id: 42 }))];
    if (stage === "grocery_items") plan.push(write("try_list", "upsert", success(null)));
    plan.push(write(stage, stage === "try_list" ? "upsert" : "insert", failure("temporarily unavailable")));
    plan.push(write("try_list", "upsert", success(null)), write("grocery_items", "insert", success([groceryRow])));
    const mock = mockDatabase(plan);
    const first = await mock.db.saveRecipe(recipe, [ingredient]);
    assert.ok(first.error);
    assert.equal(first.data.id, 42);
    const retry = await mock.db.saveRecipe(recipe, [ingredient], first.data.id);
    assert.equal(retry.error, null);
    assert.equal(retry.data.grocery[0].id, 83);
    assert.equal(mock.calls.filter(call => call.table === "recipes").length, 1);
    assert.equal(mock.calls.at(-1).value[0].id, undefined);
    mock.done();
  });
}

test("auth and transport errors use the returned error contract", async () => {
  const auth = mockDatabase([], failure("session expired"));
  assert.equal((await auth.db.saveRecipe(recipe, [])).error.message, "session expired");
  assert.equal((await auth.db.addGrocery(ingredient)).error.message, "session expired");
  assert.equal(auth.calls.length, 0);
  const offline = mockDatabase([{ table: "recipes", operation: "insert", reject: new Error("offline") }]);
  assert.equal((await offline.db.saveRecipe(recipe, [])).error.message, "offline");
  offline.done();
});

test("manual groceries return real IDs and toggles use those IDs", async () => {
  const mock = mockDatabase([
    write("grocery_items", "insert", success({ id: 17 })),
    write("grocery_items", "update", success({ id: 17 })),
  ]);
  const added = await mock.db.addGrocery(ingredient);
  assert.equal(added.data.id, 17);
  assert.equal(added.data.name, "Rice");
  assert.equal((await mock.db.toggleGrocery(added.data.id, true)).error, null);
  assert.deepEqual(mock.calls[1].filter, { column: "id", value: 17 });
  mock.done();
});

test("grocery errors are returned instead of silently confirming changes", async () => {
  const mock = mockDatabase([
    write("grocery_items", "insert", failure("insert denied")),
    write("grocery_items", "update", failure("no matching row")),
  ]);
  assert.equal((await mock.db.addGrocery(ingredient)).error.message, "insert denied");
  assert.equal((await mock.db.toggleGrocery(999999, true)).error.message, "no matching row");
  mock.done();
});

test("save coordinator waits, retains partial IDs, and only publishes confirmed rows", async () => {
  const mock = mockDatabase([
    write("recipes", "insert", success({ id: 42 })),
    write("try_list", "upsert", success(null)),
    write("grocery_items", "insert", failure("basket denied")),
    write("try_list", "upsert", success(null)),
    write("grocery_items", "insert", success([groceryRow])),
  ]);
  let groceries = [];
  let tryList = [];
  const save = callback("onSaveRecipe", "\n  const removeFavorite", {
    live: true, db: mock.db, recipeSaves: { current: new Map() },
    recipeSaveQueue: { current: Promise.resolve() }, confirmedGroceryNames: { current: new Set() },
    saveRecipeToGrocery: () => [ingredient],
    setTryList: update => { update(tryList); tryList = update(tryList); },
    setGroceryItems: update => { update(groceries); groceries = update(groceries); },
  });
  const first = save(recipe);
  assert.equal(save(recipe), first);
  assert.deepEqual(groceries, []);
  assert.deepEqual(tryList, []);
  assert.ok((await first).error);
  assert.deepEqual(groceries, []);
  assert.deepEqual(tryList, []);
  assert.equal((await save(recipe)).error, null);
  assert.equal(tryList[0].id, 42);
  assert.equal(groceries[0].id, 83);
  assert.equal(mock.calls.filter(call => call.table === "recipes").length, 1);
  mock.done();
});

for (const partialFailure of [false, true]) {
  test(`overlapping saves share one confirmed grocery row; partial failure=${partialFailure}`, async () => {
    let resolveFirstInsert;
    const firstInsert = new Promise(resolve => { resolveFirstInsert = resolve; });
    const plan = [
      write("recipes", "insert", firstInsert),
      write("try_list", "upsert", success(null)),
      write("grocery_items", "insert", partialFailure ? failure("basket unavailable") : success([groceryRow])),
      write("recipes", "insert", success({ id: 43 })),
      write("try_list", "upsert", success(null)),
    ];
    if (partialFailure) plan.push(write("grocery_items", "insert", success([groceryRow])), write("try_list", "upsert", success(null)));
    const mock = mockDatabase(plan);
    let groceries = [];
    let tryList = [];
    const names = { current: new Set() };
    const prepare = callback("saveRecipeToGrocery", "\n  const toggleFavorite", {
      groceryItems: [], confirmedGroceryNames: names, parseIngredientInput,
    });
    const save = callback("onSaveRecipe", "\n  const removeFavorite", {
      live: true, db: mock.db, recipeSaves: { current: new Map() },
      recipeSaveQueue: { current: Promise.resolve() }, confirmedGroceryNames: names,
      saveRecipeToGrocery: prepare,
      setTryList: update => { update(tryList); tryList = update(tryList); },
      setGroceryItems: update => { update(groceries); groceries = update(groceries); },
    });
    const firstRecipe = { ...recipe, name: "Rice A" };
    const first = save(firstRecipe);
    const second = save({ ...recipe, name: "Rice B" });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(mock.calls.length, 1);
    resolveFirstInsert(success({ id: 42 }));
    const [firstResult, secondResult] = await Promise.all([first, second]);
    assert.equal(Boolean(firstResult.error), partialFailure);
    assert.equal(secondResult.error, null);
    if (partialFailure) assert.equal((await save(firstRecipe)).error, null);
    assert.deepEqual(groceries.map(item => [item.id, item.name]), [[83, "Rice"]]);
    assert.equal(tryList.length, 2);
    assert.equal(mock.calls.filter(call => call.table === "recipes").length, 2);
    assert.equal(mock.calls.filter(call => call.table === "grocery_items").length, partialFailure ? 2 : 1);
    mock.done();
  });
}

test("Save stays pending until persistence succeeds and remains retryable after error", async () => {
  let resolveSave;
  let saved = false;
  let saving = false;
  let error = null;
  let attempts = 0;
  const save = callback("save", "\n  const remix", {
    recipe, saved: false, remixing: false, savingRef: { current: false },
    setSaving: value => { saving = value; },
    setSaveErr: value => { error = value; },
    setSaved: value => { saved = value; },
    onSave: () => { attempts++; return new Promise(resolve => { resolveSave = resolve; }); },
  }, "function AICard");
  const first = save();
  await save();
  assert.equal(attempts, 1);
  assert.equal(saved, false);
  assert.equal(saving, true);
  resolveSave(failure("offline"));
  await first;
  assert.equal(saved, false);
  assert.equal(saving, false);
  assert.match(error, /offline.*retry/i);
  assert.deepEqual(recipe.steps, ["Cook rice"]);
  const retry = save();
  resolveSave(success({ id: 42 }));
  await retry;
  assert.equal(saved, true);
  assert.equal(error, null);
});

test("new grocery rows remain unavailable until their database IDs arrive", async () => {
  let resolveAdd;
  let items = [];
  let error;
  const add = callback("addItem", "\n  const active", {
    newItem: "rice", items, addingRef: { current: false },
    guessCategory: () => "Grains",
    onAdd: () => new Promise(resolve => { resolveAdd = resolve; }),
    setAdding: () => {}, setError: value => { error = value; }, setNewItem: () => {},
    setItems: update => { update(items); items = update(items); },
  }, "function GroceryScreen");
  const pending = add();
  assert.deepEqual(items, []);
  resolveAdd(success({ ...ingredient, id: 17 }));
  await pending;
  assert.equal(items[0].id, 17);
  assert.equal(error, null);
});

test("failed grocery toggles retain the previous state", async () => {
  let items = [{ ...ingredient, id: 17 }];
  let error;
  const toggle = callback("toggle", "\n  const addItem", {
    items, toggling: { current: new Set() },
    onToggle: async () => failure("offline"),
    setError: value => { error = value; },
    setItems: update => { items = update(items); },
  }, "function GroceryScreen");
  await toggle(17);
  assert.equal(items[0].done, false);
  assert.match(error, /retry/i);
});

test("configured API requests include the session Bearer token", async () => {
  let request;
  const apiFetch = helper("authenticatedFetch", {
    hasSupabase: true,
    supabase: { auth: { getSession: async () => success({ session: { access_token: "test-token" } }) } },
    fetch: async (url, options) => { request = { url, options }; return { ok: true }; },
  });
  await apiFetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" } });
  assert.equal(request.options.headers.Authorization, "Bearer test-token");
  assert.equal(request.options.headers["Content-Type"], "application/json");
});

for (const status of [402, 429]) {
  test(`streaming reports HTTP ${status} through its error result`, async () => {
    const stream = helper("streamRecipes", {});
    const result = await stream(null, "prompt", () => {}, async () => ({ ok: false, status, json: async () => ({ error: { message: "quota exhausted" } }) }));
    assert.equal(result.error.status, status);
    assert.match(result.error.message, status === 429 ? /wait.*retry/i : /quota exhausted/);
  });
}

test("oversized photos are rejected without an API request or quota change", () => {
  let error;
  let requested = false;
  const handle = callback("handleFridgePhoto", "\n\n  if (step", {
    setError: value => { error = value; },
    setScanning: () => { requested = true; },
  }, "function AIScreen");
  const event = { target: { files: [{ size: 5 * 1024 * 1024 }], value: "photo.jpg" } };
  handle(event);
  assert.match(error, /over 4MB/);
  assert.equal(requested, false);
  assert.equal(event.target.value, "");
});

for (const status of [402, 429]) {
  test(`generator HTTP ${status} shows an error and opens the paywall only for quota exhaustion`, async () => {
    let error;
    let step;
    let paywalls = 0;
    let requests = 0;
    const generate = callback("generate", "\n  const handleFridgePhoto", {
      loading: false, ingredients: [{ name: "rice", qty: "1 cup" }], prefs: [], servings: 2, goal: "Balanced", ingLabel,
      streamRecipes: helper("streamRecipes", {}),
      authenticatedFetch: async () => { requests++; return { ok: false, status, json: async () => ({ error: { message: "quota exhausted" } }) }; },
      setError: value => { error = value; }, setStep: value => { step = value; },
      setLoading: () => {}, setRecipes: () => {}, setStreamName: () => {},
      openPaywall: () => { paywalls++; },
    }, "function AIScreen");
    await generate();
    assert.equal(step, "input");
    assert.match(error, status === 429 ? /wait.*retry/i : /quota exhausted/);
    assert.equal(paywalls, status === 402 ? 1 : 0);
    await generate();
    assert.equal(requests, 2);
  });

  test(`fridge scan HTTP ${status} is retryable without charging a local quota`, async () => {
    let error;
    let scanning;
    let paywalls = 0;
    let requests = 0;
    const scan = callback("handleFridgePhoto", "\n\n  if (step", {
      downscaleImageToBase64: async () => "test-image",
      authenticatedFetch: async () => { requests++; return { ok: false, status, json: async () => ({ error: { message: "quota exhausted" } }) }; },
      setError: value => { error = value; }, setScanning: value => { scanning = value; },
      openPaywall: () => { paywalls++; },
    }, "function AIScreen");
    scan({ target: { files: [{ size: 1024 }], value: "photo.jpg" } });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(scanning, false);
    assert.match(error, status === 429 ? /wait.*retry/i : /quota exhausted/);
    assert.equal(paywalls, status === 402 ? 1 : 0);
    scan({ target: { files: [{ size: 1024 }], value: "photo.jpg" } });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests, 2);
  });
}

test("demo recipe groceries preserve quantities and deduplicate without writing state", () => {
  const prepare = callback("saveRecipeToGrocery", "\n  const toggleFavorite", {
    confirmedGroceryNames: { current: new Set() }, parseIngredientInput,
  });
  const items = prepare({ ingredients: ["1 cup rice", "2 cups rice"] });
  assert.equal(items.length, 1);
  assert.equal(items[0].name, "Rice");
  assert.equal(items[0].qty, "1 cup");
  assert.equal(typeof items[0].id, "number");
  assert.ok(items[0].id >= Date.now() * 1000 - 10000);
});

test("upgrade query parameters only refresh authoritative subscriptions, including effect replay", async () => {
  const start = appSource.indexOf("  useEffect(() => {\n    const sp = new URLSearchParams", appSource.indexOf("function MainApp"));
  const end = appSource.indexOf("\n  const startCheckout", start);
  assert.ok(start >= 0 && end > start);
  let effect;
  let pro = false;
  let subscription = null;
  let reads = 0;
  const timers = new Set();
  const page = { location: { search: "?upgraded=1", pathname: "/" }, history: { replaceState: () => { page.location.search = ""; } } };
  const scope = {
    useEffect: setup => { effect = setup; }, URLSearchParams, window: page,
    checkoutReturned: { current: false }, live: true,
    supabase: { from: () => ({ select: () => ({ maybeSingle: async () => { reads++; return success(subscription); } }) }) },
    setPro: value => { pro = value; }, isProActive: sub => sub?.status === "active",
    setTimeout: refresh => { timers.add(refresh); return refresh; }, clearTimeout: refresh => timers.delete(refresh),
  };
  new Function(...Object.keys(scope), appSource.slice(start, end))(...Object.values(scope));
  const cleanup = effect();
  cleanup();
  const replayCleanup = effect();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(pro, false);
  assert.equal(reads, 2);
  assert.equal(timers.size, 1);
  subscription = { status: "active" };
  await [...timers][0]();
  assert.equal(pro, true);
  replayCleanup();
  assert.equal(timers.size, 0);
});

for (const [live, response, expectedPro] of [
  [true, { ok: false, data: { error: { message: "unavailable" } } }, false],
  [true, { ok: true, data: { simulated: true } }, false],
  [false, { ok: true, data: {} }, false],
  [false, { ok: true, data: { simulated: true } }, true],
]) {
  test(`checkout live=${live}, response=${JSON.stringify(response)} grants Pro=${expectedPro}`, async () => {
    let pro = false;
    let error = null;
    let busy = false;
    const checkout = callback("startCheckout", "\n  const saveRecipeToGrocery", {
      live, checkoutBusy: false,
      authenticatedFetch: async () => ({ ok: response.ok, json: async () => response.data }),
      setCheckoutBusy: value => { busy = value; },
      setCheckoutError: value => { error = value; },
      setPro: value => { pro = value; }, setPaywall: () => {},
    });
    await checkout();
    assert.equal(pro, expectedPro);
    assert.equal(busy, false);
    assert.equal(Boolean(error), !expectedPro);
  });
}
