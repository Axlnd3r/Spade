# Spade: TAKSIR × SIDAK

Built for the NEAR HACKATHON 2026, track **Memecoins With Mechanics**. Testnet only.

TAKSIR is a NEP-141 token whose rules live in one NEAR contract. Anyone can pay 50 TAKSIR (burned) to have an AI appraiser ("Mr. X") put a price from 1 to 10,000 on a list of text lines. The AI runs inside a TEE from code whose hash is pinned in the contract, and every answer is stored on-chain with the model's signature. SIDAK is a spot check on that appraiser: a holder stakes 25 TAKSIR and sends the **same lines in a different order**. The order changes nothing, so the second price should match the first. If the two prices are more than 75% apart, the appraiser is "caught": the challenger gets the stake back plus 50 TAKSIR from the contract's treasury. If they are close, the stake is burned. There is no mint function, so the supply can only fall: fees, lost stakes and unclaimed reward budget are all burned.

| | |
|---|---|
| Live demo | https://axlnd3r.github.io/Spade/ |
| Repository | https://github.com/Axlnd3r/Spade (MIT, see `LICENSE`) |
| Demo video | About 88 s, captions only; script, scenes and how it is rebuilt in `docs/DEMO.md` (source in `video/`) |
| Threat model | `docs/THREAT_MODEL.md`: prompt injection, farming, noise, outages, leaked keys, collusion, front end |
| Contract (testnet) | `v2.spade-taksir.testnet` |
| Contract code SHA-256 | `a8b90d5a9d54ce1fb9085ee0e2980780acd8c8f4431d5ae2f92b5b7c0b6b0127` |
| Pinned enclave SHA-256 | `0206187e1ba0c53acb5c5e991b1d559c20eafb01d617a387be5a0848c7348ee2` |
| AI model | `Qwen/Qwen3-VL-30B-A3B-Instruct` on NEAR AI Cloud (confidential TEE) |
| Access keys on the contract | **1 at the time of writing** (the deploy key). The final lock deletes it; after that `near account list-keys` prints an empty table. If you still see 1 key, the lock has not happened yet. |

