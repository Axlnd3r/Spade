# Section 2 — Kontrak TAKSIR: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kontrak NEP-141 `TAKSIR` yang menjalankan semua aturan M-1..M-16 dan invarian I-1..I-6, teruji dengan unit test dan sandbox tanpa OutLayer asli.

**Architecture:**
- Satu crate kontrak `contracts/taksir`, dibuat dengan `cargo near new`. Modul-modulnya dipisah per tanggung jawab:
  - `data.rs` — normalisasi dan hash, fungsi murni;
  - `params.rs` — parameter dan validasinya;
  - `epoch.rs` — epoch dan streak, fungsi murni;
  - `outlayer.rs` — argumen `request_execution` dan parsing output enclave, fungsi murni;
  - `types.rs` — struct state dan view;
  - `lib.rs` — kontrak, standar NEP, alur uang.
- Semua token (kas, kolam faucet, escrow) disimpan di akun FT milik kontrak sendiri dan dicatat dengan counter. Membakar token berarti `internal_withdraw` dari akun kontrak, sehingga `total_supply` turun.
- `contracts/mock-outlayer` adalah kontrak kecil yang meniru `request_execution` dengan antrean jawaban yang bisa diatur dari test sandbox.

**Tech Stack:** Rust 1.95 (dipin oleh `rust-toolchain.toml` dari template), `near-sdk` 5.30.1, `near-contract-standards` 5.30.1, `cargo-near` 0.23 di WSL. Test sandbox memakai `near-sandbox` 0.4 + `near-api` 0.8, mengikuti template `cargo near new` (D-11).

**Spec:** `README.md` (blueprint) bagian 2.3 (M-1..M-16), 2.4 (parameter), 2.5 (I-1..I-6), dan Section 2. Lihat juga `docs/DECISIONS.md` D-2, D-3, D-7, D-10. Peta tugas ada di `docs/superpowers/plans/2026-11-10-spade-roadmap.md`.

## Global Constraints

- **Perintah Rust** selalu dijalankan di WSL:
  `wsl -e bash -lc "cd /mnt/c/Users/User/Documents/Spade/contracts/taksir && CARGO_TARGET_DIR=\$HOME/.cache/spade-target/taksir cargo test"`.
  Target dir di filesystem Linux supaya build tidak lambat di NTFS. Untuk mock, ganti `taksir` dengan `mock-outlayer`.
- **Tanpa admin (M-16, T-3):** tidak ada field owner, setter parameter, method upgrade, atau method migrate. `Params` hanya ditulis di `new`.
- **Token:** nama `TAKSIR`, simbol `TAKSIR`, 18 desimal, `spec` `ft-1.0.0`. Supply 100.000.000 × 10^18 dicetak sekali di `new`: 60.000.000 ke kas dan 40.000.000 ke kolam faucet.
- **Rumus tertangkap (M-11)**, dengan aritmetika `u128` dan `>` ketat:
  `(max(p1,p2) - min(p1,p2)) * 10_000 > threshold_bps * max(p1,p2)`.
- **Parameter test**, kecuali test mengubahnya:
  - token (× 10^18): `appraisal_fee` 10, `challenge_stake` 50, `faucet_amount` 500;
  - aturan: `reward_multiplier` 4, `threshold_bps` **7500** (D-10), `budget_ppm` 20, `max_challenges` 3;
  - waktu: `epoch_ms` 600_000, `challenge_window_ms` 3_600_000;
  - data dan harga: `min_rows` 5, `max_rows` 100, `max_data_bytes` 2000, `price_min` 1, `price_max` 10000;
  - OutLayer: `outlayer_id` `outlayer.testnet`, `exec_deposit` 0,1 NEAR, `storage_fee` 0,05 NEAR.
- **Konstanta gas:** `REQUEST_GAS` = 100 TGas, `CALLBACK_GAS` = 40 TGas, `MIN_PREPAID_GAS` = 170 TGas.
- **Konstanta `resource_limits`:** `{"max_instructions": 10000000000, "max_memory_mb": 128, "max_execution_seconds": 60}`. `response_format` = `"Text"`. `payer_account_id` = pemanggil (D-7).
- **Normalisasi** mengikuti D-2 persis: trim hanya `' '`, `'\t'`, `'\r'`, tanpa `trim()` dan tanpa `is_ascii_whitespace()`. Pengurutan memakai byte UTF-8 (D-3).
- **Panic memakai kode pendek** yang bisa dicocokkan test dan web: `too_large`, `too_few_rows`, `too_many_rows`, `already_appraised`, `not_found`, `not_priced`, `window_closed`, `max_challenges`, `not_equivalent`, `same_order`, `deposit_low`, `gas_low`, `faucet_claimed`, `faucet_empty`, `transfer_to_contract`, `unregister_disabled`, `bad_params`.
- Setiap commit diakhiri baris `Co-Authored-By` sesuai instruksi sesi. Jangan push.

## Review Focus

