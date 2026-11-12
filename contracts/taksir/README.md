# TAKSIR contract

NEP-141 token `TAKSIR` with the TAKSIR (appraise) and SIDAK (challenge) mechanics. Spec: `../../docs/BLUEPRINT.md` (blueprint) §2 and Section 2; plan: `../../docs/superpowers/plans/2026-11-11-section-2-contract.md`.

Build and test run in WSL (see `docs/DECISIONS.md` D-1):

```bash
CARGO_TARGET_DIR=$HOME/.cache/spade-target/taksir cargo test
cargo near build non-reproducible-wasm
```
