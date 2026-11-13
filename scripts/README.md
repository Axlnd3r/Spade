# scripts/

Semua skrip hanya untuk testnet.

## `deploy.sh`: deploy kontrak ke `vN.spade-taksir.testnet`

```bash
bash scripts/deploy.sh 1   # Git Bash di Windows
```

1. Build kontrak di WSL (`cargo near build non-reproducible-wasm`), lalu salin hasilnya ke `dist/taksir.wasm` dan cetak sha256-nya.
2. Buat `vN.spade-taksir.testnet` dengan modal `INITIAL_NEAR` NEAR (bawaan 5; kodenya saja mengunci sekitar 2,7 NEAR) dari `spade-taksir.testnet`. Key-nya disimpan di legacy keychain `~/.near-credentials`.
3. Deploy dan panggil `new` dengan `scripts/params.testnet.json` dalam satu transaksi yang ditandatangani akun kontrak. Ini wajib karena `new` bersifat `#[private]`.
4. Cetak `get_params`, `get_stats`, dan `ft_total_supply`.

Jika `vN` sudah berisi kontrak, skrip berhenti dan meminta `N` berikutnya, karena parameter tidak bisa diubah. Skrip ini **tidak** menghapus access key.

Setelah deploy (atau saat mengganti API key NEAR AI), manusia memasang ulang secret OutLayer. Aturannya: siapa pun boleh, asal OutLayer dipanggil oleh kontrak `vN` (`Predecessor(Whitelist[vN])`):

```bash
 outlayer secrets set '{"NEAR_AI_API_KEY":"…"}' --wasm-hash 0206187e1ba0c53acb5c5e991b1d559c20eafb01d617a387be5a0848c7348ee2 --profile taksir --access allow-all --via vN.spade-taksir.testnet
```

Jangan pakai `--access whitelist:… --direct`: opsi itu menyimpan `And(Whitelist[…], Predecessor(Whitelist[…]))`, dan bagian pertama dinilai terhadap **penanda tangan**, sehingga semua pengguna selain akun di whitelist mendapat `Failed` (temuan 2026-11-13, `docs/TESTNET.md`). Untuk mengganti aturan tanpa memasukkan ulang key: `outlayer secrets access --wasm-hash 0206187e… --profile taksir --access allow-all --via vN.spade-taksir.testnet`.

## `e2e.mjs`: alur penuh di testnet

```bash
node scripts/e2e.mjs v1.spade-taksir.testnet
```

Penanda tangannya `spade-taksir.testnet`. Alurnya: faucet (hanya kalau saldo 0) → taksir → sidak → taksir data jahil → sidak → stats, log, dan pengecekan I-2. Skrip ini aman dijalankan berulang kali karena setiap run memakai data baru.

## `verify.mjs`: cek kontrak live, baca-saja

```bash
node scripts/verify.mjs                       # v2.spade-taksir.testnet
node scripts/verify.mjs v1.spade-taksir.testnet --offline --require-locked
```

Tidak butuh key dan tidak mengirim transaksi. Semua data dibaca di satu blok final. Yang diperiksa:

- `code_hash` sama dengan sha256 `taksir.wasm` di bagian `### Deploy` kontrak itu di `docs/TESTNET.md`;
- `get_params` sama dengan `params.testnet.json`;
- `wasm_hash` dan `wasm_url` sama dengan rilis enclave, dan sha256 `appraiser.wasm` hasil unduhan sama dengan `wasm_hash` (`--offline` melewati unduhan);
- buku besar punya tepat satu `Mint` (genesis), supply + burned = genesis, dan jumlah burn di buku besar sama dengan `burned_total`;
- I-2: saldo kontrak = treasury + faucet pool + escrow.

Jumlah access key yang belum nol dicetak sebagai WARN, atau FAIL kalau memakai `--require-locked`. Exit 0 berarti semua lolos, exit 1 berarti ada yang tidak cocok, dan exit 2 berarti skrip tidak bisa berjalan (misalnya kontraknya tidak tercatat di `docs/TESTNET.md`). Tesnya: `node --test scripts/verify.test.mjs scripts/lib/near.test.mjs`.

## `params.testnet.json`

Argumen `new`, dengan nilai dalam yocto atau string (D-15). Kunci-kuncinya harus sama persis dengan field `pub` di `contracts/taksir/src/params.rs`.
