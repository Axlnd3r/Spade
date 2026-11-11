# Testnet

Angka riil dari testnet dan dari build enclave. Setiap baris memuat tanggal dan cara memeriksanya ulang.

## Enclave `appraiser.wasm` (S3-T4)

### Build reproducible (2026-11-11)

- **Perintah** (WSL, Docker), memakai skrip OutLayer dari `https://github.com/out-layer/outlayer` commit `3fb03a9e`:
  ```bash
  scripts/build_github_wasm.sh --dir enclave/appraiser --target wasm32-wasip2 --twice --keep
  ```
- **Image compiler:** `outlayer/wasmedge-compiler@sha256:d9eb7bd9bab6c46b77f309ec33e94ca112883268a848dd1929289fade799cd27` (amd64). Resepnya `cargo build --release --locked` lalu `wasm-tools strip`, sama dengan worker OutLayer.
- **Toolchain:** `rustc 1.95.0 (59807616e 2026-04-14)`, dari `enclave/appraiser/rust-toolchain.toml`.
- **Source:** `enclave/appraiser` pada commit `ac78b62`.
- **Hasil:** kedua build menghasilkan byte yang sama.
  - **sha256 (`wasm_hash`): `0206187e1ba0c53acb5c5e991b1d559c20eafb01d617a387be5a0848c7348ee2`**
  - Ukuran: 213.917 byte.
- **Uji lokal** dengan wasmtime 50 dan key asli memakai file ini:
  - data 5 baris → `p` 500;
  - data 100 baris berisi tanda kutip (1.999 byte) → `p` 10;
  - pada kedua run, `a`/`g` terisi dan `h` sama dengan `raw_hash`.

Siapa pun bisa mengulang perintah di atas pada commit yang sama dan mendapat hash yang sama. Hash ini yang dikunci kontrak (`wasm_hash`) dan dipakai untuk mengikat secret.
