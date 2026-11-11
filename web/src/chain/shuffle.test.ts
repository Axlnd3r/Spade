import { reversed, shuffledDifferent } from "./shuffle";

test("shuffledDifferent_is_a_deterministic_reordering", () => {
  const lines = ["a", "b", "c", "d", "e"];
  const s = shuffledDifferent(lines, 7);
  expect(s).toEqual(shuffledDifferent(lines, 7));
  expect(s).not.toEqual(lines);
  expect([...s].sort()).toEqual(lines);
  expect(lines).toEqual(["a", "b", "c", "d", "e"]);
});

test("throws_when_no_other_order_exists", () => {
  expect(() => shuffledDifferent(["a", "a", "a", "a", "a"], 1)).toThrow();
  expect(() => reversed(["a", "b", "a"])).toThrow();
  expect(reversed(["a", "b", "c"])).toEqual(["c", "b", "a"]);
});
