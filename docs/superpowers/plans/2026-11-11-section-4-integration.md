# Section 4 — Integrasi testnet, simulasi, kunci parameter: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alur penuh (faucet → taksir → sidak) berjalan di testnet memakai enclave asli dan parameter yang dipilih dari simulasi 60 hari.

**Architecture:**
- **Kontrak:** sebelum deploy pertama, kontrak dikeraskan sedikit. Parameter yang bernilai nol ditolak, field `s` (hash respons AI, D-13) disimpan, dan ada test pertumbuhan storage. Ini perlu karena parameter tidak bisa diubah setelah `new`.
- **Simulasi:** `sim/` adalah model nilai harapan deterministik, ditulis dalam Python standar tanpa dependensi. Grafiknya SVG yang ditulis langsung.
- **Deploy:** `scripts/deploy.sh` (Git Bash) membuat sub-akun `vN.spade-taksir.testnet` lalu men-deploy dengan `new`, yang ditandatangani akun kontrak sendiri karena `new` bersifat `#[private]`.
- **E2E:** `scripts/e2e.mjs` (Node, tanpa dependensi) menjalankan alur di testnet lewat `near.exe` dan RPC.

**Tech Stack:**
- Python 3.13 (`unittest`, `json`, `math`);
- Node 24 (`node:test`, `child_process`, `fetch`);
- `near-cli-rs` 0.30.1 di `C:/Users/User/bin/near.exe` dengan legacy keychain;
- `cargo near` di WSL.

**Spec:** `README.md` (blueprint):
- Section 4;
- bagian 2.4 (parameter), termasuk "Titik impas penantang";
- T-4 dan T-6.

Dokumen pendukung:
- `docs/EXPERIMENT.md`, yang memuat tingkat tertangkap;
- `docs/DECISIONS.md` D-7, D-10, D-12, D-13, D-14;
- `docs/TESTNET.md`.

## Global Constraints

- **Hanya testnet.** Akun induk `spade-taksir.testnet`. Setiap deploy memakai sub-akun baru `v1.spade-taksir.testnet`, `v2…`, dan seterusnya, karena parameter dan hash WASM tidak bisa diubah.
- **Enclave:**
  - `wasm_url` = `https://github.com/Axlnd3r/Spade/releases/download/enclave-v1/appraiser.wasm`;
  - `wasm_hash` = `0206187e1ba0c53acb5c5e991b1d559c20eafb01d617a387be5a0848c7348ee2`;
  - `secrets_profile` = `taksir`;
  - `secrets_owner` = `spade-taksir.testnet`;
  - `outlayer_id` = `outlayer.testnet`.
- **Deposit:** `exec_deposit` 0,0071 NEAR (D-14). `storage_fee` final ditentukan dari pengukuran di Task 1, minimal mencakup pertumbuhan storage terburuk.
- **Tingkat tertangkap** dibaca dari `docs/EXPERIMENT.md` (run 2026-11-11), lihat tabel di Task 2. Angka itu tidak boleh diganti tanpa eksperimen baru.
- **Agent tidak boleh:**
  - menghapus access key akun mana pun (blueprint bagian 0);
  - menyentuh mainnet;
  - push tanpa izin.
- **Secret OutLayer dipasang ulang oleh manusia** dengan whitelist akun kontrak.
- **Perintah Rust** dijalankan di WSL dengan `CARGO_TARGET_DIR=$HOME/.cache/spade-target/<crate>`.
- **Commit** diakhiri baris `Co-Authored-By` sesuai instruksi sesi.

## Review Focus

1. **Parameter yang membuat alur macet selamanya.** Fee, stake, faucet, `exec_deposit`, atau jendela sidak bernilai 0 tidak bisa diperbaiki setelah `new`. Nilai seperti itu harus ditolak dengan `bad_params`. Test di Task 1.
2. **Storage yang dibayar terlalu kecil.** Taksiran atau sidak terburuk (data 2.000 byte dan balasan enclave terberat) menyimpan lebih banyak byte daripada yang ditanggung `storage_fee`, sehingga saldo NEAR kontrak pelan-pelan terkuras. Sandbox mengukur pertumbuhan storage dan memastikan biayanya ≤ `storage_fee`. Test di Task 1.
3. **E2E dijalankan dua kali pada kontrak yang sama.** Faucet sudah pernah diklaim dan data yang sama sudah ditaksir. Run kedua harus melewati faucet dan memakai data baru, bukan gagal. Test di Task 5.
4. **Simulasi dengan budget nol atau kas habis.** Tidak boleh ada pembagian nol atau saldo negatif, dan kurva harus tetap monoton turun. Test di Task 2.
5. **Serangan farming.** Penyerang yang membuat data jahil lalu menyidaknya sendiri tidak boleh bisa mengambil lebih dari budget per epoch. Simulasi menghitung untung atau rugi penyerang per hari secara eksplisit, supaya keputusan di CHECKPOINT 4 berdasar angka. Test di Task 2.

