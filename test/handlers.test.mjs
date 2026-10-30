import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { registerHooks } from "node:module";
import { Readable } from "node:stream";

const SECRET = "whsec_handler_fixture";
const USER = "11111111-1111-4111-8111-111111111111";
const OTHER_USER = "22222222-2222-4222-8222-222222222222";
const SUBSCRIPTION = "sub_fixture";
const apiRoot = new URL("../api/", import.meta.url).href;
const textMessage = { role: "user", content: "Make a chicken recipe" };
const imageBlock = { type: "image", source: { type: "base64", media_type: "image/jpeg", data: "Zml4dHVyZQ==" } };
let importContext = 0;

function response() {
  return {
    statusCode: 200,
    headers: {},
    chunks: [],
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    setHeader(name, value) { this.headers[name] = value; },
    write(chunk) { this.chunks.push(String(chunk)); return true; },
    end(chunk) { if (chunk !== undefined) this.write(chunk); this.ended = true; },
  };
}

async function loadHandlers(context, { configured = true, secret = SECRET, fetchImpl } = {}) {
  process.env.SUPABASE_URL = configured ? "https://supabase.invalid" : "";
  process.env.SUPABASE_SERVICE_ROLE_KEY = configured ? "service-role-fixture" : "";
  process.env.SUPABASE_ANON_KEY = "anon-fixture";
  process.env.SUPABASE_JWT_SECRET = "";
  process.env.ANTHROPIC_API_KEY = "anthropic-fixture";
  process.env.STRIPE_WEBHOOK_SECRET = secret;
  process.env.RATE_LIMIT_PER_MINUTE = "20";
  const fetchMock = context.mock.method(globalThis, "fetch", fetchImpl || (() => assert.fail("Unexpected service call")));
  const contextId = ++importContext;
  const hooks = registerHooks({
    resolve(specifier, parent, nextResolve) {
      const resolved = nextResolve(specifier, parent);
      if (resolved.url.startsWith(apiRoot)) {
        const url = new URL(resolved.url);
        url.searchParams.set("handlerTest", String(contextId));
        return { ...resolved, url: url.href };
      }
      return resolved;
    },
  });
  try {
    const [generate, webhook, helpers] = await Promise.all([
      import(new URL(`generate.js?handlerTest=${contextId}`, apiRoot)),
      import(new URL(`stripe-webhook.js?handlerTest=${contextId}`, apiRoot)),
      import(new URL(`_lib/supabaseAdmin.js?handlerTest=${contextId}`, apiRoot)),
    ]);
    return { generate: generate.default, webhook: webhook.default, helpers, fetchMock };
  } finally {
    hooks.deregister();
  }
}

function webhookRequest(object, { type = "checkout.session.completed", raw, signature } = {}) {
  const payload = raw ?? JSON.stringify({ type, data: { object } });
  const timestamp = Math.floor(Date.now() / 1000);
  const digest = createHmac("sha256", SECRET).update(`${timestamp}.${payload}`).digest("hex");
  const request = Readable.from([payload]);
  request.method = "POST";
  request.headers = { "stripe-signature": signature ?? `t=${timestamp},v1=${digest}` };
  return request;
}

async function deliver(webhook, object, options) {
  const result = response();
  await webhook(webhookRequest(object, options), result);
  return result;
}

async function generateRequest(generate, messages = [textMessage], { token = "fixture-token", body = {} } = {}) {
  const result = response();
  await generate({ method: "POST", headers: token ? { authorization: `Bearer ${token}` } : {}, body: { messages, ...body } }, result);
  return result;
}

function assertError(result, status) {
  assert.equal(result.statusCode, status);
  assert.equal(typeof result.body?.error?.message, "string");
}

test("webhook: missing secret returns 503 before reading the body", async context => {
  const { webhook, fetchMock } = await loadHandlers(context, { secret: "" });
  const result = response();
  await webhook({ method: "POST", on() { assert.fail("Body must not be read"); } }, result);
  assertError(result, 503);
  assert.equal(fetchMock.mock.callCount(), 0);
});

