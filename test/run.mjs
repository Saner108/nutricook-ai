// Runs the node:test suite and writes results to .claude/tdd-guard/data/test.json
// (tdd-guard has no built-in node:test reporter). Run tests with: node test/run.mjs
import { run } from "node:test";
import { spec } from "node:test/reporters";
import { mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const files = readdirSync(testDir).filter(f => f.endsWith(".test.mjs")).map(f => path.join(testDir, f));

const modules = new Map();
const stream = run({ files });
const record = (d, state) => {
  if (d.details?.type === "suite") return;
  const moduleId = d.file || "unknown";
  if (!modules.has(moduleId)) modules.set(moduleId, []);
  const test = { name: d.name, fullName: d.name, state };
  if (state === "failed") test.errors = [{ message: String(d.details?.error?.message || "failed"), stack: d.details?.error?.stack }];
  modules.get(moduleId).push(test);
};
stream.on("test:pass", d => record(d, "passed"));
stream.on("test:fail", d => record(d, "failed"));
stream.compose(spec).pipe(process.stdout);

await new Promise(resolve => stream.on("end", resolve));

const testModules = [...modules].map(([moduleId, tests]) => ({ moduleId, tests }));
const failed = testModules.some(m => m.tests.some(t => t.state === "failed"));
const out = { testModules, reason: failed ? "failed" : "passed" };
// tdd-guard resolves .claude/ from wherever the Claude session was started,
// which may be this repo or its parent folder — write to both.
for (const root of [path.join(testDir, ".."), path.join(testDir, "..", "..")]) {
  const dataDir = path.join(root, ".claude", "tdd-guard", "data");
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(path.join(dataDir, "test.json"), JSON.stringify(out, null, 2));
}
process.exitCode = failed ? 1 : 0;
