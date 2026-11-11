# scripts/

Semua skrip hanya untuk testnet.

## `deploy.sh`: deploy kontrak ke `vN.spade-taksir.testnet`

```bash
bash scripts/deploy.sh 1   # Git Bash di Windows
```

1. Build kontrak di WSL (`cargo near build non-reproducible-wasm`), lalu salin hasilnya ke `dist/taksir.wasm` dan cetak sha256-nya.
2. Buat `vN.spade-taksir.testnet` dengan modal 5 NEAR dari `spade-taksir.testnet`. Key-nya disimpan di legacy keychain `~/.near-credentials`.
3. Deploy dan panggil `new` dengan `scripts/params.testnet.json` dalam satu transaksi yang ditandatangani akun kontrak. Ini wajib karena `new` bersifat `#[private]`.
4. Cetak `get_params`, `get_stats`, dan `ft_total_supply`.

Jika `vN` sudah berisi kontrak, skrip berhenti dan meminta `N` berikutnya, karena parameter tidak bisa diubah. Skrip ini **tidak** menghapus access key.

Setelah deploy, manusia memasang ulang secret OutLayer dengan whitelist akun kontrak:

```bash
 outlayer secrets set '{"NEAR_AI_API_KEY":"…"}' --wasm-hash 0206187e1ba0c53acb5c5e991b1d559c20eafb01d617a387be5a0848c7348ee2 --profile taksir --access whitelist:vN.spade-taksir.testnet,spade-taksir.testnet --direct
```

## `e2e.mjs`: alur penuh di testnet

```bash
node scripts/e2e.mjs v1.spade-taksir.testnet
```

Penanda tangannya `spade-taksir.testnet`. Alurnya: faucet (hanya kalau saldo 0) → taksir → sidak → taksir data jahil → sidak → stats, log, dan pengecekan I-2. Skrip ini aman dijalankan berulang kali karena setiap run memakai data baru.

## `params.testnet.json`

Argumen `new`, dengan nilai dalam yocto atau string (D-15). Kunci-kuncinya harus sama persis dengan field `pub` di `contracts/taksir/src/params.rs`.