---

### Task 1 (S4-T0): Kontrak — pengerasan sebelum deploy pertama

**Files:**
- Modify: `contracts/taksir/src/params.rs`, `src/outlayer.rs`, `src/types.rs`, `src/lib.rs`, `src/tests.rs`, `tests/sandbox.rs`
- Modify: `docs/DECISIONS.md` (lengkapi D-12)

**Interfaces:**
- Produces:
  - `Params::validate` juga menolak nilai berikut dengan `bad_params`:
    - `appraisal_fee == 0`, `challenge_stake == 0`, `faucet_amount == 0`;
    - `exec_deposit == 0`;
    - `challenge_window_ms == 0`;
    - `reward_multiplier == 0`.
  - `EnclaveOk` mendapat field `s: String`, opsional saat parsing.
  - `Appraisal` dan `Challenge` mendapat field `response_hash: String`, diisi dari `s`.

- [ ] **Step 1: Tulis test yang gagal.**
  - Unit test `bad_params_zero_values`: untuk tiap field di atas, `setup_with(Params { <field>: 0, ..test_params() })` panic `bad_params`. Satu test per field.
  - `parse_output_reads_s`: output dengan `"s": "cd"×32` menghasilkan `ok.s == "cd"×32`, dan output tanpa `s` menghasilkan `""`.
  - `appraise_success_stores_response_hash` dan `challenge_stores_response_hash`: field `response_hash` sama dengan `s` dari output.
  - Sandbox `s15_storage_paid_by_storage_fee` (Review Focus 2):
    - data 100 baris / 1.999 byte dan mock `Padded`;
    - ukur `storage_usage` akun kontrak (RPC `view_account`) sebelum dan sesudah `appraise`, lalu sebelum dan sesudah `challenge`;
    - assert `delta_bytes × 10^19 yocto ≤ storage_fee` untuk keduanya;
    - cetak kedua delta.

    Mock `Padded` perlu diberi field `s` (64 hex) supaya ukurannya realistis. Tambahkan juga ke `contracts/mock-outlayer`, dengan test-nya.
- [ ] **Step 2:** Jalankan `cargo test --lib` lalu `cargo test --test sandbox s15`. Harus FAIL.
- [ ] **Step 3:** Implementasikan sesuai Interfaces.
- [ ] **Step 4:** Jalankan seluruh test (unit + sandbox + mock). Semua PASS. Catat delta storage terukur di ledger. Kalau `storage_fee` 0,05 NEAR tidak cukup, naikkan di `test_params` dan di D-15 (Task 3).
- [ ] **Step 5:** Tambahkan butir 12–13 ke D-12, yaitu validasi nol dan `response_hash`. Commit `feat(contract): reject zero params, store response hash, pin storage cost`.

### Task 2 (S4-T1): Simulasi 60 hari

**Files:**
- Create: `sim/model.py` (model murni), `sim/charts.py` (SVG), `sim/simulate.py` (CLI), `sim/test_model.py`
- Create (hasil): `docs/sim/*.svg`, `docs/sim/summary.md`