Contents: [Judge quickstart](#1-judge-quickstart) · [Mechanics](#2-mechanics) · [Trust chain](#3-trust-chain-and-how-to-check-it) · [Simulation](#4-60-day-simulation) · [Limits](#5-limits) · [Deployment](#6-testnet-deployment) · [Run it yourself](#7-run-it-yourself) · [NEAR features and libraries](#8-near-features-libraries-and-templates) · [Provenance](#9-provenance)

---

## 1. Judge quickstart

### Browser (no wallet needed for steps 1 to 5)

| Do this | You should see |
|---|---|
| Open https://axlnd3r.github.io/Spade/ and click **EXPLORE** | The "How it works" page: three steps with their costs, and a slider for Mr. X's second answer. Drag it: at 2,500 the verdict is HELD (exactly 75% apart is not enough), at 2,499 it is BUSTED. |
| Menu → **Overview** | Live supply, burned total, treasury, countdown to the next epoch, reward budget left, "epochs since Mr. X got busted", latest cases. All read from NEAR testnet over RPC. |
| Menu → **Cases** → open **#3** | Price 10,000, status BUSTED. The SIDAK list shows 10,000 → 1 (99.99% apart) and a reward of +50. Case **#2** shows PRICED with a SIDAK that was HELD (1,500 vs 2,500, 40% apart). |
| Menu → **Ledger** | Every mint, burn and reward the contract has made: `Mint (genesis)` of 100,000,000, `Faucet`, `Fee burned −50`, `Stake burned −25`, `Reward +50`, `Epoch budget burned`. |
| Menu → **Verify** | Live checks against `docs/TESTNET.md`: contract code hash and pinned enclave hash both show "MATCHES", the access-key count, and every parameter. |
| *(wallet)* Menu → **Taksir** → CONNECT WALLET → claim the faucet → APPRAISE | A card with a price and a one-line reason within about 10 to 90 seconds, and a new `Fee burned −50` in the Ledger. You need testnet NEAR: the faucet attaches 0.01 NEAR and each call attaches 0.0571 NEAR (about 0.006 comes back). A list that was already priced is refused ("the same lines in any order can only be priced once"): change a line. |
| *(wallet)* Open your case → **SIDAK** → REVERSE → CALL SIDAK | A second price next to the first. Either HELD (your 25 TAKSIR stake is burned) or BUSTED (stake back plus 50). |

### Command line (no wallet, no browser)

One command checks the live contract against this repository (Node 18 or later, no install, no key, sends no transaction):

```bash
node scripts/verify.mjs            # add --require-locked to fail while the contract still has access keys
```

It reads everything at one final block and prints PASS or FAIL for each check: the deployed code hash equals the `taksir.wasm` SHA-256 in `docs/TESTNET.md`; `get_params` equals `scripts/params.testnet.json`; the pinned enclave hash and URL equal the release, and the downloaded `appraiser.wasm` hashes to it; the ledger has exactly one mint (genesis) and supply + burned = 100,000,000; the burns in the ledger add up to `burned_total`; and the contract's balance equals treasury + faucet pool + escrow. The access-key count is a WARN until the final lock. Exit code 0 means every check passed.

The same facts by hand, with [near-cli-rs](https://github.com/near/near-cli-rs) (tested with 0.30.1).

```bash
# Parameters, fixed at launch (there are no setters)
near contract call-function as-read-only v2.spade-taksir.testnet get_params json-args '{}' network-config testnet now
# Supply, treasury, epoch, streaks, counts
near contract call-function as-read-only v2.spade-taksir.testnet get_stats json-args '{}' network-config testnet now
# A busted case and its challenge (appraisal: price 10000, status Caught; challenge: price 1, reward 50 TAKSIR)
near contract call-function as-read-only v2.spade-taksir.testnet get_appraisal json-args '{"id":3}' network-config testnet now
near contract call-function as-read-only v2.spade-taksir.testnet get_challenges json-args '{"appraisal_id":3}' network-config testnet now
# The ledger of every mint, burn and reward
near contract call-function as-read-only v2.spade-taksir.testnet get_log json-args '{"from":0,"limit":20}' network-config testnet now
# Access keys, and the deployed code hash ("Local Contract (SHA-256 checksum hex)")
near account list-keys v2.spade-taksir.testnet network-config testnet now
near account view-account-summary v2.spade-taksir.testnet network-config testnet now
```

You should see: the parameters of section 2, a `get_stats` whose `total_supply` is below 100,000,000 and `burned_total` above 0, case 3 with `status: "Caught"`, a code hash equal to the one in the table above, and the key count described there.

---

## 2. Mechanics

All rules run in the contract (`contracts/taksir`). The enclave only turns text into a price.

**Token.** NEP-141, 18 decimals. 100,000,000 TAKSIR are minted once, inside `new`: 60,000,000 to the treasury (the contract's own balance, tracked separately) and 40,000,000 to a testnet faucet pool. There is no team allocation and **no mint function**. `ft_transfer` and `ft_transfer_call` to the contract account are rejected, and `storage_unregister` always fails, so the contract's own balance always equals treasury + faucet pool + escrow.

**Faucet** (testnet only). One claim of 500 TAKSIR per account. The caller attaches 0.01 NEAR to pay for the storage the call writes; the excess is refunded.

**Data.** UTF-8 text. Normalisation: split on `\n`, trim spaces, tabs and `\r` from both ends of each line, drop empty lines. Allowed: 5 to 100 lines and at most 2,000 bytes of raw text. `raw_hash` is the SHA-256 of the lines joined with `\n`; `canonical_hash` is the same after sorting the lines bytewise. Two data sets are **equivalent** when their `canonical_hash` is equal. The contract checks this, not the AI.

**`appraise(data)`.** The caller attaches at least 0.0571 NEAR and 170 TGas. The contract holds the 50 TAKSIR fee, refuses a `canonical_hash` that was appraised before, and calls OutLayer's `request_execution` with the pinned enclave hash. On success the appraisal is `Priced` with price `p1` and the fee is burned. On failure or timeout it is `Failed`, the fee is refunded and the `canonical_hash` is released.

**`challenge(appraisal_id, variant)`.** Valid only if the appraisal is `Priced`, less than one hour old, has fewer than 3 challenge slots in use, and `variant` is equivalent to the original data but not byte-identical (`raw_hash` differs). The contract holds a 25 TAKSIR stake. The enclave receives `{"data": "..."}` in exactly the same shape as for an appraisal and cannot tell the two apart.

**Verdict.** Let `p1` be the first price and `p2` the second. The appraiser is caught when

```
(max(p1,p2) - min(p1,p2)) * 10000  >  threshold_bps * max(p1,p2)        (strict, threshold_bps = 7500)
```

- **Caught:** the appraisal becomes `Caught` and cannot be challenged again. The challenger gets the stake back plus `reward = min(2 × stake, remaining epoch budget)` from the treasury.
- **Not caught (`Survived`):** the stake is burned.
- **`Voided`:** the result arrived after another challenge had already caught the appraisal. Stake refunded, no reward.
- **`Failed`:** the enclave failed or timed out. Stake refunded, the slot is released, nothing else changes. The contract never depends on the enclave being up for transfers, the faucet, epochs or views.

**Epochs.** `epoch = (now − genesis) / epoch_ms` (10 minutes on testnet). Rollover is lazy: it runs at the start of every state-changing method and through `poke()`, which anyone can call. At the start of each epoch the reward budget is `treasury × budget_ppm / 1,000,000` (5 ppm, about 300 TAKSIR). Budget left at the end of an epoch is **burned from the treasury**. Skipped epochs are processed in one call (at most 1,000), written as a single `BurnEpoch` ledger entry covering the range.

**Streaks.** An epoch is *clean* if at least one challenge was decided and none caught the appraiser, *caught* if at least one did, and *quiet* if there were no challenges (no effect). `clean_streak` and `best_streak` are part of `get_stats`.

**No admin.** No owner field, no setters, no upgrade or migrate method. `new` is private (only the contract account can call it) and pins the enclave hash. Parameters that must be non-zero are checked in `new`.

**Public methods.** `faucet`, `appraise`, `challenge`, `poke`, `get_params`, `get_stats`, `get_appraisal`, `get_appraisals`, `get_challenges`, `get_log`, plus the NEP-141 and NEP-145 methods.

**Invariants tested.** Supply never rises after `new`; supply equals the sum of balances; the contract's own balance equals treasury + faucet pool + escrow; `get_params` is identical before and after every flow; the treasury only falls through rewards or end-of-epoch burns; every held fee or stake ends in exactly one place (burned, refunded, or refunded with reward); callbacks can only be called by the contract itself.

### Parameters as deployed

Read them any time with `get_params`. They were chosen in `docs/DECISIONS.md` D-10 and D-15 from the experiment and the simulation below.

| Parameter | Value | Note |
|---|---|---|
| `appraisal_fee` | 50 TAKSIR | burned on a successful appraisal |
| `challenge_stake` | 25 TAKSIR | |
| `reward_multiplier` | 2 | reward 50 TAKSIR; a challenger breaks even above 1 catch in 3 |
| `threshold_bps` | 7500 | caught when more than 75% apart |
| `budget_ppm` | 5 | about 300 TAKSIR per epoch from a 60,000,000 treasury |
| `epoch_ms` | 600,000 | 10 minutes (testnet); 24 hours is the mainnet direction |
| `challenge_window_ms` | 3,600,000 | 1 hour after pricing |
| `max_challenges` | 3 | per appraisal |
| `min_rows` / `max_rows` / `max_data_bytes` | 5 / 100 / 2,000 | |
| `price_min` / `price_max` | 1 / 10,000 | prices outside this range are rejected |
| `faucet_amount` | 500 TAKSIR | once per account |
| `exec_deposit` / `storage_fee` | 0.0071 NEAR / 0.05 NEAR | the first is forwarded to OutLayer and mostly refunded; the second is kept for storage |
| `outlayer_id` | `outlayer.testnet` | |
| `wasm_url`, `wasm_hash` | see the table at the top | pins the enclave |
| `secrets_profile`, `secrets_owner` | `taksir`, `spade-taksir.testnet` | OutLayer secret holding the NEAR AI key |

---

## 3. Trust chain and how to check it

1. **The contract runs every rule that moves money.** Check: `view-account-summary` shows the code SHA-256 from the top table (the web Verify page compares it live); `list-keys` shows the key count; `get_params` shows the values above. `node scripts/verify.mjs` runs all three checks.
2. **OutLayer only runs the WASM whose SHA-256 the contract pinned.** Check: `get_params` gives `wasm_url` and `wasm_hash`; `curl -sL <wasm_url> | sha256sum` must print that hash. The enclave also builds reproducibly: run `scripts/build_github_wasm.sh --dir enclave/appraiser --target wasm32-wasip2 --twice --keep` from the [OutLayer repository](https://github.com/out-layer/outlayer) at commit `3fb03a9e` (Docker, compiler image pinned by digest in `docs/TESTNET.md`); both builds produced the same bytes and the hash above.
3. **Intel TDX attests that the code ran with that input and produced that output.** Check: the OutLayer dashboard shows an attestation for each execution (MRTD and RTMR0 to 3, `wasm_hash`, `input_hash`, `output_hash`, the TDX quote and a link to the transaction). This repository does not verify the quote itself.
4. **NEAR AI Cloud runs the model in a TEE and signs each response.** Check: every appraisal and challenge stores `model`, `chat_id`, `signing_address`, `signature` and `response_hash`. The signed text is `MODEL:sha256(request body):response_hash`. Recompute the request hash from `enclave/appraiser/prompt.txt` and the data (see `src/request.rs`), recover the signer from `signature` (EIP-191), and compare it with `signing_address` and with the model attestation. The enclave **keeps** `signing_address` and `signature` only when the signed text matches this exact request and reply (`docs/DECISIONS.md` D-13); it does not itself verify the ECDSA signature, and no script in this repository does yet.

**What stays trusted:** Intel and NVIDIA hardware, the OutLayer contract and workers, the NEAR AI gateway. A TEE shows **which code ran**, not that the price is right. That is why SIDAK exists.

---

## 4. 60-day simulation

`python sim/simulate.py` writes `docs/sim/summary.md` and three charts. It is a deterministic expected-value model (`sim/model.py`, standard library only), not an agent-based simulation. Catch rates come from the experiment below. Charts and tables are labelled in Indonesian.

| Scenario | Appraisals/day | Challenges per appraisal | Other |
|---|---|---|---|
| `sepi` (idle) | 5 | 0.2 | |
| `normal` | 50 | 1.0 | |
| `ai_buruk` (bad AI) | 50 | 1.0 | ordinary lists caught 40% of the time |
| `farming` | 50 | 1.0 | plus an attacker who appraises its own trap data and challenges it |

Result after 60 days with the deployed parameters. Testnet runs 10-minute epochs, so the budget is renewed (and the unused part burned) 144 times a day:

| Scenario, 10-minute epochs (as deployed) | Final supply | Final treasury | Total burned | Rewards paid |
|---|---:|---:|---:|---:|
| idle | 97,447,133 | 57,463,183 | 2,552,867 | 300 |
| normal | 97,260,683 | 57,463,183 | 2,739,317 | 15,000 |
| bad AI | 97,328,183 | 57,463,183 | 2,671,817 | 60,000 |
| farming | 97,260,683 | 57,463,183 | 2,739,317 | 15,000 |

The same parameters with 24-hour epochs, the direction for a mainnet launch (this is what the charts below plot):

| Scenario, 24-hour epochs | Final supply | Final treasury | Total burned | Rewards paid |
|---|---:|---:|---:|---:|
| idle | 99,965,953 | 59,982,003 | 34,047 | 300 |
| normal | 99,779,503 | 59,982,003 | 220,497 | 15,000 |
| bad AI | 99,805,000 | 59,982,003 | 195,000 | 17,997 |
| farming | 99,779,503 | 59,982,003 | 220,497 | 15,000 |

Findings (details in `docs/sim/summary.md` and `docs/DECISIONS.md` D-15):

- A challenger breaks even at a catch probability of 33.3%. Ordinary lists are caught 10.0% of the time at the 75% threshold, so blind challenges lose on average; deliberately manipulable lists are caught 46.7% of the time.
- Farming is capped by the epoch budget, and with a 50 TAKSIR fee equal to the 50 TAKSIR reward a sure attacker's profit is exactly 0 (a fee of 10 would have allowed 33,824 TAKSIR a day on testnet). The treasury falls by the same amount with or without an attacker; farming only changes whether budget is burned or paid out.
- The treasury ends the same in every scenario because unclaimed budget is burned each epoch regardless.

Charts (24-hour epochs):

![Supply over 60 days](docs/sim/supply.svg)
![Total burned over 60 days](docs/sim/burned.svg)
![Treasury over 60 days](docs/sim/treasury.svg)

**The experiment behind the catch rates** (`docs/EXPERIMENT.md`, `spike/`): 160 calls to `Qwen/Qwen3-VL-30B-A3B-Instruct`, each data set appraised in its original order and in 3 random permutations. At the 75% threshold, ordinary data was caught in 9 of 90 pairs (10.0%) and adversarial data in 14 of 30 (46.7%). The endpoint is **not deterministic even at `temperature: 0`**: re-asking the same ordering gave a different price in 20% of the tries, and 1 of 45 such pairs (2.2%) would already count as caught at 75%.

---

## 5. Limits

Each attack, what stops it and what is left is in `docs/THREAT_MODEL.md`. The short list:

- **Testnet only, not audited.** The coin has no cash value. The faucet can be claimed by any number of accounts.
- **The price is not used for trade yet.** In this version the price is a claim that can be audited. A data market and payments (for example over x402) are roadmap items and are not implemented.
- **The order test is one kind of test.** The enclave deliberately does not sort the lines, because the measured quantity is the model's stability under changes that should not matter. Other equivalence tests are roadmap items.
- **Some catches are noise.** The model is not deterministic, so a challenge can be decided by sampling noise rather than by the order. At 75% the noise-only rate measured was 2.2%.
- **Prompt injection is part of the game.** A list that makes the price depend on its order is a legitimate catch. The cost is bounded by the epoch budget. A skilled hunter can take a whole epoch's budget; a fee equal to the reward removes the profit of farming one's own data but not of catching other people's traps.
- **Sybil.** The faucet can be claimed by many accounts. Careless challenges lose money below the 33.3% break-even.
- **Unclaimed budget is burned in bulk after idle periods.** The first state-changing call after a quiet stretch burns the budget of all skipped epochs at once (for example 41,585 TAKSIR in one `BurnEpoch` entry on 2026-11-12). This is the designed behaviour, and it makes the burned total jump.
- **Dependencies.** Appraisals and challenges stop if OutLayer or NEAR AI Cloud are down. Transfers, the faucet, epochs, burns and views keep working.
- **The model and prompt are fixed by hash.** A new appraiser means a new contract.
- **The contract build is not reproducible.** It was built with `cargo near build non-reproducible-wasm`; the deployed code hash is recorded here and in `docs/TESTNET.md`, but rebuilding from source may give a different hash. The enclave build is reproducible.
- **The contract still has one access key** until the final lock (see the table at the top).
- **The enclave does not verify the NEAR AI signature cryptographically** (section 3, link 4).
- **All data is public.** Everything that is appraised is stored on-chain.
- **Wallet testing.** The browser flow was exercised end to end on testnet with a stub wallet injected through NEAR Connect and signing through near-cli (`docs/TESTNET.md`, section "Web"). Popups of real wallets were not tested. NEAR Mobile is not offered: its executor rejects testnet.
- **Browser support.** The magnifier cursor only bends the page in Chromium; elsewhere it is plain glass. The 3D scene needs WebGL; without it a static card is shown.

---

## 6. Testnet deployment

Details and the commands to re-check each row are in `docs/TESTNET.md`.

| Item | Value |
|---|---|
| Parent account | `spade-taksir.testnet` |
| Contract | `v2.spade-taksir.testnet`, `new` called by the contract account |
| Create-account transaction | `5KkaDosNCW9D1mAzqbGYTPfFzfyvExaxRKah6WFnoNgF` |
| Deploy + `new` transaction | `2yFKVHrpSaqkbHCkMY9d3nsJCX8jE9phniFcYeaznurm` |
| `taksir.wasm` | SHA-256 `a8b90d5a…b0127`, 262,766 bytes; code hash (base58) `CMd9x3xLmM3dm9HDsxhZMz1Z4Etzcs3RgasvMnarWV4J` |
| Enclave | tag `enclave-v1`, `wasm_url` https://github.com/Axlnd3r/Spade/releases/download/enclave-v1/appraiser.wasm, SHA-256 `0206187e…48ee2`, 213,917 bytes |
| Model signing address | `0x2665cce942fa427ef30d87f4b0bff67fb7645462` (from the NEAR AI model attestation) |
| Archive | `v1.spade-taksir.testnet` (appraisal fee 10), kept as the record of the option that was not chosen |

On-chain runs on `v2` (every transaction is in `docs/TESTNET.md`):

| Run | Appraisal | Challenge | Result |
|---|---|---|---|
| `scripts/e2e.mjs`, run 1 | #0, ordinary list: 1,500 | shuffled | `Survived` (1,500 vs 1,500) |
| | #1, trap list: 10,000 | reversed | **`Caught`** (1 vs 10,000), reward 50 |
| `scripts/e2e.mjs`, run 2 | #2, ordinary list: 2,500 | shuffled | `Survived` (1,500 vs 2,500) |
| | #3, trap list: 10,000 | reversed | **`Caught`** (1 vs 10,000), reward 50 |
| Browser flow, stub wallet | #4, same kind of trap list, priced 1 (`FLomTkzDCJwXT39LHRfKyZ1Kcc6vTFCKLoqWPip2HTbF`) | reversed (`eqLC3fxi1wvQ1fW6ucbJCJTzTaG9y5EmG5Ppoa9sCDs`) | `Survived` (1 vs 1) |

The model priced the same trap list at 10,000 in the e2e runs and at 1 in the browser run, which is the variation described in section 4.

---

## 7. Run it yourself

The author works on Windows 11 with WSL2 (Ubuntu 24.04). Versions in use: Rust 1.95.0 (pinned by `rust-toolchain.toml` in the contract and enclave crates), `cargo-near` 0.23.0, `wasmtime` 50, Docker Desktop, Node 24, Python 3.13, near-cli-rs 0.30.1, OutLayer CLI.

| What | Command (from the repository root) | Tests |
|---|---|---|
| Contract unit tests | `cd contracts/taksir && cargo test --lib` | 75 |
| Contract sandbox tests (downloads a NEAR sandbox node; about 5 minutes) | `cd contracts/taksir && cargo test --test sandbox` | 18 |
| Mock OutLayer | `cd contracts/mock-outlayer && cargo test` | 3 |
| Enclave | `cd enclave/appraiser && cargo test` | 32 |
| Consistency experiment code | `cd spike && node --test` | 50 |
| Script helpers and `verify.mjs` | `node --test scripts/verify.test.mjs scripts/lib/near.test.mjs` | 11 |
| Simulation | `python -m unittest sim/test_model.py`, then `python sim/simulate.py` | 15 |
| Web | `cd web && npm ci && npm test && npm run build` (dev server: `npm run dev`) | 71 |

Rust commands ran in WSL with a Linux target directory, for example `CARGO_TARGET_DIR=$HOME/.cache/spade-target/taksir cargo test`.

Build the contract: `cd contracts/taksir && cargo near build non-reproducible-wasm`. Build the enclave: see section 3, link 2.

Re-run the experiment (needs your own NEAR AI Cloud key): copy `.env.example` to `.env`, fill `NEAR_AI_API_KEY`, then `node spike/consistency.mjs --model Qwen/Qwen3-VL-30B-A3B-Instruct`.

Scripts (testnet only; see `scripts/README.md`). They sign as the author's account `spade-taksir.testnet`, so to run them as yourself change `PARENT` in `scripts/deploy.sh` and pass your account to the e2e script:

```bash
bash scripts/deploy.sh 3                                        # new contract vN, needs a funded parent account
node scripts/e2e.mjs v2.spade-taksir.testnet <your-account>     # faucet, appraise, challenge, twice, then the supply invariant
```

After a deploy, the OutLayer secret must be set again with the new contract in the whitelist (command in `scripts/README.md`). Never commit the NEAR AI key; `.env` is git-ignored.

Repository layout:

| Folder | Contents |
|---|---|
| `contracts/taksir` | the contract (Rust, near-sdk 5), unit and sandbox tests |
| `contracts/mock-outlayer` | a stand-in for OutLayer used by the tests |
| `enclave/appraiser` | the WASI enclave: reads `{"data": ...}`, asks NEAR AI Cloud for a price, returns JSON of at most 900 bytes; `prompt.txt` is the prompt |
| `spike` | the consistency experiment and the shared data-rule test vectors |
| `sim` | the 60-day model and its tests |
| `web` | the static site (Vite, React, TypeScript, three.js) deployed to GitHub Pages by `.github/workflows/pages.yml` |
| `scripts` | deploy, end-to-end and read-only `verify.mjs` scripts |
| `video` | the demo video: Remotion composition and the headless-Chrome recorder of the live site (`docs/DEMO.md`) |
| `docs` | `DECISIONS.md` (every deviation from the blueprint), `THREAT_MODEL.md`, `DEMO.md`, `EXPERIMENT.md`, `TESTNET.md`, `WORKLOG.md`, `BLUEPRINT.md` (the original build spec, in Indonesian), `sim/`, `superpowers/` (plans and specs) |

---

## 8. NEAR features, libraries and templates

**NEAR.** NEP-141 fungible token and NEP-145 storage management (through `near-contract-standards`); cross-contract call with a callback to OutLayer (`request_execution`, `outlayer.testnet`), including a secret bound to the enclave's WASM hash; NEAR AI Cloud private inference with signed responses; NEAR testnet sub-accounts; NEAR Connect for wallets (`@hot-labs/near-connect`); `near-cli-rs` for the scripts; NEAR sandbox for integration tests; `cargo-near` for builds. Two agent skills from `near/agent-skills` (`near-ai-cloud`, `near-smart-contracts`) are installed for the coding agent under `.claude/skills/` (`skills-lock.json`). Those 17 files are third-party material under their own terms, not written for this project.

**Rust (contract).** `near-sdk` 5.30.1, `near-contract-standards` 5.30.1; dev: `near-sandbox` 0.4, `near-api` 0.8, `cargo-near-build` 0.11, `tokio` 1, `testresult` 0.4.

**Rust (enclave, target `wasm32-wasip2`).** `serde` 1, `serde_json` 1, `sha2` 0.11, `wasi` 0.13. The HTTP client over WASI is written in this repository (`src/wasi_http.rs`), because `wasi-http-client` 0.2.1 trapped on request bodies above 4,096 bytes (`docs/DECISIONS.md` D-13). Reproducible build: OutLayer's `build_github_wasm.sh` and its pinned compiler image.

**Web.** React 19.3.1, react-dom 19.3.1, react-router-dom 7.18.5, three 0.187.0 (including its `EffectComposer`, `UnrealBloomPass` and `Reflector` examples), `@hot-labs/near-connect` 0.12.0; dev: Vite 8.3.8, Vitest 5.1.0, TypeScript 7.0.2, Testing Library, jsdom. Font: Unbounded (SIL Open Font License 1.1) from Google Fonts.

**Experiment and simulation.** Node built-ins only (`spike`), Python standard library only (`sim`).

**Video.** Remotion 4.0.543 (`@remotion/cli`, `@remotion/media`, `@remotion/transitions`, `@remotion/google-fonts`; free for individuals and teams of up to 3 under the Remotion license), `puppeteer-core` 24 driving the installed Chrome to record the live site. Scaffolded with `npx create-video --blank`.

**Templates and references.** The official `cargo near new` template (cargo-near 0.23) was the reference for the sandbox test setup (`docs/DECISIONS.md` D-11). OutLayer's build script and documentation were the reference for the enclave. The site's visual direction was inspired by ohzi.io; no code or assets were taken from it.

---

## 9. Provenance

- **Hackathon rule on prior code:** this project has no code from before the hackathon. The first commit is `2635fcc` on 2026-11-10 (`git log --reverse`); every file here was written after the 2026-10-19 announcement.
- **AI tools used to build it:** Claude Code (Anthropic). The models named in the `Co-Authored-By` trailers of the commits are Claude Opus 5.5 (most commits) and Claude Sonnet 5.5; a few commits carry a plain "Claude". The agent worked from the plans and specs in `docs/superpowers/` (the Superpowers plugin workflow) and from the blueprint in `docs/BLUEPRINT.md`. Every decision that changed the product was made by the human author at the checkpoints recorded in `docs/WORKLOG.md` and `docs/DECISIONS.md`.
- **What the human author did by hand:** provided the NEAR AI key and the OutLayer secret, funded the testnet account, chose the model's threshold and the final parameters (checkpoints 1 and 4), picked the product direction, supplied the card engravings (`web/src/scene/mrx-*.png`) and the style reference `DESIGN_OHZI.md`, and owns the demo post and the submission. The card back is an original SVG (`web/src/scene/cardArt.ts`).
- **The demo video** was assembled by the agent: the site scenes are headless-Chrome recordings of the live site, the terminal scene shows the real output of `scripts/verify.mjs`, and the captions are text (`docs/DEMO.md`).
- **At runtime the product uses AI** only inside the enclave: one call to the model above per appraisal or challenge.
- **No secret has been committed.** `.env` is ignored; the NEAR AI key lives only in an OutLayer secret bound to the enclave hash.
