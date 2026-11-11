import vectors from "../../../enclave/appraiser/vectors/vectors.json";
import { normalizeLines, sameLines, validateData } from "./data";

const LIMITS = { min_rows: 5, max_rows: 100, max_data_bytes: 2000 };

type Vector = { name: string; input: string; lines: string[]; valid: boolean; error_code?: string };

test("matches_shared_vectors", () => {
  for (const c of vectors as Vector[]) {
    const lines = normalizeLines(c.input);
    expect(lines, c.name).toEqual(c.lines);
    expect(validateData(c.input, lines, LIMITS), c.name).toBe(c.valid ? null : c.error_code);
  }
});

test("sameLines_byte_order", () => {
  expect(sameLines(["b", "a"], ["a", "b"])).toBe(true);
  expect(sameLines(["a"], ["a", "a"])).toBe(false);
  expect(sameLines(["😀", "ｚ"], ["ｚ", "😀"])).toBe(true);
});
