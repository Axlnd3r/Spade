// Records the wallet clip: a real TAKSIR and a real SIDAK on the live site, signed with the "NEAR CLI"
// wallet that NEAR Connect offers. The site shows a `near` command; this script runs it with the account's
// key from ~/.near-credentials (adding `send`, which a person would pick at the CLI's last prompt), then
// pastes the transaction hash back, as the wallet asks. Spends about 0.12 NEAR and 75 TAKSIR on testnet.
//
//   node capture/wallet.mjs [account]      # default spade-demo.testnet; it needs NEAR and 75+ TAKSIR
//
// Writes public/wallet.mp4, and src/walletOutput.ts with the commands, CLI output and event times
// (seconds into the clip) used to cut out the waits.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { encode, launch, startCapture } from "./record.mjs";
import { box, click, glide, jumpTo, place, scroll, wait } from "./shots.mjs";

const ACCOUNT = process.argv[2] ?? "spade-demo.testnet";
const SITE = "https://axlnd3r.github.io/Spade/#";
const STAMP = new Date().toISOString().slice(0, 16).replace("T", " ");
const LIST = [`Warung Bu Sri price list, ${STAMP} UTC`, "nasi goreng 25000", "mie ayam 18000", "es teh manis 5000", "sate ayam 10 tusuk 30000", "kerupuk 2000"];

const events = [];
const signed = [];
const mark = (name) => {
  events.push({ name, t: Date.now() / 1000 });
  console.log(`  ${name}`);
};

/** A view call on the contract, read at the final block. */
async function view(method, args) {
  const res = await fetch("https://rpc.testnet.near.org", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "query",
      params: { request_type: "call_function", finality: "final", account_id: "v2.spade-taksir.testnet", method_name: method, args_base64: Buffer.from(JSON.stringify(args)).toString("base64") },
    }),
  }).then((r) => r.json());
  return JSON.parse(Buffer.from(res.result.result).toString());
}

/** The NEAR Connect iframe whose text includes `text`, polled for up to `ms`. */
async function walletFrame(page, text, ms = 30_000) {
  for (const end = Date.now() + ms; Date.now() < end; await wait(200)) {
    for (const f of page.frames()) {
      if (f.url() !== "about:srcdoc") continue;
      if ((await f.evaluate(() => document.body?.innerText ?? "").catch(() => "")).includes(text)) return f;
    }
  }
  throw new Error(`wallet never showed "${text}"`);
}

async function frameButton(frame, re) {
  return frame.evaluateHandle((src) => [...document.querySelectorAll("button, [role=button], div, span")].reverse().find((b) => new RegExp(src, "i").test(b.textContent?.trim() ?? "") && b.childElementCount <= 1), re.source);
}

async function clickIn(page, handle, ms = 700) {
  const b = await handle.boundingBox();
  await glide(page, b.x + b.width / 2, b.y + b.height / 2, ms);
  await wait(120);
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}

