# Section 5 — Web (Mr. X) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Web statis gaya ohzi dengan kartu Mr. X 3D. Juri bisa membaca semua data `v2.spade-taksir.testnet` tanpa wallet, lalu menjalankan faucet → taksir → sidak dengan wallet testnet.

**Architecture:**
- `web/` adalah SPA Vite + React + TypeScript dengan `HashRouter` dan base `/Spade/`, di-host di GitHub Pages.
- Data dibaca lewat JSON-RPC `fetch` (`src/chain`). Transaksi ditulis lewat `@hot-labs/near-connect` (`src/wallet`).
- Satu adegan three.js (`src/scene/Stage`) menetap di belakang semua halaman dan menerima perintah dari React lewat `useStage()`.

**Tech Stack** (versi npm yang dicek 2026-11-11):
- `react`/`react-dom` 19.3.1, `react-router-dom` 7.18.5;
- `vite` 8.3.8, `@vitejs/plugin-react` 6.3.0, `typescript` 7.0.2;
- `three` 0.187.0 + `@types/three`;
- `@hot-labs/near-connect` 0.12.0 (tanpa dependensi);
- `vitest` 5.1.0, `@testing-library/react` 16.3.3, `@testing-library/jest-dom` 7.0.1, `jsdom` 31.0.0.

**Spec:** `docs/superpowers/specs/2026-11-11-section-5-web-design.md` (+ `DESIGN_OHZI.md`, `README.md` Section 5).

## Global Constraints

- **Kontrak:**
  - `CONTRACT_ID = "v2.spade-taksir.testnet"`;
  - RPC `https://rpc.testnet.near.org`;
  - explorer `https://testnet.nearblocks.io`;
  - network `"testnet"`;
  - tidak ada mainnet.
- **Enclave:**
  - `WASM_HASH = "0206187e1ba0c53acb5c5e991b1d559c20eafb01d617a387be5a0848c7348ee2"`;
  - `RELEASE_WASM_URL = "https://github.com/Axlnd3r/Spade/releases/download/enclave-v1/appraiser.wasm"`.
- **Kode kontrak v2:** `code_hash` bs58 `CMd9x3xLmM3dm9HDsxhZMz1Z4Etzcs3RgasvMnarWV4J` (sha256 `a8b90d5a…0127`, `docs/TESTNET.md`).
- **Gaya (`DESIGN_OHZI.md`):**
  - font hanya Unbounded (Google Fonts, bobot 100/300/400/500/600/700);
  - warna UI hanya `#000000`, `#111111`, `#cfcfcf`, `#f5f5f7`, `#ffffff`;
  - garis 1px, `border-radius: 0` di semua elemen UI;
  - tombol ghost: transparan, border 1px putih, uppercase, letter-spacing ≥ 0,067em;
  - tanpa shadow, glow, atau blur pada UI;
  - warna dan cahaya hanya dari canvas 3D.
- **Teks:**
  - antarmuka berbahasa Inggris;
  - nama fitur TAKSIR dan SIDAK, tokoh Mr. X, slogan "Rug the AI, not the holders.";
  - label status dan pesan error persis seperti tabel spec bagian 3 dan 7.
- **Gas dan deposit:**
  - semua `FunctionCall` memakai gas `"300000000000000"`;
  - deposit `appraise`/`challenge` = `exec_deposit + storage_fee` dari `get_params` (yocto, string);
  - deposit `faucet` = `"10000000000000000000000"` (0,01 NEAR).
- **Polling:** setiap 3000 ms, batas pesan "still thinking" 90000 ms. Stats di-refresh tiap 10000 ms.
- **Aset:** tidak memakai aset ohzi, Sketchfab, atau foto stok. Gambar kartu berasal dari SVG orisinal di artifact Spade UI (`Card.dc.html`).
- **Lingkungan dan git:**
  - semua perintah web dijalankan di Git Bash di Windows (`cd web && npm …`);
  - jangan commit `.env`, secret, atau `web/dist`;
  - push hanya dengan izin manusia.

## Review Focus

