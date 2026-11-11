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

### Rilis GitHub (2026-11-11)

- Tag `enclave-v1` (pre-release) menunjuk commit `1cb3b42`.
- **`wasm_url`:** `https://github.com/Axlnd3r/Spade/releases/download/enclave-v1/appraiser.wasm`. URL ini bisa diunduh tanpa login (HTTP 200, 213.917 byte), dan sha256 hasil unduhannya **`0206187e1ba0c53acb5c5e991b1d559c20eafb01d617a387be5a0848c7348ee2`**, sama dengan build reproducible.

### Eksekusi di OutLayer testnet (2026-11-11, akun `spade-taksir.testnet`)

Secret dipasang oleh manusia: `outlayer secrets set … --wasm-hash 0206187e… --profile taksir --access whitelist:spade-taksir.testnet --direct`. Hasilnya: *Calls admitted only from: spade-taksir.testnet*.

| Uji | Transaksi | Hasil |
|---|---|---|
| `outlayer run --wasm <url> --hash <sha>` (CLI, `response_format` Json, batas 10 s / 1e9 instruksi) | `Droz7dpMQ4hGuXMGU5Kk8Sx6zGWiAEpjnUbRFAQreNet` | `p` 500, `a`/`g`/`s` terisi, sekitar 11 detik dari CLI |
| `request_execution` dengan argumen **persis** `outlayer::request_args` kontrak (`Text`, 1e10 / 128 MB / 60 s, `payer_account_id` diisi) | `HxcCsWyoxqv5RZpnF1M2PqVvHNSXxqaremKGJXGfdpMn` | `p` 500. Eksekusi 999 ms, 542.530 instruksi. Run sebelumnya dengan argumen sama: 1.268 ms |

- **Bentuk nilai kembalian ke pemanggil.**
  - `Text`: **string JSON** yang membungkus stdout apa adanya. Contohnya 557 byte untuk stdout 523 byte, dengan urutan kunci asli `v,h,p,r,m,c,a,g,s`.
  - `Json`: OutLayer mem-parse stdout lalu mengembalikan objek yang diserialisasi ulang, dengan urutan kunci alfabetis.

  Kontrak memakai `Text`, dan `parse_output` sudah menerima bentuk ini (test `parse_output_accepts_object_and_wrapped_string`).
- **Biaya per eksekusi:**
  - `estimate_execution_cost` untuk batas kontrak (1e10 / 128 / 60) adalah **0,007001 NEAR**. Itu deposit minimum.
  - Yang ditagih riil sekitar **0,0011 NEAR** (1.099.900–1.126.800 × 10¹⁸ yocto). Sisanya dikembalikan ke `payer_account_id`.
  - Gas transaksi sekitar 0,00073 NEAR.
- **`payer_account_id`:** pada uji ini sama dengan penanda tangan, sehingga refund-nya tidak bisa dibedakan. Perilakunya saat dipanggil lewat kontrak (pemanggil ≠ payer) diuji di S4 (D-7).