for (const signature of ["", "t=0,v1=bad", `t=${Math.floor(Date.now() / 1000)},v1=wrong`]) {
  test(`webhook: invalid signature ${JSON.stringify(signature)} never writes`, async context => {
    const { webhook, fetchMock } = await loadHandlers(context);
    const result = await deliver(webhook, { client_reference_id: USER }, { signature });
    assertError(result, 400);
    assert.equal(fetchMock.mock.callCount(), 0);
  });
}

test("webhook: signed malformed JSON is rejected without writes", async context => {
  const { webhook } = await loadHandlers(context);
  assertError(await deliver(webhook, {}, { raw: "{" }), 400);
});

test("webhook: Supabase-absent demo verifies signatures and performs no database calls", async context => {
  const { webhook, fetchMock } = await loadHandlers(context, { configured: false });
  assertError(await deliver(webhook, {}, { signature: "" }), 400);
  for (const type of ["checkout.session.completed", "customer.subscription.updated", "customer.subscription.deleted", "invoice.payment_failed"]) {
    const result = await deliver(webhook, { client_reference_id: USER, subscription: SUBSCRIPTION }, { type });
    assert.equal(result.statusCode, 200);
  }
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("webhook: unknown events are acknowledged without writes", async context => {
  const { webhook } = await loadHandlers(context);
  assert.equal((await deliver(webhook, {}, { type: "unhandled.fixture" })).statusCode, 200);
});

for (const [type, status] of [
  ["checkout.session.completed", "active"],
  ["customer.subscription.updated", "past_due"],
  ["customer.subscription.deleted", "canceled"],
]) {
  for (const failure of ["http", "network"]) {
    test(`webhook: ${type} ${failure} write failure returns 503 and retry succeeds`, async context => {
      const writes = [];
      const checkout = type === "checkout.session.completed";
      const { webhook } = await loadHandlers(context, { fetchImpl: async (url, options) => {
        assert.equal(new URL(url).pathname, "/rest/v1/subscriptions");
        assert.equal(options.method, checkout ? "POST" : "PATCH");
        if (!checkout) {
          const query = new URL(url).searchParams;
          assert.equal(query.get("user_id"), `eq.${USER}`);
          assert.equal(query.get("stripe_subscription_id"), `eq.${SUBSCRIPTION}`);
        }
        writes.push(JSON.parse(options.body));
        if (writes.length === 1) {
          if (failure === "network") throw new Error("fixture outage");
          return new Response("unavailable", { status: 503 });
        }
        return checkout ? new Response(null, { status: 201 })
          : Response.json([{ user_id: USER, stripe_subscription_id: SUBSCRIPTION, ...writes[1] }]);
      } });
      const object = { id: SUBSCRIPTION, subscription: SUBSCRIPTION, customer: "cus_fixture", metadata: { user_id: USER }, status: "past_due" };
      assertError(await deliver(webhook, object, { type }), 503);
      assert.equal((await deliver(webhook, object, { type })).statusCode, 200);
      assert.deepEqual(writes[0], writes[1]);
      if (checkout) {
        assert.equal(writes[1][0].user_id, USER);
        assert.equal(writes[1][0].stripe_subscription_id, SUBSCRIPTION);
      } else {
        assert.equal(Object.hasOwn(writes[1], "user_id"), false);
        assert.equal(Object.hasOwn(writes[1], "stripe_subscription_id"), false);
      }
      assert.equal((checkout ? writes[1][0] : writes[1]).status, status);
    });
  }
}

test("webhook: relevant event without an owner is retryable", async context => {
  const { webhook } = await loadHandlers(context);
  assertError(await deliver(webhook, { subscription: SUBSCRIPTION }), 503);
});

for (const type of ["customer.subscription.updated", "customer.subscription.deleted"]) {
  test(`webhook: stale ${type} followed by an old invoice preserves the active replacement`, async context => {
    const stored = { user_id: USER, stripe_subscription_id: "sub_replacement", status: "active", current_period_end: "2099-01-01T00:00:00.000Z" };
    const original = { ...stored };
    let updates = 0, reads = 0;
    const { webhook } = await loadHandlers(context, { fetchImpl: async (url, options) => {
      const query = new URL(url).searchParams;
      assert.equal(query.get("stripe_subscription_id"), `eq.${SUBSCRIPTION}`);
      const matches = query.get("stripe_subscription_id") === `eq.${stored.stripe_subscription_id}`;
      if (!options.method) {
        reads++;
        return Response.json(matches ? [stored] : []);
      }
      updates++;
      assert.equal(options.method, "PATCH", "Lifecycle events must never upsert a link");
      assert.equal(query.get("user_id"), `eq.${USER}`);
      assert.equal(Object.hasOwn(JSON.parse(options.body), "stripe_subscription_id"), false);
      if (matches) Object.assign(stored, JSON.parse(options.body));
      return Response.json(matches ? [stored] : []);
    } });
    const object = { id: SUBSCRIPTION, metadata: { user_id: USER }, status: "past_due" };
    assertError(await deliver(webhook, object, { type }), 503);
    assert.deepEqual(stored, original);
    assertError(await deliver(webhook, { subscription: SUBSCRIPTION, metadata: { user_id: USER } }, { type: "invoice.payment_failed" }), 503);
    assert.deepEqual(stored, original);
    assert.equal(updates, 1);
    assert.equal(reads, 1);
  });

  test(`webhook: ${type} before checkout retries and succeeds only after checkout establishes the link`, async context => {
    let stored = null;
    const { webhook } = await loadHandlers(context, { fetchImpl: async (url, options) => {
      if (options.method === "POST") {
        assert.equal(stored, null);
        stored = JSON.parse(options.body)[0];
        assert.equal(stored.user_id, USER);
        assert.equal(stored.stripe_subscription_id, SUBSCRIPTION);
        return new Response(null, { status: 201 });
      }
      assert.equal(options.method, "PATCH");
      const query = new URL(url).searchParams;
      assert.equal(query.get("user_id"), `eq.${USER}`);
      assert.equal(query.get("stripe_subscription_id"), `eq.${SUBSCRIPTION}`);
      if (!stored) return Response.json([]);
      Object.assign(stored, JSON.parse(options.body));
      return Response.json([stored]);
    } });
    const object = { id: SUBSCRIPTION, metadata: { user_id: USER }, status: "past_due", current_period_end: 1893456000 };
    assertError(await deliver(webhook, object, { type }), 503);
    assert.equal(stored, null);
    assert.equal((await deliver(webhook, { client_reference_id: USER, subscription: SUBSCRIPTION })).statusCode, 200);
    assert.equal((await deliver(webhook, object, { type })).statusCode, 200);
    assert.equal(stored.stripe_subscription_id, SUBSCRIPTION);
    assert.equal(stored.status, type.endsWith("deleted") ? "canceled" : "past_due");
    assert.equal(stored.current_period_end, "2030-01-01T00:00:00.000Z");
  });

  test(`webhook: ${type} without an ID or owner cannot write`, async context => {
    const { webhook, fetchMock } = await loadHandlers(context);
    assertError(await deliver(webhook, { metadata: { user_id: USER } }, { type }), 503);
    assertError(await deliver(webhook, { id: SUBSCRIPTION }, { type }), 503);
    assert.equal(fetchMock.mock.callCount(), 0);
  });
}

for (const [type, stripeStatus, status] of [
  ["customer.subscription.updated", "active", "active"],
  ["customer.subscription.updated", "trialing", "active"],
  ["customer.subscription.deleted", "canceled", "canceled"],
]) {
  test(`webhook: matching ${type} ${stripeStatus} updates only the linked owner's subscription`, async context => {
    const stored = { user_id: USER, stripe_subscription_id: SUBSCRIPTION, status: "active" };
    const other = { user_id: OTHER_USER, stripe_subscription_id: "sub_other", status: "active" };
    const { webhook } = await loadHandlers(context, { fetchImpl: async (url, options) => {
      assert.equal(options.method, "PATCH");
      const query = new URL(url).searchParams;
      assert.equal(query.get("user_id"), `eq.${USER}`);
      assert.equal(query.get("stripe_subscription_id"), `eq.${SUBSCRIPTION}`);
      const changes = JSON.parse(options.body);
      assert.equal(Object.hasOwn(changes, "user_id"), false);
      assert.equal(Object.hasOwn(changes, "stripe_subscription_id"), false);
      Object.assign(stored, changes);
      return Response.json([stored]);
    } });
    assert.equal((await deliver(webhook, { id: SUBSCRIPTION, customer: "cus_fixture", metadata: { user_id: USER }, status: stripeStatus, current_period_end: 1893456000 }, { type })).statusCode, 200);
    assert.equal(stored.status, status);
    assert.equal(stored.stripe_customer_id, "cus_fixture");
    assert.equal(stored.current_period_end, "2030-01-01T00:00:00.000Z");
    assert.deepEqual(other, { user_id: OTHER_USER, stripe_subscription_id: "sub_other", status: "active" });
  });
}

const invoiceShapes = [
  { subscription: SUBSCRIPTION },
  { subscription: { id: SUBSCRIPTION } },
  { parent: { type: "subscription_details", subscription_details: { subscription: SUBSCRIPTION } } },
  { subscription: null, parent: { type: "subscription_details", subscription_details: { subscription: { id: SUBSCRIPTION } } } },
];

for (const [index, invoice] of invoiceShapes.entries()) {
  test(`webhook: invoice ID shape ${index + 1} maps only the exact stored subscription`, async context => {
    const stored = { user_id: USER, stripe_subscription_id: SUBSCRIPTION, status: "active" };
    let reads = 0, writes = 0;
    const { webhook } = await loadHandlers(context, { fetchImpl: async (url, options) => {
      const query = new URL(url).searchParams;
      assert.equal(query.get("stripe_subscription_id"), `eq.${SUBSCRIPTION}`);
      assert.equal(query.has("stripe_customer_id"), false);
      if (!options.method) {
        reads++;
        assert.equal(query.get("limit"), "2");
        return Response.json([stored]);
      }
      writes++;
      assert.equal(options.method, "PATCH");
      assert.equal(query.get("user_id"), `eq.${USER}`);
      assert.deepEqual(JSON.parse(options.body), { status: "past_due" });
      stored.status = "past_due";
      return Response.json([stored]);
    } });
    const result = await deliver(webhook, { ...invoice, customer: "cus_other", metadata: { user_id: OTHER_USER } }, { type: "invoice.payment_failed" });
    assert.equal(result.statusCode, 200);
    assert.equal(stored.status, "past_due");
    assert.equal(reads, 1);
    assert.equal(writes, 1);
  });
}

for (const [label, rows, expectedError] of [
  ["not found", [], null],
  ["duplicate", [{ user_id: USER, stripe_subscription_id: SUBSCRIPTION }, { user_id: OTHER_USER, stripe_subscription_id: SUBSCRIPTION }], "ambiguous_subscription"],
  ["invalid body", {}, "invalid_subscription_result"],
  ["wrong subscription", [{ user_id: USER, stripe_subscription_id: "sub_other" }], "invalid_subscription_result"],
  ["missing owner", [{ stripe_subscription_id: SUBSCRIPTION }], "invalid_subscription_result"],
  ["http error", null, "subscription_lookup_failed"],
  ["network error", null, "subscription_lookup_failed"],
  ["invalid JSON", null, "subscription_lookup_failed"],
]) {
  test(`webhook: invoice lookup ${label} is explicit and never mutates`, async context => {
    const { webhook, helpers } = await loadHandlers(context, { fetchImpl: async (url, options) => {
      assert.equal(options.method, undefined);
      if (label === "network error") throw new Error("fixture outage");
      if (label === "http error") return new Response("error", { status: 503 });
      if (label === "invalid JSON") return new Response("{");
      return Response.json(rows);
    } });
    assert.deepEqual(await helpers.selectSubscriptionById(SUBSCRIPTION), { data: null, error: expectedError });
    assertError(await deliver(webhook, { subscription: SUBSCRIPTION, customer: "cus_fixture", metadata: { user_id: USER } }, { type: "invoice.payment_failed" }), 503);
  });
}

test("webhook: non-subscription invoices are ignored without customer fallback", async context => {
  const { webhook, fetchMock } = await loadHandlers(context);
  for (const invoice of [{}, { subscription: null }, { parent: { type: "quote_details" } }]) {
    const result = await deliver(webhook, { ...invoice, customer: "cus_fixture", metadata: { user_id: USER } }, { type: "invoice.payment_failed" });
    assert.equal(result.statusCode, 200);
  }
  assert.equal(fetchMock.mock.callCount(), 0);
});

for (const invoice of [{ subscription: {} }, { subscription: 1 }, { parent: { type: "subscription_details", subscription_details: {} } }]) {
  test(`webhook: unresolved subscription invoice ${JSON.stringify(invoice)} is retryable`, async context => {
    const { webhook } = await loadHandlers(context);
    assertError(await deliver(webhook, invoice, { type: "invoice.payment_failed" }), 503);
  });
}

test("webhook: old subscription invoice cannot overwrite a replacement", async context => {
  const stored = { user_id: USER, stripe_subscription_id: "sub_replacement", status: "active" };
  const { webhook } = await loadHandlers(context, { fetchImpl: async (url, options) => {
    assert.equal(options.method, undefined);
    assert.equal(new URL(url).searchParams.get("stripe_subscription_id"), `eq.${SUBSCRIPTION}`);
    return Response.json([]);
  } });
  assertError(await deliver(webhook, { subscription: SUBSCRIPTION, metadata: { user_id: USER } }, { type: "invoice.payment_failed" }), 503);
  assert.equal(stored.stripe_subscription_id, "sub_replacement");
  assert.equal(stored.status, "active");
});

for (const failure of ["http", "network", "replaced", "invalid JSON"]) {
  test(`webhook: invoice update ${failure} returns 503 without overwriting replacements`, async context => {
    const stored = { user_id: USER, stripe_subscription_id: SUBSCRIPTION, status: "active" };
    let writes = 0;
    const { webhook } = await loadHandlers(context, { fetchImpl: async (url, options) => {
      if (!options.method) return Response.json([stored]);
      assert.equal(options.method, "PATCH");
      const query = new URL(url).searchParams;
      assert.equal(query.get("user_id"), `eq.${USER}`);
      assert.equal(query.get("stripe_subscription_id"), `eq.${SUBSCRIPTION}`);
      writes++;
      if (writes === 1) {
        if (failure === "http") return new Response("error", { status: 503 });
        if (failure === "network") throw new Error("fixture outage");
        if (failure === "invalid JSON") return new Response("{");
        stored.stripe_subscription_id = "sub_replacement";
        return Response.json([]);
      }
      stored.status = "past_due";
      return Response.json([stored]);
    } });
    const invoice = { subscription: SUBSCRIPTION };
    assertError(await deliver(webhook, invoice, { type: "invoice.payment_failed" }), 503);
    assert.equal(stored.status, "active");
    if (failure === "replaced") {
      assert.equal(stored.stripe_subscription_id, "sub_replacement");
    } else {
      assert.equal((await deliver(webhook, invoice, { type: "invoice.payment_failed" })).statusCode, 200);
      assert.equal(stored.status, "past_due");
    }
  });
}

for (const invalid of [null, false, 0, "", [], {}, { role: "system", content: "x" }, { role: 1, content: "x" },
  { role: "user" }, { role: "user", content: null }, { role: "user", content: 0 }, { role: "user", content: {} },
  { role: "user", content: [] }, { role: "user", content: [null] }, { role: "user", content: [{ type: "text" }] },
  { role: "user", content: [{ type: "image", source: null }] }, { role: "user", content: [{ type: "image", source: {} }] },
  { role: "user", content: [{ type: "other", text: "x" }] }]) {
  test(`generate: rejects invalid message ${JSON.stringify(invalid)} in singleton and mixed arrays`, async context => {
    const { generate, fetchMock } = await loadHandlers(context);
    for (const messages of [[invalid], [textMessage, invalid], [invalid, textMessage]]) {
      assertError(await generateRequest(generate, messages), 400);
    }
    assert.equal(fetchMock.mock.callCount(), 0);
  });
}

test("generate: missing or invalid authentication stops before metering", async context => {
  const { generate, fetchMock } = await loadHandlers(context, { fetchImpl: async url => {
    assert.equal(new URL(url).pathname, "/auth/v1/user");
    return new Response("unauthorized", { status: 401 });
  } });
  assertError(await generateRequest(generate, [textMessage], { token: "" }), 401);
  assert.equal(fetchMock.mock.callCount(), 0);
  assertError(await generateRequest(generate), 401);
  assert.equal(fetchMock.mock.callCount(), 1);
});

for (const [label, messages, kind] of [
  ["text", [textMessage, { role: "assistant", content: "A recipe" }], "gen"],
  ["text blocks", [{ role: "user", content: [{ type: "text", text: "Chicken" }] }], "gen"],
  ["base64 vision", [{ role: "user", content: [imageBlock, { type: "text", text: "Identify ingredients" }] }], "scan"],
  ["URL vision", [{ role: "user", content: [{ type: "image", source: { type: "url", url: "https://images.invalid/fixture.jpg" } }] }], "scan"],
]) {
  test(`generate: authenticated ${label} requires both true meters and preserves upstream request`, async context => {
    const calls = [];
    const { generate } = await loadHandlers(context, { fetchImpl: async (url, options) => {
      calls.push(url);
      const path = new URL(url).pathname;
      if (path === "/auth/v1/user") return Response.json({ id: USER, email: "fixture@example.invalid" });
      if (path.startsWith("/rest/v1/rpc/")) {
        const args = JSON.parse(options.body);
        assert.equal(args.p_user, USER);
        if (path.endsWith("consume_quota")) assert.equal(args.p_kind, kind);
        return Response.json(true);
      }
      assert.equal(url, "https://api.anthropic.com/v1/messages");
      const body = JSON.parse(options.body);
      assert.deepEqual(body.messages, messages);
      assert.equal(body.model, "claude-sonnet-4-6");
      assert.equal(body.max_tokens, 2000);
      return Response.json({ content: [{ type: "text", text: "recipe fixture" }] });
    } });
    const result = await generateRequest(generate, messages, { body: { model: "not-allowed", max_tokens: 100000, user_id: OTHER_USER } });
    assert.equal(result.statusCode, 200);
    assert.equal(calls.length, 4);
    assert.deepEqual(calls.slice(1, 3).map(url => new URL(url).pathname), ["/rest/v1/rpc/check_rate_limit", "/rest/v1/rpc/consume_quota"]);
    assert.equal(JSON.parse(result.chunks.join("")).content[0].text, "recipe fixture");
  });
}

for (const meter of ["check_rate_limit", "consume_quota"]) {
  for (const outcome of [false, null, 0, 1, "true", {}, [], "http-error", "network-error", "invalid-json", "empty"]) {
    test(`generate: ${meter} outcome ${JSON.stringify(outcome)} never reaches Anthropic`, async context => {
      const calls = [];
      const { generate } = await loadHandlers(context, { fetchImpl: async url => {
        const path = new URL(url).pathname;
        calls.push(path);
        if (path === "/auth/v1/user") return Response.json({ id: USER });
        assert.ok(path.startsWith("/rest/v1/rpc/"), "No Anthropic request is allowed");
        if (!path.endsWith(meter)) return Response.json(true);
        if (outcome === "network-error") throw new Error("fixture outage");
        if (outcome === "http-error") return new Response("error", { status: 503 });
        if (outcome === "invalid-json") return new Response("{");
        if (outcome === "empty") return new Response("");
        return Response.json(outcome);
      } });
      const result = await generateRequest(generate);
      const expectedStatus = outcome === false ? (meter === "check_rate_limit" ? 429 : 402) : 503;
      assertError(result, expectedStatus);
      if (outcome === false) assert.equal(result.body.error.code, meter === "check_rate_limit" ? "rate_limited" : "quota_exceeded");
      assert.equal(calls.length, meter === "check_rate_limit" ? 2 : 3);
    });
  }
}

test("generate: demo mode preserves valid text streaming without auth or database calls", async context => {
  const payload = "event: message_stop\ndata: {}\n\n";
  const { generate, fetchMock } = await loadHandlers(context, { configured: false, fetchImpl: async (url, options) => {
    assert.equal(url, "https://api.anthropic.com/v1/messages");
    assert.equal(JSON.parse(options.body).stream, true);
    return new Response(payload);
  } });
  const result = await generateRequest(generate, [textMessage], { token: "", body: { stream: true } });
  assert.equal(result.statusCode, 200);
  assert.equal(result.headers["Content-Type"], "text/event-stream; charset=utf-8");
  assert.equal(result.chunks.join(""), payload);
  assert.equal(result.ended, true);
  assert.equal(fetchMock.mock.callCount(), 1);
});