1. **Token dikirim langsung ke akun kontrak.** `ft_transfer` atau `ft_transfer_call` ke akun kontrak akan membuat saldo kontrak tidak lagi sama dengan kas + faucet + escrow (I-2). Keduanya harus panic `transfer_to_contract`. Test di Task 2.
2. **Akun hilang sebelum refund.** Penantang bisa saja `storage_unregister` saat sidaknya masih `Pending`, sehingga refund di callback panic dan escrow tertahan selamanya. `storage_unregister` selalu panic `unregister_disabled`. Test di Task 2.
3. **Bentuk hasil OutLayer belum pasti** (D-7). Callback harus menerima stdout sebagai objek JSON mentah maupun sebagai string JSON yang membungkus objek. Hasil kosong, bukan JSON, berisi `err`, `h` salah, atau `p` di luar rentang dianggap `Failed`, tanpa panic. Test di Task 4.
4. **Lebih dari 1.000 epoch terlewat.** Satu panggilan hanya memproses 1.000 epoch. Panggilan berikutnya melanjutkan dari sana, dan `get_stats` menampilkan selisih antara epoch yang sudah diproses dan epoch menurut waktu. Test di Task 3: celah 2.500 epoch selesai setelah 3 kali `poke`.
5. **Hasil sidak tiba setelah taksiran sudah `Caught`, enclave gagal, atau budget nol.** Sidak yang terlambat menjadi `Voided`, stake kembali tanpa hadiah, dan tidak dihitung ke epoch. Sidak yang `Failed` melepas slot `max_challenges`. Budget nol berarti stake kembali tanpa entri log `Reward` bernilai 0. Test di Task 5.

---

### Task 1 (S2-T1): Kerangka crate + `data.rs`

**Files:**
- Create (via `cargo near new`): `contracts/taksir/` (`Cargo.toml`, `rust-toolchain.toml`, `src/lib.rs`, `tests/`)
- Create: `contracts/taksir/src/data.rs`
- Modify: `docs/DECISIONS.md` (D-11)

**Interfaces:**
- Consumes: `enclave/appraiser/vectors/vectors.json` (array berisi `{name, input, lines, raw_hash, canonical_hash, valid, error_code?}`)
- Produces:
  - `pub enum DataError { TooLarge, TooFewRows, TooManyRows }` dengan `pub fn code(&self) -> &'static str` (`"too_large"`, `"too_few_rows"`, `"too_many_rows"`);
  - `pub fn normalize_lines(text: &str) -> Vec<String>`;
  - `pub fn validate_data(text: &str, lines: &[String], min_rows: u32, max_rows: u32, max_data_bytes: u32) -> Result<(), DataError>`, dengan urutan cek `too_large` → `too_few_rows` → `too_many_rows`;
  - `pub fn raw_hash(lines: &[String]) -> [u8; 32]`, yaitu sha256 dari `lines.join("\n")` lewat `env::sha256_array`;
  - `pub fn canonical_hash(lines: &[String]) -> [u8; 32]`, yaitu salinan yang di-`sort()` (byte UTF-8) lalu diperlakukan seperti `raw_hash`;
  - `pub fn to_hex(h: &[u8; 32]) -> String`.

- [ ] **Step 1:** Di WSL, jalankan `cd contracts && rm -rf taksir && cargo +stable near new taksir`. Setelah itu:
  - hapus `contracts/taksir/.git` dan `.github/` kalau ada;
  - isi `repository = "https://github.com/Axlnd3r/Spade"`;
  - tambahkan `near-contract-standards = "5.30.1"` ke `[dependencies]`;
  - tambahkan `serde_json` kalau template belum menyediakan lewat `near_sdk::serde_json`.
  Contoh kontrak template diganti oleh task berikutnya. Untuk sekarang cukup kosongkan `lib.rs` sampai tinggal `mod data;`, supaya crate tetap ter-build.
- [ ] **Step 2: Tulis test yang gagal** di `data.rs` (`#[cfg(test)] mod tests`):
  - `vectors_match`: baca `include_str!("../../../enclave/appraiser/vectors/vectors.json")`. Untuk tiap kasus, cek `normalize_lines(input) == lines`. Kalau `valid`, cek juga `to_hex(raw_hash) == raw_hash` dan `to_hex(canonical_hash) == canonical_hash`. Kalau tidak `valid`, cek `validate_data(...).unwrap_err().code() == error_code`, dengan batas 5/100/2000.
  - `form_feed_and_nbsp_kept`: `normalize_lines("\u{0C}a\u{0B}\n b\u{A0} ")` menghasilkan `["\u{0C}a\u{0B}", "b\u{A0}"]`.
  - `canonical_is_order_free`: `canonical_hash(["b","a"]) == canonical_hash(["a","b"])` dan `!= raw_hash(["b","a"])`.
- [ ] **Step 3:** Jalankan `cargo test data::`. Harus FAIL karena fungsinya belum ada.
- [ ] **Step 4:** Implementasikan `data.rs` sesuai Interfaces. Trim dilakukan dengan `trim_matches(|c| c == ' ' || c == '\t' || c == '\r')`.
- [ ] **Step 5:** Jalankan `cargo test data::`. Semua PASS.
- [ ] **Step 6:** Tambahkan D-11 ke `docs/DECISIONS.md`: test sandbox memakai `near-sandbox` + `near-api` dari template `cargo near new`, bukan `near-workspaces` seperti di blueprint. Alasannya, template resmi near-sdk 5.30 dan skill `near-smart-contracts` memakai pasangan itu. Commit `feat(contract): scaffold taksir crate and data normalization`.

