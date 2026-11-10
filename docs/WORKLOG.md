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
