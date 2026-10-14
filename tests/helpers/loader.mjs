/**
 * Minimal ESM resolution hook for the contract tests.
 *
 * * rewrites the `@/` path alias to the repository root, and
 * * replaces the `server-only` marker module with an empty one, so pure server
 *   helpers can be unit-tested without a Next.js runtime or a database.
 *
 * This file is test-only and is never loaded by the application.
 */
import { pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = path.resolve(new URL("../..", import.meta.url).pathname);
const SRC = path.join(ROOT, "src");

function resolveAsFile(target, context, nextResolve) {
  const candidate = path.extname(target) ? target : `${target}.ts`;
  return nextResolve(pathToFileURL(candidate).href, context);
}

export function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return {
      url: pathToFileURL(path.join(ROOT, "tests/helpers/empty.mjs")).href,
      shortCircuit: true,
    };
  }

  if (specifier.startsWith("@/")) {
    // `@/` is the tsconfig alias for `<repo>/src/`.
    return resolveAsFile(path.join(SRC, specifier.slice(2)), context, nextResolve);
  }

  // Extensionless relative specifiers inside src/ (TS sources, no .ts suffix).
  if (specifier.startsWith(".") && !/\.[cm]?[jt]sx?$/.test(specifier)) {
    const parent = context.parentURL ? path.dirname(new URL(context.parentURL).pathname) : SRC;
    return resolveAsFile(path.resolve(parent, specifier), context, nextResolve);
  }

  return nextResolve(specifier, context);
}