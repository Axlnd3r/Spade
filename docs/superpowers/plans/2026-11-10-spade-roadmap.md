# Spade (TAKSIR × SIDAK) — Roadmap & Pembagian Tugas

> **For agentic workers:** dokumen ini adalah peta tugas, bukan plan eksekusi. Tiap Section punya plan detail sendiri di `docs/superpowers/plans/` yang ditulis **setelah** CHECKPOINT sebelumnya disetujui. Eksekusi plan detail memakai superpowers:subagent-driven-development atau superpowers:executing-plans.

**Proyek:** Spade — NEAR HACKATHON 2026, track **Memecoins With Mechanics** (`memecoins`)
**Spec:** `README.md` (blueprint; dipindah ke `docs/BLUEPRINT.md` di Section 6)
**Tenggat:** 14 Nov 2026 23:59 UTC. Target submit 14 Nov 18:00 UTC. Hari ini: 10 Nov.

## Global Constraints (berlaku untuk semua task)

- Hanya NEAR **testnet**. Mainnet tidak boleh disentuh.
- Tidak ada secret, private key, API key, JWT, atau `.env` di commit (H-8).
- Tidak ada method admin, setter parameter, owner, upgrade, atau migrate di kontrak (M-16, T-2, T-3).
- Aturan `H-`, `T-`, `M-`, `I-` mengikat. Kalau ada yang tidak bisa dipenuhi: berhenti dan laporkan.
- Kalau docs resmi bertentangan dengan blueprint, ikuti docs dan catat perbedaannya di `docs/DECISIONS.md`.
- Commit kecil per langkah. Progres harian dicatat di `docs/WORKLOG.md`.
- Hanya manusia yang boleh: memposting ke X, mengirim submission, menghapus access key.

## Keputusan lingkungan (dicatat di DECISIONS.md di S1-T1)

- Host: Windows 11. Node 24.19, Python 3.13, near-cli-rs 0.30.1 sudah terpasang.
- **Rust, cargo-near, wasmtime, dan sandbox test berjalan di WSL Ubuntu**, karena biner `near-sandbox` untuk `near-workspaces` tidak tersedia di Windows. Perintah Rust dijalankan lewat `wsl -e bash -lc "cd /mnt/c/Users/User/Documents/Spade && …"`.
- Normalisasi data (M-4), yang sama persis di spike, kontrak, dan enclave:
  - pecah per `\n`;
  - buang karakter ASCII `' '`, `'\t'`, `'\r'` di **kedua ujung** tiap baris (bukan whitespace Unicode, supaya JS dan Rust tidak berbeda);
  - buang baris kosong.
- `max_data_bytes` diukur dari panjang byte UTF-8 **input mentah** sebelum normalisasi.
- Pengurutan untuk `canonical_hash` (M-5) memakai **urutan byte UTF-8**, bukan urutan UTF-16 bawaan JS.

## Peta tugas

Legenda lane: **A** = jalur kritis berurutan. **B/C** = bisa paralel dengan A tanpa menunggu checkpoint. 👤 = butuh manusia.

### Section 1 — Setup & eksperimen konsistensi (10–11 Nov) → CHECKPOINT 1

| ID | Task | Lane | Butuh | Skill |
|---|---|---|---|---|
| S1-T1 | Kerangka repo: git init, `.gitignore`, `.gitattributes`, `LICENSE`, `.env.example`, folder, DECISIONS/WORKLOG | A | — | karpathy-guidelines |
| S1-T2 | Verifikasi aturan: HACKATHON.md, `11-memecoins.md`, docs OutLayer, NEAR AI Cloud (item bagian 7) | B | — | bright-data / WebFetch |
| S1-T3 | Toolchain di WSL, plus skill NEAR untuk agent | B | — | verification-before-completion |
| S1-T4 | `enclave/appraiser/prompt.txt` | A | — | — |
| S1-T5 | Dataset: 30 biasa + 10 jahil | C | — | — |
| S1-T6 | `spike/lib.mjs` (fungsi murni, TDD) + `spike/consistency.mjs` | A | — | test-driven-development |
| S1-T7 | Jalankan eksperimen, tulis `docs/EXPERIMENT.md` | A | 👤 API key NEAR AI | verification-before-completion |

Detail: `2026-11-10-section-1-setup-experiment.md`.

### Section 2 — Kontrak (11 Nov) → CHECKPOINT 2

Bisa dimulai paralel dengan S1-T7 (lane B). Risikonya: kalau CHECKPOINT 1 memilih jalur cadangan TEBAK HARGA, task S2-T5 harus diganti. Token, epoch, dan taksiran tetap terpakai.