### Task 2 (S2-T2): `Params`, `new`, NEP-141/145/148, faucet, view dasar

**Files:**
- Create: `contracts/taksir/src/params.rs`, `contracts/taksir/src/types.rs`
- Modify: `contracts/taksir/src/lib.rs`

**Interfaces:**
- Produces (`params.rs`):
  - `#[near(serializers=[borsh, json])] pub struct Params` dengan field:
    - token dan aturan: `appraisal_fee: U128`, `challenge_stake: U128`, `reward_multiplier: u32`, `threshold_bps: u32`, `budget_ppm: u32`, `max_challenges: u32`, `faucet_amount: U128`;
    - waktu: `epoch_ms: u64`, `challenge_window_ms: u64`;
    - data dan harga: `min_rows: u32`, `max_rows: u32`, `max_data_bytes: u32`, `price_min: u32`, `price_max: u32`;
    - OutLayer: `outlayer_id: AccountId`, `wasm_url: String`, `wasm_hash: String`, `secrets_profile: String`, `secrets_owner: AccountId`, `exec_deposit: NearToken`, `storage_fee: NearToken`.
  - `impl Params { pub fn validate(&self) }` panic `bad_params` jika salah satu tidak terpenuhi:
    - `1 <= price_min <= price_max`;
    - `1 <= threshold_bps <= 9999`;
    - `epoch_ms > 0`;
    - `1 <= min_rows <= max_rows`;
    - `budget_ppm <= 1_000_000`;
    - `max_challenges >= 1`;
    - `wasm_hash` berupa 64 karakter hex huruf kecil.
- Produces (`types.rs`):
  - `pub enum LogKind { Mint, BurnFee, BurnStake, BurnEpoch, Reward, Faucet }`;
  - `pub struct LogEntry { kind: LogKind, account_id: Option<AccountId>, amount: U128, ref_id: Option<u64>, epoch_from: u64, epoch_to: u64, ts_ms: u64 }`;
  - `pub struct Stats { total_supply: U128, burned_total: U128, treasury: U128, faucet_pool: U128, escrow: U128, epoch_index: u64, epoch_by_time: u64, budget: U128, budget_left: U128, epoch_challenges: u32, epoch_catches: u32, clean_streak: u32, best_streak: u32, appraisal_count: u64, challenge_count: u64, log_count: u64 }`.
- Produces (`lib.rs`):
  - state `Contract { token: FungibleToken, metadata: LazyOption<FungibleTokenMetadata>, params: Params, treasury: u128, faucet_pool: u128, escrow: u128, faucet_claimed: LookupSet<AccountId>, burned_total: u128, log: Vector<LogEntry>, genesis_ms: u64, … }`. Field taksiran, sidak, dan epoch ditambahkan di Task 3–5. Storage prefix ditulis sebagai `enum StorageKey`.
  - Helper internal yang dipakai task berikutnya:
    - `fn burn_from_contract(&mut self, amount: u128, kind: LogKind, account_id: Option<AccountId>, ref_id: Option<u64>)`: `internal_withdraw` dari akun kontrak, `burned_total += amount`, event `FtBurn`, lalu push log;
    - `fn pay_from_contract(&mut self, to: &AccountId, amount: u128)`: `internal_transfer` dari akun kontrak;
    - `fn take_from_user(&mut self, from: &AccountId, amount: u128)`: `internal_transfer` ke akun kontrak;
    - `fn push_log(&mut self, kind, account_id, amount, ref_id, epoch_from, epoch_to)`.
  - Method:
    - `#[init] new(params: Params)`;
    - `#[payable] faucet() -> U128`;
    - `get_params() -> Params`, `get_stats() -> Stats`;
    - NEP-141 `ft_transfer`, `ft_transfer_call`, `ft_total_supply`, `ft_balance_of`, `ft_resolve_transfer`;
    - NEP-145 `storage_deposit`, `storage_withdraw`, `storage_unregister`, `storage_balance_bounds`, `storage_balance_of`;
    - NEP-148 `ft_metadata`.
  - Implementasi NEP mendelegasikan ke `self.token`, dengan dua pengecualian di Review Focus 1–2.

