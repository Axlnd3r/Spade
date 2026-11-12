import { BACK_SVG, engrave, formForPath, FORMS } from "./cardArt";

function parse(svg: string) {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
  return doc;
}

test("each_page_has_its_card_form", () => {
  expect(formForPath("/")).toBe("gembok");
  expect(formForPath("/overview")).toBe("gembok");
  expect(formForPath("/taksir")).toBe("tongkat");
  expect(formForPath("/cases")).toBe("pistol");
  expect(formForPath("/case/3")).toBe("pistol");
  expect(formForPath("/ledger")).toBe("sekop");
  expect(formForPath("/verify")).toBe("kunci");
  expect(formForPath("/nowhere")).toBe("gembok");
});

test("forms_use_the_four_engravings_and_the_spade", () => {
  for (const f of ["gembok", "tongkat", "pistol", "kunci"] as const) expect(FORMS[f].art).toMatch(new RegExp(`mrx-${f}.*\.png$`));
  expect(FORMS.sekop.art).toBeNull();
  expect(new Set(Object.values(FORMS).map((f) => f.color)).size).toBe(5);
});

test("engrave_turns_ink_into_light_and_paper_into_glass", () => {
  // ink, paper, and a fully transparent corner
  const px = new Uint8ClampedArray([10, 10, 10, 255, 250, 250, 250, 255, 0, 0, 0, 0]);
  engrave(px, false);
  expect([...px.slice(0, 4)]).toEqual([255, 255, 255, 255]);
  expect(px[7]).toBe(0);
  expect(px[11]).toBe(0);
});

test("engrave_light_ink_keeps_the_bright_lines", () => {
  const px = new Uint8ClampedArray([255, 255, 255, 255, 14, 14, 16, 255]);
  engrave(px, true);
  expect(px[3]).toBe(255);
  expect(px[7]).toBe(0);
});

test("back_is_the_spade_logo", () => {
  const texts = [...parse(BACK_SVG).getElementsByTagName("text")].map((t) => t.textContent);
  expect(texts).toContain("SPADE");
});
