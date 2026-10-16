/**
 * RSC props contract test.
 *
 * A Server Component may only pass serialisable props to a Client Component.
 * Passing a function (`formatValue={...}`, render props, handlers, …) across
 * the boundary aborts the render with:
 *
 *   "Functions cannot be passed directly to Client Components unless you
 *    explicitly expose it by marking it with \"use server\"."
 *
 * That is exactly what took down the creator studio: server pages passed
 * `formatValue` callbacks into the client `<AreaChart>` / `<BarList>` charts,
 * so every signed-in visit to /creator landed on the error boundary.
 *
 * This scan enforces the contract statically over `src/`: every `.tsx` file
 * without a leading `"use client"` directive must not pass an arrow function
 * as a JSX prop value. (Functions passed between two Server Components would
 * be legal, but this codebase communicates with data props only; if a render
 * prop is ever needed, move the receiving component's rendering to the server
 * or serialise the data instead.)
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/**
 * `prop={(x) => …}`, `prop={() => …}`, `prop={x => …}`, `prop={async (x) => …}`.
 * Anchored on an arrow function starting the prop expression.
 */
const ARROW_PROP = /(\w+)=\{\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/g;

function isClientModule(source) {
  return /^\s*["']use client["']/.test(source);
}

test("no Server Component passes function props (RSC serialisation contract)", () => {
  const violations = [];
  for (const file of walk(SRC)) {
    const source = fs.readFileSync(file, "utf8");
    if (isClientModule(source)) continue;

    for (const [index, line] of source.split("\n").entries()) {
      for (const match of line.matchAll(ARROW_PROP)) {
        violations.push({
          file: path.relative(ROOT, file),
          line: index + 1,
          prop: match[1],
          snippet: line.trim().slice(0, 120),
        });
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Function props crossed the Server→Client boundary:\n${violations
      .map((v) => `  ${v.file}:${v.line}  ${v.prop}=  ${v.snippet}`)
      .join("\n")}\n` +
      "Pass serialisable data instead (e.g. a format marker string), and format inside the Client Component."
  );
});

test("client charts expose a serialisable valueFormat, not a function prop", () => {
  const charts = fs.readFileSync(path.join(SRC, "components", "creator", "charts.tsx"), "utf8");
  assert.ok(isClientModule(charts), "charts.tsx must remain a client module");
  assert.match(charts, /valueFormat\?:\s*ChartValueFormat/, "charts must accept the serialisable valueFormat prop");
  assert.doesNotMatch(charts, /formatValue/, "charts must not reintroduce the function-valued formatValue prop");
});