- [ ] **Step 1: Tulis test yang gagal** (unit test, `testing_env!`):
  - `new_mints_once` (M-1, M-2):
    - `ft_total_supply` = 10^26;
    - saldo kontrak = 10^26;
    - `treasury` = 6×10^25, `faucet_pool` = 4×10^25;
    - satu log `Mint` sebesar 10^26;
    - `ft_metadata().decimals == 18`;
    - `symbol == "TAKSIR"`.
  - `new_twice_panics`.
  - `bad_params_rejected`: masing-masing `price_min = 0`, `threshold_bps = 10000`, dan `wasm_hash = "xyz"` panic `bad_params`.
  - `faucet_once` (M-3):
    - klaim pertama memberi 500×10^18, mengurangi `faucet_pool` dengan jumlah yang sama, dan mencatat log `Faucet`;
    - klaim kedua oleh akun yang sama panic `faucet_claimed`.
  - `faucet_registers_storage`: akun belum terdaftar dengan deposit `storage_balance_bounds().min` berhasil klaim. Dengan deposit 0, klaim panic.
  - `faucet_empty`: dengan `faucet_amount` = 4×10^25 + 1, klaim panic `faucet_empty`.
  - `transfer_to_contract_rejected`: `ft_transfer` dan `ft_transfer_call` ke akun kontrak sendiri panic `transfer_to_contract`.
  - `unregister_disabled`: `storage_unregister(Some(false))` dan `storage_unregister(Some(true))` panic `unregister_disabled`.
  - `params_unchanged` (I-3): `get_params()` setelah faucet dan transfer sama dengan nilai sesudah `new`. Bandingkan hasil serialisasi JSON.
  - `supply_never_rises` (I-1): setelah faucet dan transfer, `ft_total_supply` tetap ≤ 10^26.
- [ ] **Step 2:** Jalankan `cargo test`. Test baru harus FAIL.
- [ ] **Step 3:** Implementasikan `params.rs`, `types.rs`, dan `lib.rs` sesuai Interfaces. Field `Stats` untuk epoch, taksiran, dan sidak diisi 0 dulu, lalu disambungkan di Task 3–5. `new` mendaftarkan akun kontrak, memanggil `internal_deposit` untuk seluruh supply, lalu mengirim event `FtMint`. `faucet` mengembalikan kelebihan NEAR yang dilampirkan.
- [ ] **Step 4:** Jalankan `cargo test`. Semua PASS.
- [ ] **Step 5:** Commit `feat(contract): token, params, faucet and base views`.

### Task 3 (S2-T3): Epoch malas, budget, streak, `poke`

**Files:**
- Create: `contracts/taksir/src/epoch.rs`
- Modify: `contracts/taksir/src/lib.rs`

**Interfaces:**
- Produces (`epoch.rs`, murni):
  - `pub struct EpochState { pub index: u64, pub budget: u128, pub budget_left: u128, pub challenges: u32, pub catches: u32 }`;
  - `pub struct Streak { pub clean: u32, pub best: u32 }`;
  - `pub const MAX_EPOCH_STEPS: u64 = 1000`;
  - `pub fn epoch_at(now_ms: u64, genesis_ms: u64, epoch_ms: u64) -> u64`;
  - `pub fn budget_for(treasury: u128, budget_ppm: u32) -> u128` (`treasury * ppm / 1_000_000`);
  - `pub fn advance(e: &mut EpochState, s: &mut Streak, treasury: &mut u128, target: u64, budget_ppm: u32) -> Option<(u64, u64, u128)>`. Fungsi ini menutup epoch satu per satu sampai `e.index == target` atau sudah 1.000 langkah. Tiap kali sebuah epoch ditutup:
    1. streak diperbarui: kalau `catches > 0`, `clean = 0`; kalau `challenges > 0` tanpa tangkapan, `clean += 1` dan `best = max(best, clean)`; kalau sepi, streak tidak berubah;
    2. `budget_left` dikurangkan dari `treasury`;
    3. `index += 1`, lalu budget baru = `budget_for(treasury)`, dan counter direset.
    Fungsi mengembalikan `(epoch_from, epoch_to, total_dibakar)` yang ditutup, atau `None` kalau tidak ada epoch yang ditutup.
- Produces (`lib.rs`):
  - field `epoch: EpochState`, `streak: Streak`;
  - `fn touch_epoch(&mut self)`: memanggil `advance` dengan `epoch_at(env::block_timestamp_ms())`, lalu memanggil `burn_from_contract(total, BurnEpoch, None, None)` dengan **satu** entri log yang mencakup rentang `epoch_from..epoch_to`, hanya kalau `total > 0`. Fungsi ini dipanggil di awal `faucet`, `appraise`, `challenge`, kedua callback, dan `poke`.
  - `pub fn poke(&mut self)`.
  - Budget epoch 0 dihitung di `new`.

- [ ] **Step 1: Tulis test yang gagal**:
  - `epoch_index` (M-13): `epoch_at(genesis + 1_199_999, genesis, 600_000) == 1`.
  - `genesis_budget` (M-14): `budget_left` = 6×10^25 × 20 / 10^6 = 1,2×10^21, yaitu 1.200 TAKSIR.
  - `unused_budget_burned`: maju 1 epoch lewat `poke`. Hasilnya:
    - `treasury` turun 1,2×10^21;
    - `ft_total_supply` turun dengan jumlah yang sama;
    - budget baru = `budget_for(treasury_baru, 20)`;
    - satu log `BurnEpoch` dengan `epoch_from = 0`, `epoch_to = 0`.
  - `many_epochs_one_log`: maju 5 epoch. Hasilnya satu log dengan `epoch_from = 0`, `epoch_to = 4`, dan jumlah = total dari pemanggilan berulang `budget_for` yang dihitung di test.
  - `cap_1000` (Review Focus 4): maju 2.500 epoch.
    - Setelah satu `poke`: `epoch_index == 1000` dan `epoch_by_time == 2500`.
    - Setelah tiga `poke`: `epoch_index == 2500`.
  - `streak_rules` (M-15), langsung di `advance`:
    - epoch dengan `challenges = 2, catches = 0` → `clean` naik 1;
    - epoch sepi → `clean` tetap;
    - epoch dengan `catches = 1` → `clean = 0`, `best` tetap.