1. **RPC testnet lambat atau gagal.** Halaman harus menampilkan "Can't reach NEAR testnet. Retrying…" dan tetap bisa dinavigasi, tidak kosong atau crash. Diuji di Task 6 (`home_shows_retry_when_rpc_fails`).
2. **Wallet ditutup atau transaksi ditolak di tengah jalan.** UI kembali siap dengan pesan "Cancelled in wallet.", kartu tidak tertahan di status THINKING. Diuji di Task 3 (`txErrorMessage_maps_user_rejection`) dan Task 7 (`taksir_returns_to_idle_on_cancel`).
3. **Data dengan CRLF, spasi di ujung, atau baris kosong** dihitung dan divalidasi persis seperti kontrak, termasuk ukuran yang diukur dari teks mentah. Diuji di Task 2 dengan `vectors.json` bersama.
4. **`/case/999` atau `/case/abc`** menampilkan "Case not found." dan link kembali, bukan halaman putih. Diuji di Task 8 (`case_not_found`).
5. **Enclave gagal atau menjawab setelah 90 detik.** Halaman menampilkan NO ANSWER (stake/fee dikembalikan), atau "still thinking" lalu memperbarui diri saat jawaban datang. Diuji di Task 3 (`awaitResult_keeps_polling_after_soft_timeout`) dan Task 8.

---

### Task 1: Scaffold `web/`, gaya dasar, workflow Pages

**Files:**
- Create: `web/package.json`, `web/vite.config.ts`, `web/tsconfig.json`, `web/index.html`, `web/src/main.tsx`, `web/src/App.tsx`, `web/src/styles.css`, `web/src/test/setup.ts`, `web/src/App.test.tsx`, `web/.gitignore` (`node_modules`, `dist`), `.github/workflows/pages.yml`
- Commit juga: `DESIGN_OHZI.md` (referensi gaya yang dipakai spec)

**Interfaces:**
- Produces:
  - `npm test` (vitest, jsdom, setup `@testing-library/jest-dom`);
  - `npm run build` → `web/dist`;
  - `vite.config.ts` `base: "/Spade/"`;
  - token CSS di `:root` (`--void #000`, `--carbon #111`, `--ash #cfcfcf`, `--fog #f5f5f7`, `--white #fff`) dan kelas utilitas `.ghost` (tombol ghost) dan `.caption` (14px, letter-spacing 0.188em).

- [ ] **Step 1:** Buat `package.json` dengan versi persis dari Tech Stack dan script `dev`, `build` (`tsc -b && vite build`), `preview`, `test` (`vitest run`). Jalankan `npm install`.
- [ ] **Step 2: Test gagal** di `App.test.tsx`: `renders_lockup` → `render(<App/>)` lalu `expect(screen.getByText(/SPADE/)).toBeInTheDocument()`.
- [ ] **Step 3:** `npm test`. Expected: FAIL (App belum ada).
- [ ] **Step 4:** Buat `App.tsx` minimal (lockup "♠ SPADE · $TAKSIR") dan `styles.css` (body hitam, Unbounded, radius 0). `index.html` memuat Unbounded dari Google Fonts.
- [ ] **Step 5:** `npm test` → PASS. `npm run build` → sukses, `dist/index.html` mereferensikan `/Spade/assets/`.
- [ ] **Step 6:** `pages.yml`:
  - trigger push ke `main` dengan path `web/**` dan `workflow_dispatch`;
  - langkah: Node 24, `npm ci` dan `npm run build` di `web/`, `actions/upload-pages-artifact` dari `web/dist`, lalu `actions/deploy-pages`;
  - permissions `pages: write`, `id-token: write`.
- [ ] **Step 7:** Commit `feat(web): scaffold Vite React app, ohzi base styles, Pages workflow`.

Kalau TypeScript 7 menolak config plugin Vite, turunkan ke rilis 5.x terakhir dan catat sebagai Ruling.

### Task 2: `src/chain`: config, tipe, RPC, data, format, shuffle

**Files:**
- Create: `web/src/chain/config.ts`, `types.ts`, `rpc.ts`, `data.ts`, `format.ts`, `shuffle.ts`
- Test: `web/src/chain/data.test.ts`, `format.test.ts`, `shuffle.test.ts`, `rpc.test.ts`

