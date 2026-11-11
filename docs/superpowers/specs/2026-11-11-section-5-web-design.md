# Section 5 — Web: desain

Tanggal: 2026-11-11. Sumber keputusan: percakapan dengan manusia (brainstorming S5). Blueprint: `README.md` Section 5, aturan T-5. Gaya: `DESIGN_OHZI.md`.

## 1. Tujuan dan ukuran berhasil

Juri internasional bisa memahami Spade dalam sekali lihat, lalu menjalankan alur penuh dari browser di testnet.

**Selesai jika:**
- alur faucet → taksir → sidak berhasil dari browser dengan wallet testnet;
- halaman Ledger dan Verify menampilkan data nyata dari `v2.spade-taksir.testnet`;
- semua halaman bisa dibaca tanpa wallet;
- situs di-host statis di GitHub Pages.

## 2. Keputusan yang sudah disetujui manusia

| Topik | Keputusan |
|---|---|
| Gaya | Mengikuti `DESIGN_OHZI.md`. Ruang gelap dengan satu objek 3D bercahaya dan lantai basah yang memantulkannya. Font hanya Unbounded. Antarmuka tanpa warna (`#000`, `#111`, `#cfcfcf`, `#f5f5f7`, `#fff`), garis 1px, sudut 0px, tombol *ghost*. Warna hanya datang dari adegan 3D |
| Objek 3D | **Kartu Mr. X** menggantikan kubus ohzi. Kartu remi dua sisi yang melayang dan berputar pelan. Depan: Mr. X, joker gaya kartu remi klasik (harlequin biru-merah-kuning, topeng hitam, X merah di dada, tongkat berujung ♠, indeks sudut "M R · X"). Belakang: ♠ putih di atas hitam, bertuliskan "SPADE" dan "$TAKSIR · NEAR". Gambarnya vektor orisinal dari draf di artifact Spade UI (`Card.dc.html`). Tidak memakai aset ohzi, Sketchfab, atau foto stok |
| Lingkup 3D | **Opsi A:** satu adegan three.js yang menetap di belakang semua halaman. Tidak ada dunia 3D terpisah per halaman |
| Tokoh | **Mr. X**, menggantikan "Pak Taksir": AI penaksir yang tersegel di TEE |
| Bahasa | Semua teks antarmuka dalam bahasa Inggris. TAKSIR dan SIDAK tetap dipakai sebagai nama fitur, dengan glosarium satu baris |
| Narasi | Slogan **"Rug the AI, not the holders."** Aksi SIDAK disebut **"Call his bluff"**. Hasil `Caught` disebut **BUSTED** |

## 3. Teks inti (bahasa Inggris)

- **Hero:** "MEET MR. X" / "RUG THE AI, NOT THE HOLDERS." / "Mr. X is an AI sealed inside a TEE. He prices your data. Shuffle the lines and ask again: if his price jumps, you caught him bluffing, and the treasury pays you."
- **Glosarium** (footer dan halaman How it works):
  - "TAKSIR: Indonesian for *to appraise*."
  - "SIDAK: Indonesian for *surprise inspection*."
- **Tiga langkah:**
  1. "TAKSIR: Mr. X prices your list. 50 $TAKSIR fee, burned."
  2. "SIDAK: same lines, new order. Stake 25 $TAKSIR."
  3. "Price moves more than 75%? BUSTED: stake back + 50 $TAKSIR from the treasury. Holds steady? Your stake burns."
- **Nama status** (UI ↔ kontrak):

| UI | Kontrak |
|---|---|
| THINKING | `Pending` |
| PRICED | `Priced` |
| BUSTED | `Caught` (taksiran maupun sidak) |
| HELD | `Survived` |
| NO ANSWER, STAKE REFUNDED | `Failed` |
| ALREADY BUSTED, STAKE REFUNDED | `Voided` |

## 4. Arsitektur

`web/`: Vite + React + TypeScript, statis. Di-host di GitHub Pages dengan base `/Spade/` dan `HashRouter`, karena Pages tidak punya fallback SPA. Tanpa backend.

