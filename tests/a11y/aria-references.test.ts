import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Accessibility regression guard: ARIA reference integrity.
 *
 * `aria-labelledby`, `aria-describedby` and `aria-controls` name an element by
 * id. A reference that points at nothing is silently worse than no reference
 * at all: the section or control has no accessible name, and screen-reader
 * users are told nothing. Browsers do not warn about it, and it is invisible
 * in a code review — three of these shipped to the homepage and the pricing
 * page before a real axe run caught them.
 *
 * This test is a static scan rather than a browser run so it costs nothing and
 * runs on every PR. It accepts an id that is declared either directly
 * (`id="x"`) or passed down as a prop (`headingId="x"`), which is why the rule
 * is "the id string must appear in the same component", not "as an id
 * attribute". Typos still fail: a misspelled reference appears nowhere.
 */

const SRC = join(process.cwd(), "src");

function tsxFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      found.push(...tsxFiles(path));
    } else if (path.endsWith(".tsx")) {
      found.push(path);
    }
  }
  return found;
}

const REFERENCING_ATTRIBUTES = ["aria-labelledby", "aria-describedby", "aria-controls"] as const;

/** Every id reference in a file, with the attribute that declared it. */
function references(source: string): Array<{ attribute: string; id: string }> {
  const found: Array<{ attribute: string; id: string }> = [];
  for (const attribute of REFERENCING_ATTRIBUTES) {
    const pattern = new RegExp(`${attribute}="([^"]+)"`, "g");
    for (const match of source.matchAll(pattern)) {
      // aria-labelledby accepts a space-separated list of ids.
      for (const id of match[1].split(/\s+/)) {
        if (id) found.push({ attribute, id });
      }
    }
  }
  return found;
}

/**
 * The component's source with every *reference* removed.
 *
 * A reference must not be allowed to satisfy itself: `aria-labelledby="x"`
 * contains the string `"x"`, so a naive substring check passes for every
 * dangling reference. Stripping the referencing attributes first leaves only
 * genuine declarations — `id="x"` on an element, or `someIdProp="x"` passed to
 * a child that stamps it onto an element.
 */
function withoutReferences(source: string): string {
  let stripped = source;
  for (const attribute of REFERENCING_ATTRIBUTES) {
    stripped = stripped.replace(new RegExp(`${attribute}="[^"]*"`, "g"), `${attribute}=""`);
  }
  return stripped;
}

describe("ARIA references", () => {
  const files = tsxFiles(SRC);

  it("finds components to scan", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("every referenced id is declared in the same component", () => {
    const dangling: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const declarations = withoutReferences(source);
      for (const { attribute, id } of references(source)) {
        // Radix generates ids at runtime (useId); they always resolve.
        if (id.startsWith("radix-")) continue;

        if (!declarations.includes(`"${id}"`)) {
          dangling.push(`${file.replace(process.cwd(), ".")} — ${attribute}="${id}"`);
        }
      }
    }

    expect(
      dangling,
      `ARIA references with no matching id:\n${dangling.join("\n")}`,
    ).toEqual([]);
  });
});