**Interfaces:**
- Produces:
  - `config.ts`: konstanta dari Global Constraints.
  - `types.ts`: `Params`, `Stats`, `Appraisal`, `Challenge`, `LogEntry`. Nama field persis seperti view kontrak (snake_case). `U128` dan `NearToken` sebagai `string`.
    - `AppraisalStatus = "Pending"|"Priced"|"Caught"|"Failed"`;
    - `ChallengeStatus = "Pending"|"Caught"|"Survived"|"Failed"|"Voided"`;
    - `LogKind = "Mint"|"BurnFee"|"BurnStake"|"BurnEpoch"|"Reward"|"Faucet"`.
  - `rpc.ts`:
    - `view<T>(method: string, args?: object): Promise<T>`;
    - `viewAccount(id: string): Promise<{ amount: string; code_hash: string; storage_usage: number }>`;
    - `accessKeyCount(id: string): Promise<number>`;
    - semua dengan `finality: "optimistic"` dan melempar `RpcError` kalau gagal.
  - `data.ts`:
    - `normalizeLines(text: string): string[]`;
    - `validateData(text: string, lines: string[], p: Pick<Params,"min_rows"|"max_rows"|"max_data_bytes">): null | "too_large"|"too_few_rows"|"too_many_rows"`;
    - `sameLines(a: string[], b: string[]): boolean`, yaitu multiset sama dengan urutan byte UTF-8.
  - `format.ts`:
    - `taksir(yocto: string, digits?: number): string` (18 desimal, pemisah ribuan `,`);
    - `near(yocto: string): string`;
    - `diffPct(p1: number, p2: number): number` (`|p1−p2| / max(p1,p2) × 100`);
    - `isBusted(p1, p2, thresholdBps)` sama dengan kontrak `(max−min)×10000 > bps×max`;
    - `appraisalLabel(s)` dan `challengeLabel(s)` (tabel spec bagian 3);
    - `contractErrorMessage(text: string): string | null` (tabel spec bagian 7; mencari kode di dalam teks error);
    - `logKindLabel(k)`.
  - `shuffle.ts`: `shuffledDifferent(lines: string[], seed: number): string[]`, `reversed(lines: string[]): string[]`. Keduanya melempar error kalau semua baris sama.

- [ ] **Step 1: Test gagal:**
  - `data.test.ts`, `matches_shared_vectors`: memuat `../../../enclave/appraiser/vectors/vectors.json`. Untuk setiap kasus, `normalizeLines(input)` sama dengan `lines`. Kalau `valid`, `validateData` mengembalikan `null` dengan batas 5/100/2000; kalau tidak, mengembalikan `error_code` kasus itu.
  - `data.test.ts`, `sameLines_byte_order`: `sameLines(["b","a"],["a","b"]) === true`; `sameLines(["a"],["a","a"]) === false`.
  - `format.test.ts`:
    - `taksir("50000000000000000000") === "50"`;
    - `taksir("99999750000000000000000000") === "99,999,750"`;
    - `diffPct(10000,1) ≈ 99.99`;
    - `isBusted(100,401,7500) === true`;
    - `isBusted(100,400,7500) === false`;
    - `challengeLabel("Caught") === "BUSTED"`;
    - `challengeLabel("Survived") === "HELD"`;
    - `contractErrorMessage("Smart contract panicked: already_appraised")` berisi `"already priced"`;
    - `contractErrorMessage("…The account bob.testnet is not registered")` berisi `"claim the faucet"`.
  - `shuffle.test.ts`: deterministik, berbeda dari input, berisi baris yang sama, dan melempar error untuk `["a","a","a","a","a"]`. `reversed(["a","b","a"])` melempar error karena urutannya sama setelah dibalik.
  - `rpc.test.ts`: dengan `fetch` palsu, `view("get_stats")` mengirim `request_type: "call_function"` dengan `args_base64` dan mendekode `result` (array byte → JSON). Kalau ada `error` dari RPC, melempar `RpcError`.