| Unit | Isi | Bergantung pada |
|---|---|---|
| `src/chain/config.ts` | `CONTRACT_ID = v2.spade-taksir.testnet`, RPC `https://rpc.testnet.near.org`, explorer `https://testnet.nearblocks.io`, `RELEASE_WASM_URL`, `WASM_HASH` | — |
| `src/chain/rpc.ts` | `view(method, args)`, `viewAccount(id)` (`code_hash`), `accessKeys(id)` (`view_access_key_list`). Fetch JSON-RPC, port dari `scripts/lib/near.mjs` | config |
| `src/chain/types.ts` | Tipe TS yang mencerminkan view kontrak: `Params`, `Stats`, `Appraisal`, `Challenge`, `LogEntry` | — |
| `src/chain/data.ts` | `normalizeLines`, `validateData`, `canonicalKey`, sama dengan `contracts/taksir/src/data.rs` (trim hanya spasi, tab, CR; 5–100 baris; ≤ `max_data_bytes`) | — |
| `src/chain/format.ts` | yocto → TAKSIR, `diffPct(p1, p2)`, label status (tabel di atas), pesan error kontrak (bagian 7) | types |
| `src/chain/shuffle.ts` | `shuffledDifferent`, `reversed`: urutan pasti berbeda (port dari `scripts/lib/near.mjs`) | — |
| `src/wallet/WalletProvider.tsx` | Context React di atas `@hot-labs/near-connect` (rekomendasi resmi NEAR; Wallet Selector sudah deprecated). Menyediakan `accountId`, `signIn`, `signOut`, dan `call(method, args, depositYocto, gas)` dengan action `FunctionCall`. Network testnet | config |
| `src/hooks/` | `useView` (polling; stats tiap 10 detik), `useAwaitResult` (polling `get_appraisal` / `get_challenges` setiap 3 detik, paling lama 90 detik) | rpc |
| `src/scene/` | `Stage` (kelas three.js imperatif: `mount(canvas)`, `setPage(page)`, `trigger(event)`, `dispose()`), `card.ts`, `floor.ts`, `embers.ts`, `warp.ts`, dan `SceneCanvas.tsx` sebagai jembatan React (`useStage()`) | three |
| `src/ui/` | `Header` (lockup ♠ SPADE + hamburger), `Menu` (overlay daftar besar gaya ohzi: "01 HOME / 02 TAKSIR / 03 CASES / 04 LEDGER / 05 VERIFY", item aktif putih, yang lain abu-abu), `GhostButton`, `Stat`, `StatusTag`, `BustCard`, `Glossary` | — |
| `src/pages/` | `Home`, `Taksir`, `Case` (`/case/:id`), `Cases`, `Ledger`, `Verify` | semua di atas |

## 5. Adegan 3D (opsi A)

- **Kartu:** `RoundedBox` tipis (rasio 2,5:3,5). Tekstur depan dan belakang berasal dari SVG kartu yang dirender ke `CanvasTexture`. Kartu melayang naik-turun pelan dan berputar sumbu Y sekitar 20 detik per putaran, sehingga depan dan belakang bergantian terlihat. Posisinya sedikit bergeser mengikuti mouse (parallax).
- **Lantai:** `Reflector` dari three/addons yang diberi distorsi noise prosedural (dibuat di kode, bukan file tekstur), ditambah fog gelap supaya pantulannya memudar.
- **Cahaya:** satu *rim light* yang warnanya menandai keadaan. Biru-ungu saat diam. Bloom (`UnrealBloomPass`) dengan ambang tinggi, supaya hanya tepi kartu yang bersinar.
- **Event** (`Stage.trigger`):
  - `thinking`: putaran kartu dipercepat dan cahayanya berdenyut;
  - `held`: kilatan biru;
  - `busted`: tepi kartu terbakar oranye (shader *dissolve*), lalu kartu tersusun kembali;
  - `burn`: bara naik dari lantai setiap kali `burned_total` bertambah.
- **Per halaman:** di Home kartu besar di kanan-tengah, seperti kubus ohzi. Di halaman lain kartu lebih kecil dan redup di latar kanan, supaya teks tetap terbaca.
- **Pindah halaman:** efek warp berupa garis-garis cahaya selama sekitar 600 ms.
- **Aksesibilitas dan cadangan:**
  - `prefers-reduced-motion`: tanpa warp, tanpa putaran otomatis, dan kartu diam.
  - Tanpa WebGL: gambar SVG kartu statis.
  - DPR dibatasi 1,5, dan render berhenti saat tab tersembunyi.
  - Canvas diberi `aria-hidden`; semua informasi juga tersedia sebagai teks.

## 6. Halaman