| ID | Task | Skill |
|---|---|---|
| S2-T1 | Modul `data.rs`: normalisasi, validasi, `raw_hash`, `canonical_hash`. Baca `enclave/appraiser/vectors/*.json` (dibuat dari `spike/lib.mjs`) | test-driven-development |
| S2-T2 | `Params`, `new`, NEP-141/145/148, `faucet`, `get_params`, `get_stats`. Test M-1..M-3, I-1, I-3 | test-driven-development, near-smart-contracts |
| S2-T3 | Epoch malas, budget, pembakaran sisa, maksimal 1.000 epoch per panggilan, streak, `poke`. Test M-13..M-15 | test-driven-development |
| S2-T4 | `appraise` + `on_appraise_result`: argumen OutLayer, validasi hasil enclave. Test M-7, M-8, I-5, I-6 | test-driven-development |
| S2-T5 | `challenge` + `on_challenge_result`. Test M-9..M-12 | test-driven-development |
| S2-T6 | Log + view berhalaman (`get_log`, `get_appraisals`, `get_challenges`). Test I-2, I-4 | test-driven-development |
| S2-T7 | `contracts/mock-outlayer` + 13 skenario sandbox (WSL) + `cargo near build` | systematic-debugging bila gagal |
| S2-R | Review kontrak sebelum CHECKPOINT 2 | requesting-code-review / code-review, security-review |

### Section 3 — Enclave (12 Nov) → CHECKPOINT 3

| ID | Task | Lane | Skill |
|---|---|---|---|
| S3-T1 | `src/lib.rs` murni + test `vectors/` (bisa dikerjakan bersamaan dengan S2-T2 dan seterusnya, setelah S2-T1) | C | test-driven-development |
| S3-T2 | `src/main.rs` (stdin, HTTP, stdout ≤ 900 byte) + build `wasm32-wasip2` + uji lokal dengan wasmtime | A | near-ai-cloud, systematic-debugging |
| S3-T3 | Ambil signature (`c`, `a`, `g`) | A | near-ai-cloud |
| S3-T4 | 👤 GitHub Release `.wasm` + secret OutLayer + satu `request_execution` di testnet, dicatat di `docs/TESTNET.md` | A | systematic-debugging |

### Section 4 — Integrasi testnet, simulasi, kunci parameter (12–13 Nov) → CHECKPOINT 4

| ID | Task | Lane | Skill |
|---|---|---|---|
| S4-T1 | `sim/simulate.py` + grafik `docs/sim/`. Tingkat tertangkap jadi input, jadi kodenya bisa ditulis setelah CHECKPOINT 1, paralel dengan S2 | B | dataviz, test-driven-development |
| S4-T2 | Pilih parameter final, tulis alasannya di DECISIONS | A | — |
| S4-T3 | `scripts/deploy.sh`: sub-akun `vN.<akun>`, deploy, `new` | A | — |
| S4-T4 | 👤 `scripts/e2e.mjs` lulus dua kali + `docs/TESTNET.md` lengkap | A | verification-before-completion |

### Section 5 — Web (13 Nov) → CHECKPOINT 5

| ID | Task | Lane | Skill |
|---|---|---|---|
| S5-T1 | Vite + React + TS, lapisan RPC view, halaman Beranda dan Log (baca-saja). Bisa dimulai dengan data tiruan setelah antarmuka view S2 tetap | B | test-driven-development |
| S5-T2 | Koneksi wallet + Taksir (faucet, kirim, kartu) + Detail/SIDAK (acak) | A | chrome-devtools-mcp |
| S5-T3 | Verifikasi + Papan inspektur (boleh dipotong) | A | — |
| S5-T4 | Deploy GitHub Pages + screenshot tiap halaman | A | chrome-devtools-mcp, a11y-debugging, run |

### Section 6 — Demo & submission (14 Nov)

| ID | Task | Skill |
|---|---|---|
| S6-T1 | `scripts/verify.mjs` (baca-saja, gagal jika tidak cocok dengan TESTNET.md) | test-driven-development |
| S6-T2 | `docs/THREAT_MODEL.md`, `docs/DEMO.md` (naskah video) | — |
| S6-T3 | Pindahkan blueprint, tulis README publik (Inggris, untuk juri AI) | verification-before-completion |
| S6-👤 | Manusia: hapus access key, video + posting X, kirim submission sekali, jaga repo publik dan demo hidup | — |

## Urutan potong jika waktu habis (blueprint bagian 5)

Papan inspektur → verifikasi signature di enclave → susun-manual SIDAK → tombol share X → simulasi dikurangi jadi 2 skenario. **Aturan M dan test invarian tidak pernah dipotong.**

## Prasyarat manusia (harus siap sebelum task yang ditandai 👤)

1. API key NEAR AI Cloud dengan saldo, untuk S1-T7. Simpan di `.env` sebagai `NEAR_AI_API_KEY`.
2. Akun NEAR testnet berisi NEAR, untuk S3-T4 dan S4.
3. Akun OutLayer + CLI `outlayer`, untuk S3-T4.
4. Repo GitHub publik yang masih kosong, untuk S1-T1 (remote) dan S3-T4 (Release). `gh` CLI belum terpasang.
5. Akun X, untuk S6.