- [ ] **Step 2:** `npm test`. Expected: FAIL (modul belum ada).
- [ ] **Step 3:** Implementasikan sesuai Interfaces. Untuk urutan byte UTF-8, bandingkan `TextEncoder().encode` per elemen.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(web): chain layer (rpc, data rules shared with contract, formatting)`.

### Task 3: Wallet dan hook data

**Files:**
- Create: `web/src/wallet/WalletProvider.tsx`, `web/src/wallet/tx.ts`, `web/src/hooks/useView.ts`, `web/src/hooks/awaitResult.ts`
- Test: `web/src/wallet/tx.test.ts`, `web/src/hooks/awaitResult.test.ts`

**Interfaces:**
- Consumes: Task 2 (`view`, `contractErrorMessage`, tipe).
- Produces:
  - `<WalletProvider>` dan `useWallet(): { accountId: string|null; signIn(): Promise<void>; signOut(): Promise<void>; call(method: string, args: object, depositYocto: string): Promise<{ txHash: string }> }`.
    - Isinya `new NearConnector({ network: "testnet" })`, `connect()`, `getConnectedWallet()` saat mount, event `wallet:signIn`/`wallet:signOut`, dan `wallet.signAndSendTransaction({ receiverId: CONTRACT_ID, actions: [{ type: "FunctionCall", params: { methodName, args, gas: "300000000000000", deposit } }] })`.
    - `txHash` diambil dari `outcome.transaction.hash`.
  - `tx.ts`: `txErrorMessage(err: unknown): string`. Menggabungkan `contractErrorMessage` dengan deteksi penolakan wallet (pesan mengandung `reject`, `cancel`, `closed`, atau `denied`, tanpa membedakan huruf besar-kecil) → `"Cancelled in wallet."`. Fallback: `"Transaction failed: <pesan asli 140 char>"`.
  - `useView<T>(method, args, refreshMs?) => { data: T|undefined; error: Error|undefined; loading: boolean }`, dengan refresh berkala.
  - `awaitResult<T>(read: () => Promise<T|undefined>, done: (v: T) => boolean, opts: { intervalMs: number; softTimeoutMs: number; onSoftTimeout(): void; signal: AbortSignal }): Promise<T>`. Polling tetap berjalan setelah soft timeout sampai `done` atau `signal` dibatalkan.
  - `findNewAppraisal(countBefore: number, owner: string, data: string): Promise<Appraisal|undefined>` (di `awaitResult.ts`): coba id `countBefore`, lalu 10 terakhir milik `owner` dengan `data` yang sama (data dinormalisasi lalu digabung dengan `\n`).

- [ ] **Step 1: Test gagal:**
  - `txErrorMessage_maps_user_rejection`: `new Error("User rejected the request")` → `"Cancelled in wallet."`.
  - `txErrorMessage_maps_contract_code`: error yang berisi `"deposit_low"` → `"Not enough NEAR attached."`.
  - `awaitResult_resolves_when_done`: pakai fake timers. `read` mengembalikan Pending, Pending, lalu Priced, dan hasilnya adalah nilai Priced.
  - `awaitResult_keeps_polling_after_soft_timeout`: `onSoftTimeout` dipanggil tepat sekali pada 90 detik, lalu Priced di 120 detik tetap diterima.
  - `findNewAppraisal_falls_back_to_owner_and_data`: id `countBefore` milik akun lain, sedangkan id `countBefore+1` cocok → mengembalikan id `countBefore+1`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementasikan. `WalletProvider` tidak diuji unit (butuh wallet nyata); ia diuji manual di Task 10.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(web): near-connect wallet provider, tx errors, result polling`.

### Task 4: Kerangka UI, menu ohzi, routing

**Files:**
- Create: `web/src/ui/Header.tsx`, `Menu.tsx`, `GhostButton.tsx`, `Stat.tsx`, `StatusTag.tsx`, `Glossary.tsx`, `Footer.tsx`, `web/src/pages/{Home,Taksir,Cases,Case,Ledger,Verify}.tsx` (placeholder `<h1>`)
- Modify: `web/src/App.tsx` (`HashRouter`, routes `/`, `/taksir`, `/cases`, `/case/:id`, `/ledger`, `/verify`, `*` → Home)
- Test: `web/src/ui/Menu.test.tsx`

