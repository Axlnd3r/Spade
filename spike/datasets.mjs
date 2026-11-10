import { readdirSync, readFileSync } from "node:fs";
import { normalizeLines } from "./lib.mjs";

const root = new URL("./datasets/", import.meta.url);

export function loadDatasets() {
  return ["normal", "adversarial"].flatMap((category) =>
    readdirSync(new URL(`${category}/`, root))
      .filter((f) => f.endsWith(".txt"))
      .sort()
      .map((file) => {
        const text = readFileSync(new URL(`${category}/${file}`, root), "utf8");
        return { name: file.replace(/\.txt$/, ""), category, text, lines: normalizeLines(text) };
      }),
  );
}