- [ ] **Step 2:** Jalankan `cargo test epoch`. Harus FAIL.
- [ ] **Step 3:** Implementasikan `epoch.rs` dan sambungkan `touch_epoch` serta `poke` di `lib.rs`.
- [ ] **Step 4:** Jalankan `cargo test`. Semua PASS.
- [ ] **Step 5:** Commit `feat(contract): lazy epochs, budget burn and streak`.

### Task 4 (S2-T4): `appraise` + `on_appraise_result`

**Files:**
- Create: `contracts/taksir/src/outlayer.rs`
- Modify: `contracts/taksir/src/types.rs`, `contracts/taksir/src/lib.rs`

**Interfaces:**
- Produces (`outlayer.rs`, murni):
  - `pub fn input_data(normalized: &str) -> String`, menghasilkan `{"data":"…"}` lewat `serde_json` (M-10: bentuknya sama untuk taksiran dan sidak);
  - `pub fn request_args(p: &Params, input_data: &str, payer: &AccountId) -> Vec<u8>`, menghasilkan JSON `{source:{WasmUrl:{url,hash,build_target:"wasm32-wasip2"}}, resource_limits:{…}, input_data, secrets_ref:{profile,account_id}, response_format:"Text", payer_account_id}`;
  - `pub struct EnclaveOk { pub h: String, pub p: u32, pub r: String, pub m: String, pub c: String, pub a: String, pub g: String }`, dengan `r`, `m`, `c`, `a`, `g` opsional saat parsing (default `""`);
  - `pub fn parse_output(bytes: &[u8], expected_h: &str, price_min: u32, price_max: u32) -> Option<EnclaveOk>`. Fungsi ini menerima objek JSON atau string JSON yang membungkus objek. Hasilnya `None` jika salah satu terjadi:
    - bukan JSON;
    - `v != 1`;
    - ada field `err`;
    - `h != expected_h`;
    - `p` di luar `price_min..=price_max`.
- Produces (`types.rs`):
  - `pub enum AppraisalStatus { Pending, Priced, Caught, Failed }`;
  - `pub struct Appraisal { id: u64, owner: AccountId, data: String, raw_hash: String, canonical_hash: String, status: AppraisalStatus, price: Option<u32>, reason: String, model: String, chat_id: String, signing_address: String, signature: String, created_ms: u64, priced_ms: Option<u64>, active_challenges: u32, challenge_ids: Vec<u64> }`.
- Produces (`lib.rs`):
  - field `appraisals: Vector<Appraisal>`, `seen: LookupSet<[u8; 32]>`;
  - `#[payable] pub fn appraise(&mut self, data: String) -> Promise`;
  - `#[private] pub fn on_appraise_result(&mut self, id: u64)`, yang membaca `env::promise_result(0)`;
  - `get_appraisal(id: u64) -> Option<Appraisal>`;
  - helper `fn check_attached(&self) -> NearToken`, yang memastikan `attached >= exec_deposit + storage_fee` (panic `deposit_low`) dan `prepaid_gas >= MIN_PREPAID_GAS` (panic `gas_low`), lalu mengembalikan kelebihan deposit yang harus dikembalikan.
- **Alur `appraise`:**
  1. `touch_epoch`.
  2. Validasi data (panic dengan kode `DataError`).
  3. Kalau `canonical_hash` sudah ada di `seen`, panic `already_appraised`.
  4. `check_attached`.
  5. `take_from_user(appraisal_fee)` dan `escrow += fee`.
  6. Push taksiran `Pending` dan masukkan `canonical_hash` ke `seen`.
  7. Kembalikan kelebihan NEAR ke pemanggil.
  8. `Promise::new(outlayer_id).function_call("request_execution", args, exec_deposit, REQUEST_GAS).then(on_appraise_result(id) dengan CALLBACK_GAS)`.
- **Alur `on_appraise_result`:**
  - `touch_epoch` dulu.
  - **Sukses (M-8):**
    1. status `Priced`;
    2. isi `price`, `reason`, `model`, `chat_id`, `signing_address`, dan `signature`;
    3. `priced_ms = now`;
    4. `escrow -= fee`;
    5. `burn_from_contract(fee, BurnFee, owner, Some(id))`.
  - **Gagal:**
    1. status `Failed`;
    2. hapus `canonical_hash` dari `seen`;
    3. `escrow -= fee`;
    4. `pay_from_contract(owner, fee)`.