**Interfaces:**
- Produces:
  - `MENU_ITEMS = [{n:"01",label:"HOME",to:"/"},{n:"02",label:"TAKSIR",to:"/taksir"},{n:"03",label:"CASES",to:"/cases"},{n:"04",label:"LEDGER",to:"/ledger"},{n:"05",label:"VERIFY",to:"/verify"}]`;
  - `<Menu open onClose/>`: overlay hitam, daftar besar Unbounded 700. Item aktif putih dengan garis 1px di kiri, yang lain `#cfcfcf` dengan opacity 0.45, dan caption "0N / 05 — <subjudul>";
  - `<GhostButton>` adalah `<button>` atau `<Link>` dengan kelas `.ghost`;
  - `<StatusTag kind="appraisal"|"challenge" status/>` memakai label dari Task 2;
  - `<Glossary/>` berisi dua kalimat glosarium persis dari spec bagian 3.

- [ ] **Step 1: Test gagal** `menu_lists_five_items_and_marks_active`: render di `MemoryRouter initialEntries={["/ledger"]}` dengan `open`. Expected:
  - ada 5 link dengan teks persis dari `MENU_ITEMS`;
  - link "LEDGER" memiliki `aria-current="page"`;
  - Escape memanggil `onClose`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementasikan. Hamburger adalah `<button aria-label="Open menu">` dengan tinggi area sentuh ≥ 44px. Menu bisa dioperasikan dengan keyboard; fokus pindah ke item pertama saat dibuka.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(web): ohzi-style shell, menu and routes`.

### Task 5: Adegan 3D, kartu Mr. X

**Files:**
- Create:
  - `web/src/scene/cardArt.ts` (string SVG depan dan belakang, disalin dari `Card.dc.html`);
  - `web/src/scene/Stage.ts`, `card.ts`, `floor.ts`, `embers.ts`, `warp.ts`;
  - `web/src/scene/SceneCanvas.tsx` (`StageContext`, `useStage()`);
  - `web/src/scene/webgl.ts`
- Test: `web/src/scene/SceneCanvas.test.tsx`, `web/src/scene/cardArt.test.ts`

**Interfaces:**
- Consumes: none.
- Produces:
  - `type StagePage = "home"|"inner"`;
  - `type StageEvent = "thinking"|"idle"|"held"|"busted"|"burn"`;
  - `class Stage { mount(canvas: HTMLCanvasElement): void; setPage(p: StagePage): void; trigger(e: StageEvent): void; dispose(): void }`;
  - `useStage(): { setPage, trigger }`, yang tidak melakukan apa-apa kalau tidak ada WebGL;
  - `hasWebGL(): boolean`.
- **Nilai pasti:**
  - kartu `RoundedBoxGeometry(2.5, 3.5, 0.04, 4, 0.12)`;
  - tekstur `CanvasTexture` 1024×1434 dari SVG via `Image` + `drawImage`;
  - putaran 2π per 20 detik;
  - bob ±0,08 dengan periode 4 detik;
  - rim light `#6a5cff` saat idle, `#ff6a1a` saat busted (1,5 detik, lalu kembali);
  - bloom `UnrealBloomPass(strength 0.6, radius 0.4, threshold 0.85)`;
  - `Reflector` dengan `clipBias 0.003` dan warna `#222`, ditambah fog `#000` dari 6 sampai 14;
  - `setPixelRatio(min(devicePixelRatio, 1.5))`;
  - posisi kartu: `home` x = +1.6, skala 1; `inner` x = +2.6, skala 0.75, emissive diredupkan 40%;
  - render berhenti saat `document.hidden`;
  - `prefers-reduced-motion` mematikan putaran otomatis, bob, dan warp.