| Halaman | Isi |
|---|---|
| **Home** | Hero (bagian 3) dengan CTA "CALL HIS BLUFF" → Cases. Stat langsung: supply, burned, treasury, minted since launch = 0, hitung mundur epoch, sisa budget, `clean_streak` ("epochs since Mr. X got busted"), `best_streak`. Tiga langkah dan 5 kasus terbaru |
| **TAKSIR** | Tombol faucet ("Claim 500 $TAKSIR", 0,01 NEAR) yang muncul kalau saldo 0. Textarea dengan data contoh, jumlah baris/byte, dan validasi `data.ts`. Baris biaya: 50 $TAKSIR + `exec_deposit + storage_fee` dari `get_params`. Setelah dikirim, kartu berstatus `thinking` lalu muncul **kartu hasil** berisi harga, alasan, link ke kasus, dan "Share on X" |
| **Cases** | Daftar taksiran, terbaru dulu (`get_appraisals`, 20 per halaman): harga, status, jumlah sidak, waktu tersisa jendela sidak |
| **Case** `/case/:id` | Baris data, harga p1, alasan, dan bukti (model, alamat penanda tangan, `response_hash`, link tx). Daftar sidak: p1, p2, selisih %, hasil. Panel **SIDAK**: Shuffle atau Reverse, pratinjau urutan, biaya (stake 25 + NEAR), lalu kirim. Hasil BUSTED memicu `busted` dan **BustCard** ("BUSTED!" dengan harga sebelum/sesudah, hadiah, dan Share on X). Hasil HELD memicu `held` |
| **Ledger** | `get_log`, terbaru dulu, 50 per halaman: waktu, jenis (Mint / Fee burned / Stake burned / Epoch budget burned / Reward / Faucet), jumlah, ref (link kasus), akun. Kontrak tidak menyimpan hash tx per log, jadi tiap baris diberi link ke halaman kontrak di explorer. Batasan ini ditulis apa adanya |
| **Verify** | Jumlah access key kontrak, live dengan keterangan "becomes 0 after the final lock (S6)". Semua `get_params`. `code_hash` kontrak dibandingkan dengan `docs/TESTNET.md`. Hash WASM enclave terkunci, link rilis, dan perintah `sha256sum`. Bukti NEAR AI dari kasus terbaru |

Semua halaman berfungsi tanpa wallet. Tombol kirim berubah menjadi "Connect wallet".

## 7. Alur data dan error

- **Menebak id taksiran baru:** baca `appraisal_count` sebelum mengirim, lalu id = count. Setelah itu dicek: `owner == accountId` dan data sama. Kalau tidak cocok, cari di 10 taksiran terakhir milik akun itu.
- **Id sidak:** diambil dari `get_challenges(appraisal_id)` milik `challenger == accountId` yang terbaru.
- **Polling:** setiap 3 detik, paling lama 90 detik. Lewat dari itu, tampilkan "Mr. X is still thinking. This page updates when he answers" dan polling tetap berjalan.
- **Pesan error kontrak** (format.ts):

| Kode kontrak | Pesan UI |
|---|---|
| `deposit_low` | "Not enough NEAR attached." |
| `too_few_rows` | "Needs at least 5 lines." |
| `too_many_rows` | "Max 100 lines." |
| `too_large` | "Max 2,000 bytes." |
| `already_appraised` | "Mr. X already priced these lines, in some order. Open that case and call his bluff instead." |
| `not_priced` | "This case can't be inspected (not priced yet, or already busted)." |
| `window_closed` | "The 1-hour SIDAK window has closed." |
| `max_challenges` | "This case already has 3 inspections." |
| `same_order` | "Change the order of the lines first." |
| `not_equivalent` | "SIDAK must use exactly the same lines." |
| `faucet_claimed` | "This account already claimed the faucet." |
| `faucet_empty` | "The faucet is empty." |
| `gas_low` | "Not enough gas attached." |
| saldo token kurang atau akun belum terdaftar | "You need $TAKSIR: claim the faucet first." |
| wallet menolak | "Cancelled in wallet." |

## 8. Test

- **Vitest** untuk `data.ts` (vektor kasus yang sama dengan test kontrak), `format.ts`, `shuffle.ts`, error mapping, dan id lookup.
- **React Testing Library:** tiap halaman bisa dirender read-only dengan `rpc` palsu, termasuk saat RPC gagal.
- **Adegan 3D:** tidak diuji unit. Dicek lewat screenshot browser dan uji cadangan tanpa WebGL.
- **Testnet:** alur dengan wallet dijalankan manusia di browser (faucet → taksir → sidak). Agent memverifikasi halaman read-only dengan screenshot.

## 9. Deploy

- Workflow GitHub Actions `.github/workflows/pages.yml` mem-build `web/` lalu mem-publish ke Pages.
- Mengaktifkan Pages di pengaturan repo adalah langkah manusia, atau `gh` dengan izin manusia.
- Demo harus tetap hidup sampai 18 Nov (H-9).

## 10. Urutan potong kalau waktu habis

Dari yang dipotong pertama:
1. papan pemburu (tidak dibuat);
2. efek warp;
3. bara `burn`;
4. Share on X (cukup link intent);
5. animasi *dissolve* `busted` (cukup ganti warna cahaya).

Kartu 3D, lantai, dan semua halaman data tidak dipotong.

## 11. Belum terverifikasi

- Bentuk API pasti `@hot-labs/near-connect` versi saat ini (`connect`, `signAndSendTransaction`, format action), dan wallet testnet yang didukungnya (MyNearWallet testnet, Meteor). Dicek di task pertama yang memakainya.
- Apakah `Reflector` + bloom cukup ringan di laptop biasa. Target ≥ 50 fps di 1080p. Kalau tidak tercapai, lantai diganti pantulan palsu (kartu dicerminkan dengan fade).
