# Demo video

Video berdurasi sekitar 131 detik, 1920×1080, 30 fps. Batas video X untuk akun biasa adalah 140 detik. Sumbernya ada di `video/` (Remotion).

- **Pembuka** (21 detik) adalah animasi yang dibuat di Remotion. Isinya menjawab satu pertanyaan: apa yang di-"rug" di Spade.
- **Sisanya** direkam dari situs live (https://axlnd3r.github.io/Spade/) dengan Chrome headless, tidak ada yang digambar ulang. Adegan 4 dan 5 adalah transaksi sungguhan di testnet dengan wallet. Layar terminal memakai output asli `node scripts/verify.mjs`.
- **Suara:** musik latar dan lima efek suara di pembuka. Semua penjelasan tetap ada di teks bahasa Inggris, karena video di X diputar otomatis tanpa suara.

## Pesan utama

Tagline "Rug the AI, not the holders" baru dimengerti kalau penonton tahu apa yang di-rug. Karena itu pembuka menjelaskannya lebih dulu, dalam empat ketukan:

| Ketukan | Detik | Layar | Teks |
|---|---|---|---|
| 1 | 0–4 | Kartu kaca melayang di atas air, sisi sekop menghadap penonton. Baris kedua dicoret. | MEMECOINS, USUALLY: Most memecoins rug their holders. |
| 2 | 4–9 | Kartu berbalik dan menampilkan Mr. X. | SPADE · $TAKSIR: Here, the holders rug the AI. Meet Mr. X: an AI appraiser sealed inside a TEE. Catch him bluffing, and his treasury pays you. |
| 3 | 9–16,5 | Diagram mekanik: daftar 7 baris → kartu Mr. X → harga. Baris-barisnya bertukar tempat, harga kedua muncul, cap BUSTED jatuh. | 01 · TAKSIR: Mr. X prices any list, from 1 to 10,000. / 02 · SIDAK: Same lines, new order. Ask him again. / 03 · BUSTED: Price moved more than 75%? His treasury pays you. |
| 4 | 16,5–21 | Kartu kembali ke sisi sekop dan menjadi logo di atas tagline. | NO OWNER · NO MINT · EVERY FEE BURNED / RUG THE AI, NOT THE HOLDERS. / A MEMECOIN WITH A MECHANIC · LIVE ON NEAR TESTNET |

Jadi yang di-"rug" adalah treasury yang dijaga Mr. X: siapa pun yang menangkap dia tidak konsisten dibayar 50 TAKSIR dari treasury itu. Pemegang koin tidak bisa di-rug, karena kontraknya tidak punya owner dan tidak punya fungsi mint.

Yang ditonjolkan untuk track **Memecoins With Mechanics**:

1. **Mekaniknya adalah meme-nya.** Token ini hanya melakukan dua hal, TAKSIR dan SIDAK, dan keduanya adalah method kontrak.
2. **Koinnya makin langka karena dimainkan.** Setiap fee dibakar, stake yang kalah dibakar, dan tidak ada fungsi mint.
3. **Tidak perlu percaya pembuatnya.** AI berjalan di TEE dari kode yang hash-nya dikunci, tiap jawaban ditandatangani, dan satu perintah memeriksa semuanya.
4. **Red-teaming AI sebagai permainan.** Kasus #3 adalah prompt injection yang tertangkap on-chain (adegan 6).

## Naskah adegan

| # | Detik | Gambar | Caption |
|---|---|---|---|
| 1 | 0–21 | Pembuka (tabel di atas) | — |
| 2 | 21–30 | Landing situs live: kartu Mr. X berputar, klik EXPLORE, terowongan ke How it works (kolom ASKER, HUNTER, HOLDER) | NOT A MOCKUP: Everything from here on is the live site, running on NEAR testnet. / THREE WAYS IN: Ask for a price. Hunt for a bluff. Or just hold while the supply burns. |
| 3 | 29–42 | How it works: slider jawaban kedua digeser ke HELD, lalu ke BUSTED | THE RULE · STAKE 25 $TAKSIR: Two prices within 75% of each other: HELD. Your stake is burned. / BUSTED: More than 75% apart: your stake back, plus 50 $TAKSIR from the treasury. |
| 4 | 42–61 | **Wallet sungguhan:** akun `spade-demo.testnet` mengetik daftar, APPRAISE, wallet NEAR CLI menampilkan perintah `near`, panel terminal menampilkan perintah dan output CLI asli, label "110 SECONDS LATER", hash ditempel, Verify, kasus #6 dihargai **2,500** | TAKSIR · REAL WALLET ON TESTNET: Pay 50 $TAKSIR, burned. A fresh account signs with the NEAR CLI wallet. / MR. X SAYS 2,500: Priced inside the TEE. The answer and the model's signature are stored on-chain. |
| 5 | 60–80 | **Wallet sungguhan:** OPEN CASE #6, REVERSE, CALL SIDAK, tanda tangan lagi, label "89 SECONDS LATER", vonis **HELD** (1,500, selisih 40%) | SIDAK · SAME LINES, REVERSED: Stake 25 $TAKSIR and ask again. More than 75% away from 2,500 is BUSTED. / HELD · 2,500 → 1,500: 40% apart, within 75%. Mr. X held steady, so the stake burned. |
| 6 | 79–89 | Case #3: 10,000 → 1, BUSTED!, +50, daftar dengan catatan tersembunyi, bukti NEAR AI | CASE #3 · NEAR TESTNET: 10,000 for the list, then 1 for the same lines reversed. BUSTED. / AI RED-TEAMING, AS A GAME: The list hid a prompt injection. SIDAK caught it, and the proof is on-chain. |
| 7 | 89–102 | Menu: kartu berganti bentuk tiap item disorot, klik LEDGER, terowongan, daftar burn | ONE CONTRACT: Every rule lives in one NEAR contract. No owner, no setters, no mint function. / LEDGER: Every fee and every lost stake is burned. The supply can only go down. |
| 8 | 102–108 | Overview: supply, burned, minted since launch 0 | LIVE FROM TESTNET: 100,000,000 $TAKSIR minted once, at launch. The supply has only gone down since. |
| 9 | 107–117 | Verify: code hash MATCHES, parameter, hash enclave MATCHES | DON'T TRUST THIS VIDEO: The contract's code and Mr. X's code are both pinned by hash. |
| 10 | 117–125 | Terminal: `node scripts/verify.mjs`, baris PASS satu per satu, "All checks passed." | ONE COMMAND, READ-ONLY: Check every claim against the live chain yourself. |
| 11 | 124–131 | Penutup: "MR. X IS LIVE. COME BUST HIM.", link demo dan repo, "BUILT FOR THE NEAR HACKATHON 2026 · #NEARHACKATHON", "NEAR testnet demo. Not audited." | — |

## Batasan yang sengaja dijaga

Nada pembuka memang dilebih-lebihkan, tetapi tiap fakta di dalamnya bisa dicek:

- "Most memecoins rug their holders" adalah retorika, bukan statistik, dan tidak menunjuk proyek mana pun.
- "His treasury" adalah treasury kontrak (60.000.000 TAKSIR saat peluncuran). Mr. X tidak memilikinya; ini personifikasi.
- Angka 10,000 → 1, cap BUSTED, dan +50 $TAKSIR di ketukan 3 adalah kasus #3 yang sungguhan, dan diberi label "REAL CASE #3 · NEAR TESTNET". Daftarnya digambar sebagai 7 batang, sesuai jumlah baris kasus itu.
- "NO OWNER" dan "NO MINT" benar untuk kode kontrak (tidak ada owner, setter, atau fungsi mint). Selama final lock belum dilakukan, adegan 9 dan 10 menampilkan "1 access key" dan WARN apa adanya.
- "EVERY FEE BURNED": fee 50 TAKSIR tiap taksiran yang dihargai memang dibakar.

Untuk adegan situs:

- Adegan 4 dan 5 memotong masa tunggu, dan tiap potongan diberi label berapa detik yang dilewati. Masa tunggu itu adalah `near` CLI yang menunggu seluruh transaksi selesai, termasuk jawaban enclave. Hasilnya (HELD) dipakai apa adanya, tidak direkam ulang demi mendapat BUSTED.
- Akun `spade-demo.testnet` dibuat agen dengan faucet `near-cli-rs` (`sponsor-by-faucet-service`). Ini akun baru, bukan akun pengguna lain.
- Case #3 dibuat oleh skrip e2e penulis sendiri (data jebakan, ditangkap oleh akun yang sama, untung bersih 0). Caption tidak menyebut ada pemburu lain.

## Pembuka

`video/src/Intro.tsx`, juga terdaftar sebagai komposisi tersendiri (`SpadeIntro`) supaya bisa dirender sebagai teaser pendek. Kartunya dibuat dengan CSS 3D: sisi sekop digambar ulang sebagai SVG dari `web/src/scene/cardArt.ts`, dan sisi Mr. X memakai gambar situs sendiri (`web/src/scene/mrx-gembok.png`) yang dibalik warnanya, seperti ukiran cahaya di situs. Satu kartu itu dipakai sepanjang pembuka: melayang, berbalik, menjadi "penaksir" di tengah diagram, lalu menjadi logo.

## Musik dan efek suara

- **Musik** (`video/public/music.m4a`, 135 detik) dibuat dengan model Sonilo Music di Higgsfield pada 2026-11-13 dari prompt berikut. File-nya tidak di-commit, karena bukan buatan sendiri dan tidak bisa dibuat ulang persis sama.

  ```text
  Instrumental noir jazz for the back room of a mafia casino at 2 a.m. Slow, confident swing around 90 BPM in a minor key. Upright bass walking line, brushed snare and soft ride cymbal, smoky muted trumpet playing a sparse, sly melody, dark piano chords, a little vibraphone shimmer. It opens quietly and mysteriously with bass and brushes alone for the first 20 seconds, then the full band settles into a steady, cool groove with heist-film tension. Elegant, cinematic, understated, never busy. No vocals, no singing, no spoken words. Ends with a clean final chord.
  ```

  Perintahnya: `higgsfield generate create sonilo_music --prompt "<prompt>" --duration 135 --wait`, lalu unduh hasilnya ke `video/public/music.m4a`. Tanpa file itu, render dengan `--props='{"music":""}'` untuk video tanpa musik.
- **Efek suara** (whoosh saat kartu berputar, dentum saat cap BUSTED jatuh) disintesis oleh `node capture/sfx.mjs` dari rumus dan noise ber-seed, jadi hasilnya selalu sama. Tidak ada sampel dari pihak lain.

## Klip wallet

Direkam otomatis oleh `node capture/wallet.mjs [akun]` (default `spade-demo.testnet`), tanpa langkah manusia. Di pemilih wallet situs, skrip memilih **NEAR CLI** (salah satu wallet di NEAR Connect), memasukkan nama akun, dan memilih penandatanganan dengan keychain. Untuk tiap transaksi, situs menampilkan perintah `near`. Skrip membaca perintah itu dari layar dan menjalankannya dengan kunci akun di `~/.near-credentials`. Skrip menambahkan `send`, yaitu pilihan yang akan dipilih orang di prompt terakhir CLI. Setelah itu skrip menempelkan hash transaksinya kembali dan menekan Verify, persis seperti yang diminta wallet.

Syaratnya: akun punya NEAR testnet (sekitar 0,12 NEAR per rekaman) dan minimal 75 TAKSIR. Akun baru bisa dibuat gratis dengan `near account create-account sponsor-by-faucet-service <nama>.testnet autogenerate-new-keypair save-to-legacy-keychain network-config testnet create`, lalu klaim faucet 500 TAKSIR di situs.

Hasilnya `public/wallet.mp4` dan `src/walletOutput.ts`, yang berisi perintah, output CLI, harga dari chain, dan waktu tiap kejadian. Titik potong di `src/WalletScenes.tsx` dihitung dari waktu-waktu itu, jadi rekaman baru tidak perlu disetel ulang.

Rekaman yang dipakai (2026-11-13), kasus #6:

- `appraise` `Cr6KzPFY9oJSarDe89jxe9SDTUyDfHAArDoB2o4WQCRm`: harga 2,500.
- `challenge` `51MfuLLPnUCWa1H4Uanyp5Br25qxPfvHxi2DsVDG6itg`: harga 1,500, `Survived`.

## Membangun ulang

Semua perintah dijalankan dari `video/` (Node 20 atau lebih baru, Chrome terpasang di lokasi bawaan Windows; ganti lewat env `CHROME`).

```bash
npm ci
node capture/record.mjs                  # rekam ulang semua adegan situs ke public/footage/ (atau sebut nama: landing verdict ...)
node capture/wallet.mjs                  # transaksi sungguhan: TAKSIR + SIDAK dengan wallet NEAR CLI, ke public/wallet.mp4
node capture/verify-output.mjs           # jalankan scripts/verify.mjs, simpan hasilnya ke src/verifyOutput.ts
node capture/sfx.mjs                     # efek suara ke public/sfx/
npx remotion studio                      # pratinjau
npx remotion render SpadeDemo out/spade-demo.mp4 --crf=18
npx remotion render SpadeIntro out/spade-intro.mp4 --crf=18   # pembuka saja, 21 detik
```

Setelah final lock, jalankan ulang `node capture/record.mjs verify` dan `node capture/verify-output.mjs`, lalu render ulang, supaya adegan 9 dan 10 menampilkan 0 access key.

Footage (`public/footage/`, `public/wallet.mp4`), musik, efek suara, dan hasil render (`out/`) tidak di-commit. Semuanya kecuali musik bisa dibuat ulang dengan perintah di atas.

## Posting di X (H-6)

Draf, 278 karakter (link dihitung 23 karakter oleh X). Lampirkan video, lalu taruh link repo di balasan pertama:

```text
Most memecoins rug their holders. In Spade, holders rug the AI.

Mr. X, an AI in a TEE, prices any list for 50 $TAKSIR. Shuffle it and ask again. Price jumps >75%? His treasury pays you. If not, your stake burns.

Built at #NEARHackathon on @NEARProtocol
https://axlnd3r.github.io/Spade/
```

Balasan: `Code, contract and how to verify every claim: https://github.com/Axlnd3r/Spade`
