import { mmss, nextEpochMs, windowLeftMs } from "./epoch";

test("next_epoch_boundary_from_genesis", () => {
  expect(nextEpochMs(1000, 600000, 1000 + 600000 * 3 + 5)).toBe(1000 + 600000 * 4);
  expect(nextEpochMs(1000, 600000, 1000)).toBe(1000 + 600000);
});

test("window_left_never_negative", () => {
  expect(windowLeftMs(0, 3600000, 3600001)).toBe(0);
  expect(windowLeftMs(0, 3600000, 600000)).toBe(3000000);
});

test("mmss_formats_countdown", () => {
  expect(mmss(65000)).toBe("01:05");
  expect(mmss(0)).toBe("00:00");
});