**Interfaces:**
- Produces (`model.py`):
  - `CATCH = {7000: (0.156, 0.467), 7500: (0.100, 0.467), 8000: (0.056, 0.467), 8500: (0.022, 0.467)}`. Ini pasangan (normal, jahil) dari `docs/EXPERIMENT.md`. Skenario "AI buruk" memakai normal = 0,40.
  - `@dataclass Params: appraisal_fee=10, challenge_stake=50, reward_multiplier=4, threshold_bps=7500, budget_ppm=20, epoch_hours=24.0, treasury0=60_000_000, supply0=100_000_000, faucet0=40_000_000`. Satuannya TAKSIR, bukan yocto.
  - `@dataclass Scenario: name, appraisals_per_day, challenges_per_appraisal, catch_normal: float | None (None → dari CATCH), farming: bool`. Untuk farming, penyerang membuat 1 data jahil per sidak dan selalu menyidak 3× per data, sampai budget epoch habis.
  - `SCENARIOS`:
    - `sepi`: 5 taksiran/hari, 0,2 sidak per taksiran;
    - `normal`: 50 taksiran, 1,0 sidak per taksiran;
    - `ai_buruk`: 50 taksiran, 1,0 sidak per taksiran, catch 0,40;
    - `farming`: `normal` + penyerang.
  - `simulate(p: Params, s: Scenario, days=60) -> list[Day]`. `Day` memuat: `day, supply, treasury, burned_total, rewards_paid, budget_burned, attacker_net`. Modelnya nilai harapan per epoch:
    1. `budget = treasury × ppm / 10^6`;
    2. fee dibakar = `appraisals × fee`;
    3. sidak jujur = `appraisals × cpa`, dengan tangkapan harapan `q × sidak`;
    4. hadiah dibayar = `min(tangkapan × mult × stake, budget)`;
    5. stake dibakar = `(1 − q) × sidak × stake`;
    6. sisa budget dibakar dari kas.

    Penyerang farming menyidak lebih dulu dalam epoch, memakai `q_adv`, dengan biaya `fee` per data ditambah stake yang hilang. `attacker_net` = hadiah − fee − stake hilang.
  - `breakeven_q(p) -> float` = `stake / (mult × stake + stake)` (blueprint 2.4: 20% untuk 50/4).
  - `sweep(grid) -> list[dict]`, menghasilkan supply akhir, kas akhir, total terbakar, dan `attacker_net` per hari untuk tiap kombinasi `threshold_bps ∈ {7000, 7500, 8000}`, `budget_ppm ∈ {5, 10, 20, 50}`, `reward_multiplier ∈ {2, 3, 4}`, dan `challenge_stake ∈ {25, 50, 100}`.
- Produces (`charts.py`): `line_chart(series: dict[str, list[float]], title: str, y_label: str, path: str)`. Fungsi ini menulis SVG ber-viewBox dengan sumbu, grid, legenda, dan warna aman untuk tema terang maupun gelap. Ikuti skill `dataviz` saat menulisnya.
- Produces (`simulate.py`): `python sim/simulate.py` menulis `docs/sim/supply.svg`, `docs/sim/treasury.svg`, `docs/sim/burned.svg` (satu garis per skenario, dengan parameter terpilih), dan `docs/sim/summary.md` (tabel skenario + tabel sweep 10 baris teratas + titik impas).

- [ ] **Step 1: Tulis test yang gagal** di `sim/test_model.py` (unittest):
  - `test_breakeven_matches_blueprint`: `breakeven_q(Params()) == 0.2`.
  - `test_quiet_burns_whole_budget`: dengan 0 taksiran, kas hari 1 = `60e6 × (1 − 20e-6)`, `rewards_paid == 0`, dan supply turun sebesar budget.
  - `test_reward_capped_by_budget`: dengan q = 1,0 dan banyak sidak, `rewards_paid` per hari = budget per hari.
  - `test_supply_never_rises_and_never_negative` (Review Focus 4): untuk semua skenario dan semua kombinasi sweep, supply dan kas turun monoton dan ≥ 0. Termasuk `budget_ppm = 1_000_000`.
  - `test_farming_capped_by_budget` (Review Focus 5): pada skenario `farming`, hadiah penyerang per epoch ≤ budget per epoch.
  - `test_farming_unprofitable_below_breakeven`: kalau `q_adv` < `breakeven_q`, maka `attacker_net` < 0.
  - `test_deterministic`: dua pemanggilan menghasilkan daftar yang identik.
- [ ] **Step 2:** Jalankan `python -m unittest sim/test_model.py`. Harus FAIL.
- [ ] **Step 3:** Implementasikan `model.py`, lalu `charts.py` dan `simulate.py`. Muat skill `dataviz` sebelum menulis `charts.py`.
- [ ] **Step 4:** Jalankan unittest. Semua PASS. Lalu jalankan `python sim/simulate.py`. Hasilnya: 3 SVG dan `summary.md` tertulis. Buka satu SVG untuk memastikan tampilannya terbaca.
- [ ] **Step 5:** Commit `feat(sim): 60-day expected-value simulation with SVG charts`.

