import { BACK_SVG, FRONT_URL, INK, inkLevels, PAPER } from "./cardArt";

function parse(svg: string) {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
  return doc;
}

test("front_is_the_padlock_art", () => {
  expect(FRONT_URL).toMatch(/mrx-gembok.*\.png$/);
});

test("ink_levels_snap_lines_and_paper", () => {
  const px = new Uint8ClampedArray([10, 10, 10, 255, 250, 250, 250, 255, 128, 128, 128, 255]);
  inkLevels(px);
  expect([...px.slice(0, 4)]).toEqual([...INK, 255]);
  expect([...px.slice(4, 8)]).toEqual([...PAPER, 255]);
  expect(px[8]).toBeGreaterThan(INK[0]);
  expect(px[8]).toBeLessThan(PAPER[0]);
});

test("back_is_the_spade_logo", () => {
  const texts = [...parse(BACK_SVG).getElementsByTagName("text")].map((t) => t.textContent);
  expect(texts).toContain("SPADE");
});
