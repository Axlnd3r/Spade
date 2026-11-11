# Worklog

## 2026-11-10

- Blueprint dibaca. Roadmap dan plan Section 1 ditulis di `docs/superpowers/plans/`.
- Keputusan awal dicatat di `docs/DECISIONS.md` (D-1 sampai D-5).
- Kerangka repo dibuat (S1-T1).
- S1-T2: aturan hackathon dan track, docs OutLayer, dan docs NEAR AI Cloud diverifikasi. Hasilnya di DECISIONS D-6 sampai D-8, tanpa BLOCKER.
- S1-T3: versi toolchain (Windows host + WSL Ubuntu 24.04):
  - WSL: rustc 1.95.0 (default, sudah ada sebelumnya) dan 1.99.1 (`stable`, dipasang untuk tool). Kedua toolchain punya target `wasm32-unknown-unknown` dan `wasm32-wasip2`.
  - WSL: `cargo-near` 0.23.0, dipasang dengan `cargo +stable install --locked cargo-near --no-default-features`. Tanpa fitur `ledger`, karena `libudev-dev` butuh sudo. Akibatnya cargo-near tidak mendukung dompet hardware Ledger.
  - WSL: `wasmtime` 50.0.1 (`cargo +stable install --locked wasmtime-cli`).
  - Windows: Node 24.19.0, Python 3.13.16, near-cli-rs 0.30.1. Node di WSL v18 tidak dipakai.
  - Skill agent NEAR `near-ai-cloud` dan `near-smart-contracts` dipasang di `.claude/skills/` (lihat `skills-lock.json`).
- S1-T4 sampai S1-T6: prompt, 40 dataset, spike (`spike/`), dan vectors bersama selesai. `cd spike && node --test` → 50/50. Review menyeluruh sudah dilakukan dan temuannya diperbaiki.
- Menunggu: API key NEAR AI dari manusia untuk S1-T7.

### Titik lanjut (checkpoint 2026-11-10)

- **Selesai:** S1-T1 sampai S1-T6. Ledger eksekusi lokal (tidak di-commit) ada di `.superpowers/sdd/2026-11-10-section-1-setup-experiment/progress.md`.
- **Berikutnya: S1-T7** (plan `docs/superpowers/plans/2026-11-10-section-1-setup-experiment.md`, Task 7).
  1. Manusia mengisi `.env` dari `.env.example` (`NEAR_AI_API_KEY`).
  2. `node spike/consistency.mjs --list-models`, lalu pilih model TEE milik `nearai`, catat sebagai D-9. Kandidat: `z-ai/glm-5.3-flash`, `Qwen/Qwen3.6-35B-A3B-FP8`. Hindari model reasoning karena `max_tokens` 120.
  3. `node spike/consistency.mjs --model <id>`, isi bagian Analysis di `docs/EXPERIMENT.md` (usulan `threshold_bps`).
  4. **CHECKPOINT 1:** laporkan ke manusia dan tunggu keputusannya.
- **Opsional paralel (D-5):** S2 kontrak boleh dimulai. Plan S2 belum ditulis.
- **Minor tertunda:** ada empat. Yang paling penting untuk S2: batas tepat 25% (`>` ketat) pada aturan M-11 harus dipatok di test kontrak.

## 2026-11-11

- Kunci API NEAR AI diisi oleh manusia. Awalnya setiap panggilan ditolak dengan HTTP 402 `no_limit_configured` karena akun belum punya kredit. Runner sekarang menganggap 402 fatal (`597d9bd`).
- S1-T7: model dipilih, yaitu `Qwen/Qwen3-VL-30B-A3B-Instruct` (D-9). Eksperimen 160 panggilan selesai dalam 29 detik, tanpa kegagalan.
  - Pada ambang 25%, data biasa tertangkap 40% dan data jahil 46,7%.
  - Usulan `threshold_bps` 7500 (data biasa 10%). Rinciannya di `docs/EXPERIMENT.md`.
- **CHECKPOINT 1:** manusia memutuskan SIDAK dilanjutkan dengan `threshold_bps` 7500 (D-10).
- Plan Section 2 ditulis: `docs/superpowers/plans/2026-11-11-section-2-contract.md`.
- S2-T1..T7: kontrak `contracts/taksir` dan `contracts/mock-outlayer` selesai. Unit test 63/63 dan sandbox 15/15. Build `cargo near build non-reproducible-wasm` menghasilkan `taksir.wasm` sebesar 261.638 byte.
- S2-R: review menyeluruh (reviewer baru, opus): 0 Critical, 2 Important, 6 Minor. Hasil pass perbaikan:
  - faucet kini membayar penyimpanannya sendiri;
  - `new` menjadi `#[private]`;
  - skenario gas terburuk di 170 TGas: receipt terberat 5,1 TGas.
  Suite akhir: unit 65, sandbox 17, mock 3, semuanya lolos. Clippy bersih. `taksir.wasm` 261.974 byte. Enam temuan Minor ditunda dan dilaporkan di CHECKPOINT 2.
- **CHECKPOINT 2:** menunggu keputusan manusia.