- [ ] **Step 1: Tulis test yang gagal** (unit, `testing_env!` dengan argumen `promise_results`):
  - `parse_output_shapes` (Review Focus 3):
    - objek mentah valid → `Some`;
    - string yang membungkus objek valid → `Some`;
    - hasil `None` untuk masing-masing: `b""`, `b"not json"`, `{"v":1,"err":"x"}`, `h` salah, `p: 0`, `p: 10001`, dan `v: 2`.
  - `input_data_shape`: `input_data("a\nb\"c") == "{\"data\":\"a\\nb\\\"c\"}"`.
  - `request_args_shape`:
    - JSON ter-parse memiliki `resource_limits.max_instructions == 10000000000`, `response_format == "Text"`, `payer_account_id == payer`, dan `source.WasmUrl.build_target == "wasm32-wasip2"`;
    - `input_data` berupa **string**.
  - `appraise_holds_fee` (M-7): saldo pemanggil turun 10×10^18, `escrow` naik dengan jumlah yang sama, dan status `Pending`.
  - `appraise_rejects`, masing-masing panic dengan kode berikut:
    - data 4 baris → `too_few_rows`;
    - data 2.001 byte → `too_large`;
    - data yang sama atau yang sudah diacak urutannya, saat yang pertama masih `Pending` → `already_appraised`;
    - deposit kurang → `deposit_low`.
  - `appraise_success_burns` (M-8, I-5):
    - callback sukses dengan `p = 300` dan `h` yang benar;
    - status `Priced`, `price == Some(300)`;
    - `ft_total_supply` turun 10×10^18;
    - `escrow == 0`;
    - log `BurnFee`.
  - `appraise_failure_refunds` (M-8, I-5):
    - callback gagal (`PromiseResult::Failed`);
    - status `Failed`, saldo pemanggil kembali penuh, supply tetap, `escrow == 0`;
    - data yang sama setelah itu bisa di-`appraise` lagi.
  - `appraise_bad_output_refunds`: callback sukses tapi `h` salah. Perlakuannya sama dengan gagal.
  - `callback_private` (I-6): `on_appraise_result` yang dipanggil akun lain panic.
- [ ] **Step 2:** Jalankan `cargo test`. Test baru harus FAIL.
- [ ] **Step 3:** Implementasikan sesuai Interfaces dan alur di atas.
- [ ] **Step 4:** Jalankan `cargo test`. Semua PASS.
- [ ] **Step 5:** Commit `feat(contract): appraise via outlayer with result validation`.

### Task 5 (S2-T5): `challenge` + `on_challenge_result`

**Files:**
- Modify: `contracts/taksir/src/types.rs`, `contracts/taksir/src/lib.rs`, `docs/DECISIONS.md` (D-12)

**Interfaces:**
- Consumes: `normalize_lines`, `validate_data`, `raw_hash`, `canonical_hash`, `to_hex` (Task 1); `input_data`, `request_args`, `parse_output` (Task 4); `touch_epoch`, `pay_from_contract`, `take_from_user`, `burn_from_contract`, `check_attached` (Task 2–4).
- Produces:
  - `pub fn is_caught(p1: u32, p2: u32, threshold_bps: u32) -> bool` di `lib.rs` (rumus M-11, `u128`);
  - `pub enum ChallengeStatus { Pending, Caught, Survived, Failed, Voided }`;
  - `pub struct Challenge { id: u64, appraisal_id: u64, challenger: AccountId, variant: String, raw_hash: String, status: ChallengeStatus, price: Option<u32>, reward: U128, chat_id: String, signing_address: String, signature: String, created_ms: u64, resolved_ms: Option<u64> }`;
  - field `challenges: Vector<Challenge>`;
  - `#[payable] pub fn challenge(&mut self, appraisal_id: u64, variant: String) -> Promise`;
  - `#[private] pub fn on_challenge_result(&mut self, challenge_id: u64)`.
- **Alur `challenge` (M-9):**
  1. `touch_epoch`.
  2. Cek taksiran:
     - taksiran ada, kalau tidak panic `not_found`;
     - status `Priced`, kalau tidak panic `not_priced`;
     - `now <= priced_ms + challenge_window_ms`, kalau tidak panic `window_closed`;
     - `active_challenges < max_challenges`, kalau tidak panic `max_challenges`.
  3. Cek variant:
     - `validate_data`;
     - `canonical_hash` sama dengan aslinya, kalau tidak panic `not_equivalent`;
     - `raw_hash` berbeda dari aslinya, kalau tidak panic `same_order`.
  4. `check_attached`.
  5. `take_from_user(challenge_stake)`, `escrow += stake`, dan `active_challenges += 1`.
  6. Push sidak `Pending` lalu kirim promise dengan `input_data(variant ternormalisasi)`.
- **Alur `on_challenge_result`:**
  1. `touch_epoch`.
  2. Kalau hasil gagal atau `parse_output` mengembalikan `None` (M-12):
     - status `Failed`;
     - `active_challenges -= 1`;
     - stake dikembalikan;
     - epoch tidak dihitung.
  3. Kalau taksiran sudah `Caught`:
     - status `Voided`;
     - stake dikembalikan tanpa hadiah;
     - epoch tidak dihitung.
  4. Kalau `is_caught(p1, p2, threshold_bps)`:
     - sidak dan taksiran berstatus `Caught`;
     - `reward = min(reward_multiplier * stake, budget_left)`;
     - `treasury -= reward` dan `budget_left -= reward`;
     - `pay_from_contract(challenger, stake + reward)`;
     - log `Reward` hanya jika `reward > 0`;
     - `epoch.challenges += 1` dan `epoch.catches += 1`.
  5. Selain itu:
     - status `Survived`;
     - `burn_from_contract(stake, BurnStake, challenger, Some(challenge_id))`;
     - `epoch.challenges += 1`.
  Di semua cabang, `escrow -= stake`.