### Task 3 (S4-T2): Parameter final

**Files:**
- Create: `scripts/params.testnet.json`, yaitu argumen `new` lengkap dalam satuan yocto dan string
- Modify: `docs/DECISIONS.md` (D-15)

- [ ] **Step 1:** Dari `docs/sim/summary.md`, pilih `threshold_bps`, `budget_ppm`, `challenge_stake`, dan `reward_multiplier`. Kriterianya:
  - **(a)** data biasa tidak menguntungkan untuk disidak asal-asalan, artinya `q_normal < breakeven`;
  - **(b)** farming dibatasi budget, dengan kerugian kas per hari yang dapat diterima;
  - **(c)** kas tidak habis dalam 60 hari.

  `epoch_ms` testnet = 600.000 (10 menit, blueprint 2.4). Arah mainnet adalah 86.400.000, dan simulasi dijalankan dengan dua-duanya. `challenge_window_ms` = 3.600.000. `storage_fee` diambil dari Task 1, dan `exec_deposit` = 0,0071 NEAR.
- [ ] **Step 2:** Tulis `params.testnet.json`. Validasi dengan `node -e`: kunci-kuncinya harus persis sama dengan nama field `pub` di `contracts/taksir/src/params.rs`, tanpa yang kurang dan tanpa yang lebih. Tulis D-15 berisi tabel nilai, alasan per baris, dan angka simulasinya. Commit `docs: final testnet parameters (D-15)`.

### Task 4 (S4-T3): `scripts/deploy.sh` + deploy v1 (👤 secret)

**Files:**
- Create: `scripts/deploy.sh`, `scripts/README.md` (cara pakai)

**Interfaces:**
- Produces: `bash scripts/deploy.sh <N>` (Git Bash di Windows) menjalankan langkah berikut:
  1. Build kontrak di WSL dengan `cargo near build non-reproducible-wasm`, lalu salin ke `dist/taksir.wasm`. Cetak sha256-nya.
  2. Jika akun belum ada, buat `vN.spade-taksir.testnet` dengan `near.exe account create-account fund-myself vN.spade-taksir.testnet '5 NEAR' autogenerate-new-keypair save-to-legacy-keychain sign-as spade-taksir.testnet network-config testnet sign-with-legacy-keychain send`.
  3. Deploy dan init dalam satu transaksi yang ditandatangani akun kontrak: `near.exe contract deploy vN.… use-file dist/taksir.wasm with-init-call new json-args "$(params)" prepaid-gas '100 Tgas' attached-deposit '0 NEAR' network-config testnet sign-with-legacy-keychain send`.
  4. Cetak `get_params` dan `get_stats`. Kalau akun vN sudah berisi kontrak, skrip berhenti dengan pesan "pakai N berikutnya".
- Script ini **tidak** menghapus access key. Penghapusan key (T-3) adalah langkah manusia di S6.

- [ ] **Step 1:** Tulis skrip. Jalankan `bash -n scripts/deploy.sh` (lolos syntax), lalu `shellcheck` kalau ada.
- [ ] **Step 2:** Jalankan `bash scripts/deploy.sh 1`. Hasilnya: kontrak `v1.spade-taksir.testnet` aktif, `get_params` sama dengan `params.testnet.json`, dan `ft_total_supply` = 10^26.
- [ ] **Step 3: 👤** Minta manusia menjalankan di WSL (spasi di awal):

  ```bash
   outlayer secrets set '{"NEAR_AI_API_KEY":"…"}' --wasm-hash 0206187e1ba0c53acb5c5e991b1d559c20eafb01d617a387be5a0848c7348ee2 --profile taksir --access whitelist:v1.spade-taksir.testnet,spade-taksir.testnet --direct
  ```

  `--direct` menilai akun yang memanggil `outlayer.testnet`, yaitu kontrak.
- [ ] **Step 4:** Catat di `docs/TESTNET.md` ID kontrak, sha256 `taksir.wasm`, hash transaksi deploy, dan parameter. Commit `feat(scripts): deploy script; contract v1 on testnet`.

