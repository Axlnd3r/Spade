import { BACK_SVG, FRONT_SVG } from "./cardArt";

function parse(svg: string) {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
  return doc;
}

test("front_is_mr_x_with_spade_staff", () => {
  const texts = [...parse(FRONT_SVG).getElementsByTagName("text")].map((t) => t.textContent);
  for (const ch of ["M", "R", "X"]) expect(texts).toContain(ch);
  expect(FRONT_SVG).toContain("M0,-14 C5,-8 14,-3 14,4");
});

test("back_is_the_spade_logo", () => {
  const texts = [...parse(BACK_SVG).getElementsByTagName("text")].map((t) => t.textContent);
  expect(texts).toContain("SPADE");
});