- **Event:**
  - `thinking`: kecepatan putaran ×4 dan rim berdenyut;
  - `held`: kilat biru 0,6 detik;
  - `busted`: shader dissolve depan dengan tepi oranye 1,2 detik, lalu tersusun kembali;
  - `burn`: 40 partikel bara naik 2 detik.
- **Warp** saat route berubah: 300 garis selama 600 ms.

- [ ] **Step 1: Test gagal:**
  - `cardArt.test.ts`: `FRONT_SVG` berisi `"M"`, `"R"`, dan `"X"` sebagai teks indeks serta path ♠, dan `BACK_SVG` berisi `"SPADE"`. Keduanya bisa di-parse `DOMParser` tanpa `parsererror`.
  - `SceneCanvas.test.tsx`, `falls_back_to_static_card_without_webgl`: dengan `hasWebGL` di-mock `false`, yang dirender adalah `<img alt="Mr. X card">` dan bukan `<canvas>`. Canvas maupun gambar memakai `aria-hidden` atau alt yang sesuai.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementasikan sesuai nilai di atas. Hanya memakai `three` dan `three/addons` (RoundedBoxGeometry, Reflector, EffectComposer, RenderPass, UnrealBloomPass, OutputPass).
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Cek visual.** Jalankan `npm run dev`, buka di Chrome (chrome-devtools MCP), lalu screenshot Home pada 1440×900 dan 390×844. Expected: kartu terlihat, depan dan belakang bergantian, pantulan di lantai, teks tidak tertutup. Ukur fps dengan `performance` selama 5 detik; target ≥ 50. Kalau di bawah target, ganti `Reflector` dengan pantulan palsu (mesh kartu cermin + gradien) dan catat sebagai Ruling.
- [ ] **Step 6:** Commit `feat(web): Mr. X card stage (three.js), wet floor, bloom, events`.

### Task 6: Home dan Cases (baca-saja)

**Files:**
- Modify: `web/src/pages/Home.tsx`, `web/src/pages/Cases.tsx`
- Create: `web/src/pages/epoch.ts`
- Test: `web/src/pages/Home.test.tsx`, `web/src/pages/epoch.test.ts`

**Interfaces:**
- Consumes: `useView`, `format`, `StatusTag`, `GhostButton`, `useStage`.
- Produces:
  - `nextEpochMs(genesisMs: number, epochMs: number, nowMs: number): number`. `genesisMs` diambil dari `get_log({from:0,limit:1})[0].ts_ms` (entri Mint saat `new`).
  - `windowLeftMs(pricedMs: number, windowMs: number, nowMs: number): number`, minimal 0.

- [ ] **Step 1: Test gagal:**
  - `epoch.test.ts`: `nextEpochMs(1000, 600000, 1000+600000*3+5) === 1000+600000*4`; `windowLeftMs(0, 3600000, 3600001) === 0`.
  - `Home.test.tsx`, `home_renders_live_stats`: dengan `view` palsu (stats v2 nyata: `total_supply "99999750000000000000000000"`, `burned_total "250000000000000000000"`), halaman menampilkan `"99,999,750"`, `"250"`, dan `"0"` untuk "MINTED SINCE LAUNCH", serta heading "RUG THE AI, NOT THE HOLDERS.".
  - `Home.test.tsx`, `home_shows_retry_when_rpc_fails` (Review Focus 1): `view` menolak → teks "Can't reach NEAR testnet. Retrying…" dan heading hero tetap ada.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementasikan Home sesuai spec bagian 6:
  - hero kiri, kartu di kanan dari canvas;
  - stat: supply, burned, treasury, minted 0, hitung mundur epoch, budget tersisa, `clean_streak` ("EPOCHS SINCE MR. X GOT BUSTED"), `best_streak`;
  - tiga langkah dengan teks spec bagian 3;
  - 5 kasus terbaru;
  - pemicu `useStage().trigger("burn")` saat `burned_total` naik dibanding nilai sebelumnya.

  Cases: `get_appraisals` dari `count−20`, ditampilkan dari yang terbaru, dengan tombol "Older" dan "Newer". Tiap baris berisi harga, StatusTag, jumlah sidak, dan sisa jendela sidak.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(web): Home and Cases from live contract views`.

### Task 7: TAKSIR (faucet, taksir, kartu hasil)

**Files:**
- Modify: `web/src/pages/Taksir.tsx`
- Create: `web/src/ui/ResultCard.tsx`, `web/src/ui/share.ts`
- Test: `web/src/pages/Taksir.test.tsx`, `web/src/ui/share.test.ts`

**Interfaces:**
- Consumes: `useWallet`, `findNewAppraisal`, `awaitResult`, `validateData`, `useStage`.
- Produces: `shareUrl(text: string, url: string): string`, yaitu `https://x.com/intent/post?text=…&url=…` yang di-encode dengan `encodeURIComponent`.