### Task 5 (S4-T4): `scripts/e2e.mjs` → CHECKPOINT 4

**Files:**
- Create: `scripts/lib/near.mjs`, `scripts/lib/near.test.mjs`, `scripts/e2e.mjs`

**Interfaces:**
- Produces (`lib/near.mjs`):
  - `txId(output: string): string | null` — ambil `Transaction ID: <base58>` dari output `near.exe`;
  - `view(contract, method, args) -> Promise<any>` — RPC `call_function` ke `https://rpc.testnet.near.org`;
  - `call(signer, contract, method, args, {depositNear, tgas}) -> {ok, tx, out}` — lewat `child_process.spawnSync(NEAR_EXE, [...])`, tanpa shell;
  - `txStatus(hash, sender) -> Promise<any>` — RPC `EXPERIMENTAL_tx_status`;
  - `shuffledDifferent(lines: string[], seed: number): string[]` — permutasi deterministik yang urutannya pasti berbeda (lempar error kalau semua baris sama);
  - `uniqueData(tag: string, now: number): string` — 5–8 baris, salah satunya memuat `now` supaya `canonical_hash` selalu baru.
- Produces (`e2e.mjs`): `node scripts/e2e.mjs v1.spade-taksir.testnet` dengan penanda tangan `spade-taksir.testnet`. Langkahnya:
  1. Faucet hanya kalau `faucet_claimed` belum. Deteksinya: saldo 0 → faucet, selain itu dilewati.
  2. `appraise(uniqueData)` dengan deposit `exec_deposit + storage_fee` dan 300 TGas, lalu tunggu sampai `get_appraisal` = `Priced` (maksimal 90 detik).
  3. `challenge(id, shuffledDifferent)`. Hasilnya `Survived`, `Caught`, `Failed`, atau `Voided`, dan semuanya dicatat.
  4. Taksiran kedua memakai `spike/datasets/adversarial/a02.txt` ditambah baris unik, lalu disidak dengan urutan terbalik (peluang `Caught` tertinggi di EXPERIMENT).
  5. `get_stats` dan 10 entri terakhir `get_log`.
  6. Ringkasan: hash transaksi tiap langkah, status, `payer` refund (transfer di `txStatus`), dan pengecekan I-2 lewat view (`ft_balance_of(kontrak) == treasury + faucet_pool + escrow`).

  Exit 0 kalau semua langkah selesai dengan status terminal dan I-2 terpenuhi.

- [ ] **Step 1: Tulis test yang gagal** di `scripts/lib/near.test.mjs`:
  - `txId` dari contoh output yang benar dan yang tanpa ID → `null`;
  - `shuffledDifferent` deterministik, berbeda dari aslinya, berisi baris yang sama, dan melempar error untuk `["a","a","a","a","a"]`;
  - `uniqueData` dengan `now` berbeda menghasilkan `canonical_hash` berbeda. Gunakan `spike/lib.mjs`.
- [ ] **Step 2:** Jalankan `node --test scripts/lib/`. Harus FAIL. Implementasikan, lalu PASS.
- [ ] **Step 3:** Tulis `e2e.mjs`. Jalankan **dua kali berturut-turut** pada `v1`. Kedua run harus exit 0, dan run kedua melewati faucet (Review Focus 3).
- [ ] **Step 4:** Lengkapi `docs/TESTNET.md`:
  - tabel langkah e2e dengan hash transaksi untuk kedua run;
  - minimal satu sidak `Survived`, dan kalau sempat terjadi, satu `Caught`;
  - perilaku `payer_account_id` saat kontrak yang memanggil.

  Commit `test(scripts): testnet e2e; docs: TESTNET`.
- [ ] **Step 5:** Lakukan review menyeluruh oleh reviewer baru, dengan fokus perubahan kontrak di Task 1, skrip deploy/e2e, dan model simulasi. Perbaiki temuan Critical dan Important dengan TDD. Kalau ada perbaikan kontrak, deploy ulang ke `v2` dan jalankan e2e ulang.
- [ ] **Step 6: CHECKPOINT 4. Berhenti.** Tampilkan tabel parameter final (D-15), grafik `docs/sim/`, hasil e2e, dan angka farming. Parameter baru dianggap terkunci setelah manusia menyetujuinya.
