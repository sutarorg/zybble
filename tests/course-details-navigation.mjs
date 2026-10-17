import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL("../src/app/creator/(studio)/courses/new/course-details-form.tsx", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;

async function submit({ uploadFails = false, saveFails = false, throws = false, initial } = {}) {
  const paths = [], notices = [], errors = [], saved = [];
  const form = { title: "Test course", subtitle: "", description: "", categorySlug: "development", level: "beginner", language: "English", priceRupees: "0", compareAtRupees: "", whatYouLearn: [], requirements: [], audience: [], ...initial };
  let stateIndex = 0;
  const exports = {};
  const react = {
    useState(value) {
      const index = stateIndex++;
      return [index === 0 ? form : typeof value === "function" ? value() : value,
        (next) => { if (index === 3) errors.push(next); }];
    },
    useRef: () => ({ current: { name: "cover.png" } }),
    useMemo: (fn) => fn(),
  };
  vm.runInNewContext(code, { exports, require(name) {
    if (name === "react") return react;
    if (name === "next/navigation") return { useRouter: () => ({ push: (path) => paths.push(path), refresh() {} }) };
    if (name === "sonner") return { toast: { warning: (message) => notices.push(message) } };
    if (name === "@/app/creator/actions") return { saveCourse: async (payload) => {
      saved.push(payload);
      if (throws) throw new Error("Network unavailable");
      return saveFails ? { ok: false, error: "Save failed" } : { ok: true, id: "saved-course" };
    } };
    if (name === "@/lib/money") return { inrPriceInputSchema: { safeParse: () => ({ success: true, data: 0 }) } };
    if (name === "@/components/creator/thumbnail-upload") return { uploadThumbnail: async () => {
      if (uploadFails) throw new Error("Upload unavailable");
      return { ok: true };
    } };
    if (name.startsWith("@/")) return new Proxy({}, { get: (_, key) => key === "CATEGORIES" ? [] : key === "TEACHING_LANGUAGES" ? [] : () => "" });
    return require(name);
  } });
  const element = exports.CourseDetailsForm({ initial });
  await element.props.onSubmit({ preventDefault() {} });
  return { paths, notices, errors, saved };
}

test("new course continues to the saved course curriculum", async () => {
  const result = await submit();
  assert.deepEqual(result.paths, ["/creator/courses/saved-course/curriculum"]);
  assert.equal(result.saved.length, 1);
});
test("thumbnail failure does not redirect back to Details or block Curriculum", async () => {
  const result = await submit({ uploadFails: true });
  assert.deepEqual(result.paths, ["/creator/courses/saved-course/curriculum"]);
  assert.equal(result.notices.length, 1);
});
test("failed saves do not navigate", async () => {
  assert.deepEqual((await submit({ saveFails: true })).paths, []);
  assert.deepEqual((await submit({ throws: true })).paths, []);
});
test("saving existing details stays on the current page", async () => {
  assert.deepEqual((await submit({ initial: { id: "existing-course" } })).paths, []);
});