- [ ] **Step 1: Tulis test yang gagal**:
  - `caught_boundary` (M-11, batas ketat): `is_caught(100, 400, 7500) == false`, `is_caught(100, 401, 7500) == true`, `is_caught(401, 100, 7500) == true`, `is_caught(7, 7, 7500) == false`, dan `is_caught(10000, 1, 7500) == true`.
  - `challenge_rejects` (M-9), masing-masing panic dengan kode berikut:
    - taksiran `Pending` → `not_priced`;
    - lewat jendela waktu → `window_closed`;
    - sidak keempat saat 3 sidak masih `Pending` → `max_challenges`;
    - variant dengan isi berbeda → `not_equivalent`;
    - variant dengan urutan identik → `same_order`.
  - `challenge_caught` (M-11):
    - `p1 = 100`, `p2 = 401`;
    - penantang menerima 50 + 200 TAKSIR;
    - `treasury` turun 200×10^18 dan `ft_total_supply` tetap;
    - taksiran dan sidak berstatus `Caught`;
    - `epoch_catches == 1`;
    - sidak berikutnya pada taksiran itu panic `not_priced`.
  - `challenge_survived`: `p2 = 400`. Hasilnya stake dibakar, supply turun 50×10^18, log `BurnStake`, `epoch_challenges == 1`, dan `epoch_catches == 0`.
  - `challenge_failed_refunds` (M-12): callback gagal. Hasilnya stake kembali, slot dilepas (`active_challenges` kembali ke nilai sebelumnya), dan counter epoch tidak berubah.
  - `reward_capped_by_budget` (Review Focus 5):
    - dengan `budget_ppm` kecil sehingga `budget_left` = 30×10^18, penantang menerima 50 + 30;
    - pada tangkapan berikutnya di epoch yang sama, `budget_left = 0`, penantang hanya menerima 50, dan tidak ada log `Reward`.
  - `late_result_voided`: dua sidak `Pending`. Yang pertama tertangkap. Hasil kedua masuk dengan status `Voided`, stakenya kembali, tanpa hadiah, dan `epoch_challenges` tetap 1.
  - `counted_at_result_epoch`: sidak dikirim di epoch 0 dan hasilnya masuk di epoch 1. Counter-nya masuk ke epoch 1.
  - `challenge_callback_private` (I-6).
- [ ] **Step 2:** Jalankan `cargo test`. Test baru harus FAIL.
- [ ] **Step 3:** Implementasikan sesuai Interfaces dan alur di atas.
- [ ] **Step 4:** Jalankan `cargo test`. Semua PASS.
- [ ] **Step 5:** Tambahkan D-12 ke `docs/DECISIONS.md`. Isinya penyimpangan dan pelengkap terhadap blueprint:
  - status `Voided`;
  - `LogKind::Mint`;
  - satu log `BurnEpoch` per rentang epoch;
  - `storage_unregister` dimatikan;
  - transfer ke akun kontrak ditolak;
  - parameter `exec_deposit` dan `storage_fee` (biaya storage tetap yang tidak dikembalikan);
  - sidak `Failed` melepas slot `max_challenges`.
  Commit `feat(contract): challenge flow with rewards and burns`.

### Task 6 (S2-T6): View berhalaman + invarian

**Files:**
- Modify: `contracts/taksir/src/lib.rs`

**Interfaces:**
- Produces:
  - `get_appraisals(from: u64, limit: u64) -> Vec<Appraisal>`;
  - `get_challenges(appraisal_id: u64) -> Vec<Challenge>`;
  - `get_log(from: u64, limit: u64) -> Vec<LogEntry>`;
  - `limit` dijepit ke 100, dan `from >= len` mengembalikan `[]`.
  - Helper test `fn assert_invariants(c: &Contract)` (hanya `#[cfg(test)]`):
    - jumlah saldo semua akun yang dikenal test == `ft_total_supply` (I-2);
    - saldo kontrak == `treasury + faucet_pool + escrow` (I-2).

- [ ] **Step 1: Tulis test yang gagal**:
  - `paging`: buat 3 taksiran.
    - `get_appraisals(1, 10)` mengembalikan id 1 dan 2;
    - `get_appraisals(5, 10)` mengembalikan `[]`;
    - `get_appraisals(0, 1000)` mengembalikan paling banyak 100 item;
    - `get_log` mengikuti aturan yang sama.
  - `invariants_hold_through_flows` (I-2, I-4, I-5): satu skenario gabungan yang memanggil `assert_invariants` setelah tiap langkah. Langkah-langkahnya: `new`, faucet ×2, taksiran sukses, taksiran gagal, sidak tertangkap, sidak lolos, sidak gagal, dan pergantian epoch. Selain itu:
    - `treasury` hanya turun di langkah tangkapan dan pergantian epoch (I-4);
    - `escrow == 0` di akhir (I-5).
