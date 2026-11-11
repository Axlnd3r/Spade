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

## Kontrak TAKSIR (S4)

### Deploy `v1.spade-taksir.testnet` (2026-11-11, `bash scripts/deploy.sh 1`)

| Item | Nilai |
|---|---|
| Kontrak | `v1.spade-taksir.testnet` (sub-akun `spade-taksir.testnet`, modal awal 5 NEAR) |
| `taksir.wasm` | sha256 `a8b90d5a9d54ce1fb9085ee0e2980780acd8c8f4431d5ae2f92b5b7c0b6b0127`, 262.766 byte, `cargo near build non-reproducible-wasm` (code_hash bs58 `CMd9x3xLmM3dm9HDsxhZMz1Z4Etzcs3RgasvMnarWV4J`) |
| Buat akun | `FX5pq8WfT5rEP7qiyZe5nzd9qcAwMtBWHP3NUxGHegro` |
| Deploy + `new` (ditandatangani akun kontrak) | `CwEwDSocVtkuVytTkDQpYk8xqHhe1b5ew8icW8Pwziqr`; log `ft_mint` 10²⁶ ke kontrak, memo `genesis` |
| Parameter | `scripts/params.testnet.json` (D-15); `get_params` identik |
| Keadaan awal | supply 100 jt, kas 60 jt, faucet 40 jt, budget epoch 300 TAKSIR |

Access key akun kontrak **belum dihapus**. Penghapusan key (T-3) adalah langkah manusia di S6.

### Secret OutLayer untuk kontrak (2026-11-11)

Manusia memasang ulang profil `taksir` dengan opsi `--access whitelist:v1.spade-taksir.testnet,spade-taksir.testnet --direct`. Dengan `--direct`, whitelist menilai akun yang memanggil `outlayer.testnet`, yaitu kontrak. Kedua run e2e di bawah membuktikan kontrak bisa membaca secret ini.

### E2E `node scripts/e2e.mjs v1.spade-taksir.testnet` (2026-11-11, penanda tangan `spade-taksir.testnet`)

Kedua run selesai dengan exit 0. Run 2 melewati faucet karena saldo sudah ada, dan memakai data baru.

| Run | Langkah | Transaksi | Hasil |
|---|---|---|---|
| 1 | faucet | `8CLHKy6xhurT3MALd8QGdscapeGcTYePAVztm1WD3515` | +500 TAKSIR |
| 1 | taksir data normal (#0) | `EwxNUUfEEcZ7de7WBkQetJMR47BvzBJmpJcyFrT27hLu` | `Priced` 2500 |
| 1 | sidak #0, urutan diacak | `4neiQ8iqpZvxaEjXVPJWdYSNWuBBAThPYQyunTNkhW46` | `Survived` (1500 vs 2500, selisih 40% < 75%); stake 25 dibakar |
| 1 | taksir a02 + baris unik (#1) | `Jjb5CzHuuq1cdiEcGotwxCSVg3QPG7djGv8nYcUr3Z9` | `Priced` 1 |
| 1 | sidak #1, urutan dibalik | `2J7mBJvqynL8YjRSdLiP3bR4rQZFPZf1hQdKCrWwQsML` | `Survived` (1 vs 1) |
| 2 | faucet | (dilewati, saldo 430 TAKSIR) | — |
| 2 | taksir data normal (#2) | `5JwhMFUkuacR51MFZSq4CuFUvRMep4wRDuE2gQWFjWYS` | `Priced` 1500 |
| 2 | sidak #2, urutan diacak | `2dmQ1L9kP7CpPhfYaMBoMjz6ecHWMVEEPV8b5wVuccXJ` | `Survived` (1500 vs 1500) |
| 2 | taksir a02 + baris unik (#3) | `6DZnmbRfCwiBneg3Uqy1Gaxuyq8e3GLyFtDLJVMVEwpz` | `Priced` **10000**: injeksi prompt di baris terakhir berhasil |
| 2 | sidak #3, urutan dibalik | `9h6E6UqnaRC4dYdEkEiQXGLpWtoawimyFWyJ528yoMjc` | **`Caught`** (1 vs 10000). Stake dikembalikan dan reward 50 TAKSIR (2 × 25) dibayar dari kas |

- **Invarian I-2** `ft_balance_of(kontrak) == treasury + faucet_pool + escrow` terpenuhi di akhir kedua run.
- **Log** mencatat `Mint`, `Faucet`, `BurnFee`, `BurnStake`, `BurnEpoch` (300 TAKSIR, satu epoch 10 menit tanpa tangkapan), dan `Reward`.
- **`response_hash`** terisi di setiap taksiran, misalnya #0 `17d6a2d3a6ca7657…`.
- **Perilaku `payer_account_id` saat yang memanggil OutLayer adalah kontrak** (D-7):
  - Sisa `exec_deposit` dikembalikan **oleh `outlayer.testnet` langsung ke pengguna** (payer), bukan ke kontrak. Nilainya 0,005964–0,005968 NEAR dari 0,0071 NEAR, jadi biaya eksekusi riil sekitar 0,00113 NEAR.
  - Transfer lain dari `system` adalah refund gas.
  - Kontrak hanya menyimpan `storage_fee` 0,05 NEAR per operasi.
  - Biaya bersih per taksiran atau sidak bagi pengguna: sekitar 0,0511 NEAR ditambah gas.