function runNear(cmd) {
  return new Promise((res, rej) => {
    const p = spawn("bash", ["-c", `timeout 120 ${cmd.trim()} send`], { stdio: ["ignore", "pipe", "pipe"] });
    let s = "";
    p.stdout.on("data", (d) => (s += d));
    p.stderr.on("data", (d) => (s += d));
    p.on("close", (c) => (c === 0 ? res(s.replace(/\x1b\[[0-9;]*m/g, "")) : rej(new Error(`near exit ${c}: ${s.slice(-800)}`))));
  });
}

/** The wallet's "Sign transaction" step: copy, run the command, paste the hash, Verify. */
async function signWithCli(page, label) {
  const frame = await walletFrame(page, "Sign transaction");
  mark(`${label}:prompt`);
  await wait(1500);
  const command = await frame.evaluate(() => document.querySelector("pre, code")?.textContent ?? "");
  await clickIn(page, await frameButton(frame, /^copy$/), 700);
  mark(`${label}:run`);
  const out = await runNear(command);
  const hash = out.match(/Transaction ID:\s*([1-9A-HJ-NP-Za-km-z]{43,44})/)?.[1];
  if (!hash) throw new Error(`no transaction hash in: ${out.slice(-800)}`);
  mark(`${label}:signed`);
  signed.push({ label, command: command.trim(), hash, output: out.split("\n").filter((l) => /Transaction ID|succeeded|Gas burned|Transaction fee/.test(l)).map((l) => l.replace(/^[│├└\s]+/, "").trim()) });
  await clickIn(page, await frame.$("input"), 600);
  await frame.type("input", hash, { delay: 12 });
  await wait(500);
  await clickIn(page, await frameButton(frame, /^verify$/), 600);
  mark(`${label}:verify`);
}

/** Connects the NEAR CLI wallet before recording: account ID, then the OS keychain. */
async function connect(page) {
  await page.goto(`${SITE}/taksir`, { waitUntil: "networkidle2" });
  await wait(2000);
  await (await page.evaluateHandle(() => [...document.querySelectorAll("button")].find((b) => /connect wallet/i.test(b.textContent)))).click();
  await (await page.waitForSelector("::-p-xpath(//*[normalize-space(text())='NEAR CLI'])", { visible: true })).click();
  const step1 = await walletFrame(page, "Connect with NEAR CLI");
  await step1.type("input", ACCOUNT);
  await (await frameButton(step1, /^next$/)).click();
  const step2 = await walletFrame(page, "Signing method");
  await (await frameButton(step2, /^keychain$/)).click();
  await wait(500);
  await (await frameButton(step2, /^continue$/)).click();
  await page.waitForSelector(`::-p-xpath(//*[normalize-space(text())='${ACCOUNT}'])`, { timeout: 20_000 });
  console.log(`connected as ${ACCOUNT}`);
}

const browser = await launch({ userDataDir: mkdtempSync(join(tmpdir(), "spade-wallet-")), protocolTimeout: 600_000 });
try {
  const page = await browser.newPage();
  await connect(page);
  await jumpTo(page, "#form-title", 200);
  await place(page, 1500, 900);
  await wait(2500);

  const stop = await startCapture(page);
  mark("start");
  await wait(1000);
  await click(page, ".data-input", 900);
  await page.keyboard.down("Control");
  await page.keyboard.press("a");
  await page.keyboard.up("Control");
  await page.keyboard.press("Backspace");
  await page.keyboard.type(LIST.join("\n"), { delay: 30 });
  await wait(600);
  await scroll(page, 380, 1200);
  await wait(400);
  mark("appraise:click");
  await click(page, "::-p-xpath(//button[starts-with(normalize-space(.),'APPRAISE')])", 900);
  await signWithCli(page, "appraise");

  await page.waitForSelector("::-p-xpath(//a[starts-with(normalize-space(.),'OPEN CASE #')])", { timeout: 240_000 });
  mark("appraise:result");
  await wait(5000);
  const caseLink = await page.$eval("::-p-xpath(//a[starts-with(normalize-space(.),'OPEN CASE #')])", (a) => a.textContent.trim());
  await click(page, "::-p-xpath(//a[starts-with(normalize-space(.),'OPEN CASE #')])", 900);
  mark("case:open");
  await page.waitForSelector("#sidak-title", { timeout: 30_000 });
  await wait(1800);
  const top = await page.$eval("#sidak-title", (el) => el.getBoundingClientRect().top);
  await scroll(page, top - 180, 1500);
  await wait(800);
  await click(page, "::-p-xpath(//button[normalize-space(.)='REVERSE'])", 800);
  mark("sidak:reverse");
  await wait(1800);
  const call = await box(page, "::-p-xpath(//button[starts-with(normalize-space(.),'CALL SIDAK')])");
  if (call.y + call.height > 1000) await scroll(page, call.y - 700, 900);
  mark("sidak:click");
  await click(page, "::-p-xpath(//button[starts-with(normalize-space(.),'CALL SIDAK')])", 900);
  await signWithCli(page, "sidak");

  const verdict = await page.waitForFunction(
    () => {
      const notice = document.querySelector("[aria-labelledby=sidak-title] [role=alert]")?.textContent;
      if (notice) return notice;
      return document.body.innerText.includes("BUSTED!") ? "BUSTED!" : null;
    },
    { timeout: 240_000, polling: 250 },
  );
  mark("sidak:verdict");
  const outcome = await verdict.jsonValue();
  await wait(6000);
  mark("end");
  const frames = await stop();

  const t0 = frames[0].t;
  const r = await encode(frames, new URL("../public/wallet.mp4", import.meta.url).pathname.slice(1));
  console.log(`wallet: ${r.seconds.toFixed(1)} s, ${r.captured} frames, ${caseLink}, ${outcome}`);
  const caseId = Number(caseLink.match(/\d+/)[0]);
  const appraisal = await view("get_appraisal", { id: caseId });
  const challenge = (await view("get_challenges", { appraisal_id: caseId })).findLast((c) => c.challenger === ACCOUNT);
  const data = {
    account: ACCOUNT,
    caseLink,
    outcome,
    appraisal: { id: caseId, price: appraisal.price },
    challenge: { price: challenge.price, status: challenge.status },
    list: LIST,
    signed,
    events: Object.fromEntries(events.map((e) => [e.name, Math.round((e.t - t0) * 100) / 100])) };
  writeFileSync(
    new URL("../src/walletOutput.ts", import.meta.url),
    `// Written by capture/wallet.mjs from the run that recorded public/wallet.mp4. Do not edit.\nexport const WALLET_RUN = ${JSON.stringify(data, null, 2)} as const;\n`,
  );
  console.log(JSON.stringify(data.events));
} finally {
  await browser.close();
}