- [ ] **Step 2:** Jalankan `cargo test`. Harus FAIL.
- [ ] **Step 3:** Implementasikan view dan helper.
- [ ] **Step 4:** Jalankan `cargo test`. Semua PASS.
- [ ] **Step 5:** Commit `feat(contract): paged views and invariant tests`.

### Task 7 (S2-T7): Mock OutLayer + 13 skenario sandbox + build

**Files:**
- Create (via `cargo near new mock-outlayer`): `contracts/mock-outlayer/`
- Create: `contracts/taksir/tests/sandbox.rs`. Hapus `tests/test_basics.rs` bawaan template.

**Interfaces:**
- Produces (mock):
  - `#[payable] request_execution(source: Value, resource_limits: Value, input_data: String, secrets_ref: Value, response_format: String, payer_account_id: Option<AccountId>) -> PromiseOrValue<String>`. Method ini menyimpan argumen terakhir, lalu mengambil satu item dari antrean:
    - `Price(p)`: mengembalikan string `{"v":1,"h":<sha256 hex dari field data di input_data>,"p":p,"r":"mock","m":"mock","c":"","a":"","g":""}`;
    - `Raw(s)`: mengembalikan `s` apa adanya;
    - `Fail`: panic.
  - `push(item: MockItem)`;
  - `last_request() -> Option<Value>`.
- Consumes: semua method publik kontrak dari Task 2–6.

- [ ] **Step 1:** Di WSL, buat mock dengan `cd contracts && rm -rf mock-outlayer && cargo +stable near new mock-outlayer`. Rapikan seperti Task 1 Step 1, implementasikan sesuai Interfaces, lalu jalankan `cargo near build non-reproducible-wasm`. Hasilnya `.wasm` di `target/near/`.
- [ ] **Step 2: Tulis `tests/sandbox.rs`** dengan pola dari template (`near_sandbox::Sandbox::start_sandbox`, `near_api`, build wasm via `cargo_near_build`). Mock di-build dari `../mock-outlayer/Cargo.toml` dengan cara yang sama, lalu di-deploy ke `outlayer.sandbox` dan dipakai sebagai `outlayer_id`. Satu `#[tokio::test]` per skenario blueprint:
  1. Taksiran sukses membakar fee: supply turun 10×10^18.
  2. Taksiran gagal (`Fail`) mengembalikan fee: supply tetap.
  3. `canonical_hash` yang sama ditolak (`already_appraised`).
  4. Variant dengan isi berbeda ditolak (`not_equivalent`), variant dengan urutan identik ditolak (`same_order`).
  5. Tertangkap (`Price(100)` lalu `Price(401)`): stake + hadiah diterima, kas turun 200×10^18, supply tetap, status `Caught`.
  6. Tidak tertangkap (`Price(100)` lalu `Price(400)`): stake dibakar, supply turun 50×10^18.
  7. Enclave gagal saat sidak: stake kembali.
  8. Hadiah dibatasi sisa budget. Saat budget nol, penantang hanya menerima stake kembali.
  9. Pergantian epoch membakar sisa budget. Pakai `epoch_ms` kecil dan `sandbox.fast_forward(n)`, lalu cek `epoch_index` naik dan `burned_total` bertambah. Uji juga `poke()`.
  10. Jendela waktu ditegakkan (pakai `challenge_window_ms` kecil dan `fast_forward`). Sidak keempat ditolak (`max_challenges`). Taksiran `Caught` tidak bisa disidak lagi.
  11. Faucet hanya sekali per akun.
  12. Callback yang dipanggil akun lain ditolak.
  13. Streak naik pada epoch bersih, reset pada epoch tertangkap, tetap pada epoch sepi.
  Tambahan: `last_request()` di skenario 1 dan 5 menunjukkan `input_data` dengan bentuk `{"data": …}` yang sama (M-10) dan `payer_account_id` = pemanggil.
- [ ] **Step 3:** Jalankan `cargo test --test sandbox`. Semua PASS. Kalau gagal, pakai skill systematic-debugging, jangan menebak.
- [ ] **Step 4:** Jalankan `cargo near build non-reproducible-wasm` untuk `taksir`. Catat ukuran `.wasm` di `docs/WORKLOG.md`.
- [ ] **Step 5:** Commit `test(contract): mock outlayer and sandbox scenarios`.

### Task 8 (S2-R): Review → CHECKPOINT 2

- [ ] **Step 1:** Jalankan `cargo test` (unit + sandbox) dan `cargo clippy -- -D warnings`. Semua bersih.
- [ ] **Step 2:** Lakukan satu review menyeluruh oleh reviewer baru, dengan fokus:
  - keamanan uang: I-2, I-5, callback, dan refund;
  - setiap aturan M punya test;
  - Review Focus di atas.
  Perbaiki temuan Critical dan Important dengan TDD.
- [ ] **Step 3:** Perbarui `docs/WORKLOG.md`. Commit.
- [ ] **Step 4: CHECKPOINT 2. Berhenti.** Laporkan ke manusia:
  - daftar test dan hasilnya;
  - setiap penyimpangan dari bagian 2.3 (D-11, D-12);
  - ukuran wasm.
  Tunggu jawaban sebelum deploy apa pun.
