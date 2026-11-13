# Demo video

Video berdurasi sekitar 88 detik, 1920×1080, 30 fps, tanpa suara: semua penjelasan ada di caption bahasa Inggris, karena video di X diputar otomatis tanpa suara. Sumbernya ada di `video/` (Remotion). Semua gambar situs direkam dari situs live (https://axlnd3r.github.io/Spade/) dengan Chrome headless, tidak ada yang digambar ulang. Layar terminal memakai output asli `node scripts/verify.mjs`.

## Naskah

| # | Detik | Gambar | Caption |
|---|---|---|---|
| 1 | 0–3 | Kartu judul: logo sekop, "SPADE · $TAKSIR × SIDAK" | RUG THE AI, NOT THE HOLDERS. |
| 2 | 3–15 | Landing: kartu Mr. X di atas air, kartu diputar, klik EXPLORE, transisi terowongan ke How it works | MEET MR. X: An AI sealed inside a TEE. He puts a price from 1 to 10,000 on any list. / THE MECHANIC: SIDAK: send the same lines in a new order. The price should not move. |
| 3 | 15–25 | **Klip wallet** (lihat di bawah). Sampai klip itu ada: halaman TAKSIR, daftar diketik, meter dan rincian biaya | TAKSIR · ASK FOR A PRICE: Pay 50 $TAKSIR, burned. Mr. X answers with a signed price, stored on-chain. |
| 4 | 25–38 | How it works: slider jawaban kedua digeser ke HELD, lalu ke BUSTED | SIDAK · STAKE 25 $TAKSIR: Prices within 75% of each other: HELD. The stake is burned. / BUSTED: More than 75% apart: stake back plus 50 $TAKSIR from the treasury. |
| 5 | 38–47 | Case #3: 10,000 → 1, BUSTED!, +50, daftar dengan catatan tersembunyi, bukti NEAR AI | CASE #3 · NEAR TESTNET: 10,000 for the list, then 1 for the same lines reversed. BUSTED. / THE CAUSE: A hidden note at the end of the list. The model's signature is stored on-chain. |
| 6 | 47–60 | Menu: kartu berganti bentuk tiap item disorot, klik LEDGER, terowongan, daftar burn | ONE CONTRACT: Every rule lives in one NEAR contract. No owner, no setters, no mint function. / LEDGER: Every fee and every lost stake is burned. The supply can only go down. |
| 7 | 60–66 | Overview: supply, burned, minted since launch 0 | LIVE FROM TESTNET: 100,000,000 $TAKSIR minted once, at launch. 42,210 burned so far. |
| 8 | 66–75 | Verify: code hash MATCHES, parameter, hash enclave MATCHES | DON'T TRUST THIS VIDEO: The contract's code and Mr. X's code are both pinned by hash. |
| 9 | 75–83 | Terminal: `node scripts/verify.mjs`, baris PASS satu per satu, "All checks passed." | ONE COMMAND, READ-ONLY: Check every claim against the live chain yourself. |
| 10 | 83–88 | Penutup: SPADE, link repo dan demo, "BUILT FOR THE NEAR HACKATHON 2026 · #NEARHACKATHON", "NEAR testnet demo. Not audited." | — |

Batasan yang sengaja dijaga:

- Kata "No owner" di adegan 6 benar untuk kode kontrak (tidak ada owner, setter, atau fungsi mint). Selama final lock belum dilakukan, adegan 8 dan 9 menampilkan "1 access key" dan WARN apa adanya.
- Case #3 dibuat oleh skrip e2e penulis sendiri (data jebakan, ditangkap oleh akun yang sama, untung bersih 0). Caption tidak menyebut ada pemburu lain.

## Klip wallet (langkah manusia)

Hanya kamu yang bisa merekam ini, karena wallet sungguhan ada di browsermu. Klip ini menggantikan adegan 3. Biayanya sekitar 0,11 NEAR testnet dan 75 TAKSIR.

**Sebelum merekam:**

1. Siapkan wallet testnet yang muncul di pemilih wallet situs (misalnya Meteor). NEAR Mobile tidak bisa dipakai, karena hanya mendukung mainnet. Isi akunnya dengan minimal 0,2 NEAR testnet.
2. Buka https://axlnd3r.github.io/Spade/#/taksir di Chrome, klik CONNECT WALLET, lalu klaim faucet 500 TAKSIR kalau saldomu masih 0.
3. Layar 1920×1080, zoom Chrome 100%, layar penuh (F11).

**Rekam** dengan Snipping Tool (`Win+Shift+R`, pilih seluruh layar) atau Xbox Game Bar (`Win+Alt+R`):

1. Hapus isi kolom, tempel daftar baru minimal 5 baris. Daftarnya harus belum pernah ditaksir, misalnya tambahkan baris berisi tanggal dan jam.
2. Klik APPRAISE, setujui di wallet, lalu tunggu kartu hasil muncul (10–90 detik; masa tunggu nanti dipotong).
3. Buka kasusnya, klik SIDAK, pilih REVERSE, klik CALL SIDAK, setujui di wallet, lalu tunggu hasilnya (HELD atau BUSTED).
4. Hentikan rekaman. Panjang rekaman tidak masalah.

Simpan file-nya sebagai `video/public/wallet.mp4`, lalu beri tahu agen. Agen akan memotong masa tunggu, menyesuaikan durasi dan caption adegan 3 (TAKSIR lalu SIDAK), dan me-render ulang.

## Membangun ulang

Semua perintah dijalankan dari `video/` (Node 20 atau lebih baru, Chrome terpasang di lokasi bawaan Windows; ganti lewat env `CHROME`).

```bash
npm ci
node capture/record.mjs                  # rekam ulang semua adegan situs ke public/footage/ (atau sebut nama: landing verdict ...)
node capture/verify-output.mjs           # jalankan scripts/verify.mjs, simpan hasilnya ke src/verifyOutput.ts
npx remotion studio                      # pratinjau
npx remotion render SpadeDemo out/spade-demo.mp4 --crf=18
```

Dengan klip wallet: `npx remotion render SpadeDemo out/spade-demo.mp4 --crf=18 --props='{"walletClip":"wallet.mp4"}'`.

Setelah final lock, jalankan ulang `node capture/record.mjs verify` dan `node capture/verify-output.mjs`, lalu render ulang, supaya adegan 8 dan 9 menampilkan 0 access key.

Footage (`public/footage/`) dan hasil render (`out/`) tidak di-commit, karena bisa dibuat ulang dengan perintah di atas.

## Posting di X (H-6)

Draf, 268 karakter (link dihitung 23 karakter oleh X). Lampirkan video, lalu taruh link repo di balasan pertama:

```text
Rug the AI, not the holders.

Spade: pay 50 $TAKSIR (burned) and an AI in a TEE prices your list. Stake 25 and resend the lines shuffled: if the price jumps >75%, you get paid. If not, your stake burns.

Built at #NEARHackathon on @NEARProtocol
https://axlnd3r.github.io/Spade/
```

Balasan: `Code, contract and how to verify every claim: https://github.com/Axlnd3r/Spade`