- [ ] **Step 1: Test gagal:**
  - `share.test.ts`: `shareUrl("BUSTED! #NEARHackathon", "https://x/y")` diawali `https://x.com/intent/post?text=BUSTED!%20%23NEARHackathon&url=`.
  - `Taksir.test.tsx`, `submit_disabled_until_valid`: dengan data contoh (6 baris) tombol "APPRAISE (50 $TAKSIR)" aktif. Setelah teks diganti 3 baris, tombol nonaktif dan muncul pesan "Needs at least 5 lines.".
  - `Taksir.test.tsx`, `taksir_returns_to_idle_on_cancel` (Review Focus 2): `call` palsu melempar `Error("User closed the window")` → teks "Cancelled in wallet.", tombol aktif kembali, dan `trigger` dipanggil dengan `"idle"` setelah `"thinking"`.
  - `Taksir.test.tsx`, `shows_connect_without_wallet`: dengan `accountId` null, tombol berbunyi "CONNECT WALLET".
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementasikan:
  - Faucet tampil hanya jika `ft_balance_of(accountId) === "0"`.
  - Data contoh (6 baris kopi). Baris biaya dibaca dari `get_params`.
  - Urutan kirim: baca `appraisal_count`, `call("appraise",{data},deposit)`, `trigger("thinking")`, `findNewAppraisal`, lalu `awaitResult` sampai bukan Pending.
  - Hasil `Priced` → `ResultCard` (harga, alasan, link `/case/:id`, Share on X) dan `trigger("idle")`. Hasil `Failed` → "Mr. X didn't answer. Your fee was refunded.".
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(web): TAKSIR page with faucet, appraisal and result card`.

### Task 8: Case dan panel SIDAK

**Files:**
- Modify: `web/src/pages/Case.tsx`
- Create: `web/src/ui/SidakPanel.tsx`, `web/src/ui/BustCard.tsx`
- Test: `web/src/pages/Case.test.tsx`

**Interfaces:**
- Consumes: `shuffledDifferent`, `reversed`, `sameLines`, `diffPct`, `isBusted`, `challengeLabel`, `useWallet`, `awaitResult`, `shareUrl`, `useStage`.

- [ ] **Step 1: Test gagal:**
  - `case_not_found` (Review Focus 4): route `/case/999` dengan `get_appraisal` → `null`, dan `/case/abc` → keduanya menampilkan "Case not found." dan link "BACK TO CASES".
  - `case_shows_bust`: memakai data kasus #3 v2 (p1 10000, sidak Caught p2 1, reward `"50000000000000000000"`). Yang tampil: "BUSTED", "10,000", "1", "99.99%", "+50 $TAKSIR".
  - `sidak_shuffle_changes_order_keeps_lines`: klik "SHUFFLE" → pratinjau urutannya berbeda dari data, dan `sameLines` bernilai true.
  - `sidak_hidden_when_window_closed`: `priced_ms` + window < sekarang → panel menampilkan "The 1-hour SIDAK window has closed." tanpa tombol kirim.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementasikan sesuai spec bagian 6:
  - baris data, p1, alasan, dan bukti (model, `signing_address`, `response_hash`);
  - daftar sidak: p1, p2, selisih, label;
  - panel SIDAK: SHUFFLE, REVERSE, pratinjau, baris biaya, kirim → `awaitResult` pada `get_challenges` (sidak terbaru dengan `challenger === accountId`);
  - hasil Caught → `trigger("busted")` dan `BustCard` (teks "BUSTED!", harga sebelum dan sesudah, hadiah, Share on X dengan teks "I called Mr. X's bluff on Spade: {p1} → {p2}. #NEARHackathon @NEARProtocol");
  - hasil Survived → `trigger("held")` dan "HELD. Your 25 $TAKSIR stake was burned.".
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(web): Case page with SIDAK panel and BUSTED card`.

