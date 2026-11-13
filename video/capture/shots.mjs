// What each recorded shot does on the live site. `path` is the hash route loaded first, `prepare` runs
// before recording starts, `act` is what the camera sees.

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let pointer = { x: 960, y: 540 };

/** Moves the pointer (the site draws it as a glass lens) along an eased path. */
async function glide(page, x, y, ms = 900) {
  const from = pointer;
  const steps = Math.max(2, Math.round(ms / 16));
  for (let i = 1; i <= steps; i++) {
    const k = i / steps;
    const e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
    await page.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e);
    await wait(ms / steps);
  }
  pointer = { x, y };
}

/** Scrolls by `dy` pixels with an eased curve over `ms`. */
async function scroll(page, dy, ms = 1500) {
  const start = await page.evaluate(() => window.scrollY);
  const steps = Math.round(ms / 16);
  for (let i = 1; i <= steps; i++) {
    const k = i / steps;
    const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
    await page.evaluate((y) => window.scrollTo(0, y), start + dy * e);
    await wait(ms / steps);
  }
}

async function box(page, selector) {
  const el = await page.waitForSelector(selector, { visible: true });
  const b = await el.boundingBox();
  return { ...b, cx: b.x + b.width / 2, cy: b.y + b.height / 2 };
}

/** Puts `selector` at `top` pixels from the top of the viewport, without animation. */
async function jumpTo(page, selector, top = 140) {
  await page.$eval(selector, (el, t) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - t), top);
}

async function click(page, selector, ms = 700) {
  const b = await box(page, selector);
  await glide(page, b.cx, b.cy, ms);
  await wait(150);
  await page.mouse.click(b.cx, b.cy);
}

async function clickText(page, tag, text, ms = 700) {
  const el = await page.waitForSelector(`::-p-xpath(//${tag}[normalize-space(.)='${text}'])`, { visible: true });
  const b = await el.boundingBox();
  await glide(page, b.x + b.width / 2, b.y + b.height / 2, ms);
  await wait(150);
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}

export const SHOTS = {
  // The first screen: the card on dark water, a spin of the card, then EXPLORE dives into "How it works".
  landing: {
    path: "/",
    prepare: async (page) => {
      pointer = { x: 1500, y: 700 };
      await page.mouse.move(pointer.x, pointer.y);
    },
    act: async (page) => {
      await wait(1500);
      await glide(page, 1010, 560, 1400);
      await page.mouse.down();
      await glide(page, 1350, 520, 700);
      await page.mouse.up();
      await wait(2200);
      await click(page, ".landing a, .landing button", 1100);
      await wait(4200);
    },
  },

  // The playable verdict: drag the second answer up into HELD, then back down into BUSTED.
  verdict: {
    path: "/how",
    prepare: async (page) => {
      await jumpTo(page, ".verdict", 250);
      const s = await box(page, ".verdict__slider");
      pointer = { x: s.x + s.width * 0.6, y: s.cy + 160 };
      await page.mouse.move(pointer.x, pointer.y);
    },
    act: async (page) => {
      const s = await box(page, ".verdict__slider");
      const at = (v) => s.x + 8 + ((s.width - 16) * (v - 1)) / 9999;
      await wait(1200);
      await glide(page, at(1), s.cy, 1000);
      await page.mouse.down();
      await glide(page, at(4200), s.cy, 2600);
      await wait(1300);
      await glide(page, at(1800), s.cy, 1800);
      await wait(1500);
      await page.mouse.up();
      await glide(page, at(1800) + 120, s.cy + 140, 900);
      await wait(1200);
    },
  },

  // TAKSIR without a wallet: type a list and watch the meters and the receipt. Stand-in for the wallet clip.
  taksir: {
    path: "/taksir",
    prepare: async (page) => {
      await jumpTo(page, "#form-title", 200);
      pointer = { x: 1500, y: 900 };
      await page.mouse.move(pointer.x, pointer.y);
    },
    act: async (page) => {
      await wait(1000);
      await click(page, ".data-input", 900);
      await page.keyboard.down("Control");
      await page.keyboard.press("a");
      await page.keyboard.up("Control");
      await page.keyboard.press("Backspace");
      await wait(400);
      await page.keyboard.type(
        "Warung Bu Sri price list\nnasi goreng 25000\nmie ayam 18000\nes teh manis 5000\nsate ayam 10 tusuk 30000\nkerupuk 2000",
        { delay: 35 },
      );
      await wait(800);
      await glide(page, 1500, 760, 1200);
      await wait(1800);
    },
  },

  // Case #3: Mr. X said 10,000, then 1 for the same lines reordered. BUSTED, reward +50.
  case3: {
    path: "/case/3",
    prepare: async (page) => {
      pointer = { x: 1500, y: 800 };
      await page.mouse.move(pointer.x, pointer.y);
    },
    act: async (page) => {
      await wait(2200);
      await scroll(page, 520, 2600);
      await wait(1600);
      await scroll(page, 420, 2200);
      await wait(1800);
    },
  },

  // The menu: hovering an item turns the card into that page's form; LEDGER dives into the ledger.
  menu: {
    path: "/overview",
    prepare: async (page) => {
      pointer = { x: 1500, y: 300 };
      await page.mouse.move(pointer.x, pointer.y);
    },
    act: async (page) => {
      await wait(800);
      await click(page, ".header__burger", 900);
      await wait(1300);
      for (const label of ["TAKSIR", "CASES", "VERIFY"]) {
        const el = await page.waitForSelector(`::-p-xpath(//a[contains(@class,'menu__item')][normalize-space(.)='${label}'])`);
        const b = await el.boundingBox();
        await glide(page, b.x + Math.min(b.width / 2, 260), b.y + b.height / 2, 600);
        await wait(1100);
      }
      await clickText(page, "a", "LEDGER", 600);
      await wait(3600);
      await scroll(page, 600, 2400);
      await wait(1200);
    },
  },

  // Overview: live supply, burned total, treasury, counting up from testnet.
  overview: {
    path: "/overview",
    prepare: async (page) => {
      pointer = { x: 1600, y: 900 };
      await page.mouse.move(pointer.x, pointer.y);
    },
    act: async (page) => {
      await wait(2500);
      await scroll(page, 700, 2600);
      await wait(2200);
    },
  },

  // Verify: the live code hash and the pinned enclave hash both MATCH, access keys, parameters.
  verify: {
    path: "/verify",
    prepare: async (page) => {
      pointer = { x: 1600, y: 900 };
      await page.mouse.move(pointer.x, pointer.y);
    },
    act: async (page) => {
      const top = (sel) => page.$eval(sel, (el) => el.getBoundingClientRect().top);
      await wait(1200);
      await scroll(page, (await top("#contract-title")) - 260, 1600);
      await wait(3200);
      await scroll(page, (await top("#enclave-title")) - 260, 2200);
      await wait(3200);
    },
  },
};