### Task 9: Ledger dan Verify

**Files:**
- Modify: `web/src/pages/Ledger.tsx`, `web/src/pages/Verify.tsx`
- Test: `web/src/pages/Ledger.test.tsx`, `web/src/pages/Verify.test.tsx`

**Interfaces:**
- Consumes: `view`, `viewAccount`, `accessKeyCount`, `logKindLabel`, `taksir`, config.

- [ ] **Step 1: Test gagal:**
  - `ledger_newest_first`: `log_count` 11 → memanggil `get_log({from:0,limit:11})`. Baris pertama adalah entri terakhir (Reward "+50"), dan baris BurnEpoch berlabel "Epoch budget burned".
  - `verify_compares_code_hash`:
    - kalau `viewAccount` mengembalikan `code_hash` sama dengan `CMd9x3xLmM3dm9HDsxhZMz1Z4Etzcs3RgasvMnarWV4J` → teks "MATCHES docs/TESTNET.md";
    - kalau berbeda → "DOES NOT MATCH";
    - `accessKeyCount` 1 → "1 access key. Becomes 0 after the final lock.";
    - `WASM_HASH` ditampilkan lengkap.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementasikan:
  - **Ledger:**
    - 50 baris per halaman, terbaru dulu;
    - kolom waktu UTC, jenis, jumlah dengan tanda `−` untuk burn dan `+` untuk reward/faucet, ref yang menaut ke `/case/:id` (BurnFee/BurnStake/Reward), dan akun;
    - catatan "Each entry is written by the contract; the contract keeps no tx hash per entry. Contract on explorer ↗".
  - **Verify:**
    - access key, `code_hash`, tabel lengkap `get_params`;
    - hash WASM, link rilis, dan perintah `curl -sL <url> | sha256sum`;
    - bukti NEAR AI dari kasus terbaru (`model`, `chat_id`, `signing_address`, `signature`, `response_hash`).
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(web): Ledger and Verify pages`.

### Task 10: Deploy Pages, uji browser → CHECKPOINT 5

**Files:**
- Modify: `docs/TESTNET.md` (bagian Web), `docs/WORKLOG.md`

- [ ] **Step 1:** `npm test` dan `npm run build` → semua PASS. Lalu `npm run preview` dan screenshot keenam halaman pada 1440×900 dan 390×844 lewat chrome-devtools MCP. Expected:
  - tanpa error di console;
  - teks terbaca di atas kartu;
  - tidak ada scroll horizontal di 390px.
- [ ] **Step 2: 👤 Minta izin push.** Merge branch `s5-web` ke `main`, lalu minta manusia mengaktifkan Pages (Settings → Pages → Source: GitHub Actions). Jalankan workflow, lalu buka `https://axlnd3r.github.io/Spade/`. Expected: Home menampilkan stats v2 nyata.
- [ ] **Step 3: 👤** Manusia menjalankan alur dengan wallet testnet di URL demo: Connect → faucet → TAKSIR → SIDAK (Reverse pada data jebakan). Catat hash tx dari layar.
- [ ] **Step 4:** Lengkapi `docs/TESTNET.md`:
  - URL demo;
  - hash tx dari alur browser;
  - wallet yang dipakai;
  - versi `@hot-labs/near-connect`.

  Commit `docs: web demo on GitHub Pages`.
- [ ] **Step 5:** Review menyeluruh oleh reviewer baru (opus) terhadap `web/`, dengan Review Focus di atas. Temuan Critical dan Important diperbaiki dengan TDD.
- [ ] **Step 6: CHECKPOINT 5.** Kirim URL demo dan screenshot tiap halaman. Berhenti.
