# Keputusan

Catatan setiap keputusan yang menyimpang dari, menafsirkan, atau melengkapi blueprint (`README.md`, nanti `docs/BLUEPRINT.md`). Format: Konteks / Keputusan / Alasan.

## D-1 Toolchain Rust di WSL

- **Konteks:** Mesin pengembang Windows 11. `near-workspaces` butuh biner `near-sandbox` yang tidak tersedia untuk Windows.
- **Keputusan:** Rust stable, `cargo-near`, `wasmtime`, dan semua test kontrak/enclave dijalankan di WSL Ubuntu (`wsl -e bash -lc "cd /mnt/c/Users/User/Documents/Spade && …"`). Node, Python, dan `near-cli-rs` tetap di Windows.
- **Alasan:** Satu lingkungan Linux untuk semua build dan test Rust, sehingga hasil build sama dengan CI Linux.

## D-2 Aturan normalisasi dan ukuran data (M-4)

- **Konteks:** M-4 menyebut "buang `\r` dan spasi di ujung tiap baris" tanpa merinci jenis whitespace dan sisi mana. Spike (JS), kontrak (Rust), dan enclave (Rust) harus menghasilkan baris yang identik.
- **Keputusan:**
  1. Pecah teks per `\n`.
  2. Buang karakter ASCII `' '` (0x20), `'\t'` (0x09), dan `'\r'` (0x0D) di **kedua ujung** tiap baris. Whitespace Unicode lain (NBSP, BOM, dan sebagainya) **tidak** dibuang.
  3. Buang baris yang kosong setelah langkah 2.
  4. `max_data_bytes` dibandingkan dengan panjang byte UTF-8 **input mentah**, sebelum normalisasi.
- **Alasan:** Definisi "whitespace" Unicode berbeda antara JS `trim()` dan Rust `str::trim()`. Membatasi ke tiga karakter ASCII menghilangkan perbedaan itu. Ukuran dicek pada input mentah karena itulah yang dibayar sebagai storage dan gas, dan pengecekannya bisa dilakukan sebelum ada kerja lain. Kasus-kasusnya dipatok di `enclave/appraiser/vectors/vectors.json`.

## D-3 Urutan pengurutan untuk `canonical_hash` (M-5)

- **Konteks:** `Array.prototype.sort()` di JS membandingkan unit kode UTF-16, sedangkan `Vec<String>::sort()` di Rust membandingkan byte UTF-8. Keduanya berbeda untuk karakter di luar BMP (misalnya emoji).
- **Keputusan:** Baris diurutkan menurut urutan byte UTF-8 (sama dengan Rust). Di JS: `Buffer.compare`.
- **Alasan:** Kontrak adalah otoritas pengecekan kesetaraan (M-6), jadi semua komponen lain mengikuti perilaku Rust.

## D-4 Nama proyek

- **Konteks:** Proyek ini didaftarkan dengan nama Spade, sedangkan blueprint menamai token dan fitur TAKSIR dan SIDAK.
- **Keputusan:** Spade adalah nama proyek dan repo. Token tetap NEP-141 `TAKSIR` (M-1). Fitur tetap bernama TAKSIR (taksiran) dan SIDAK (uji ulang). Diputuskan manusia pada 2026-11-10.
- **Alasan:** M-1 menetapkan simbol token, dan aturan M tidak boleh diubah diam-diam.

## D-5 Pengerjaan paralel terbatas

- **Konteks:** Blueprint bagian 0 meminta Section 1–6 dikerjakan berurutan, sedangkan tenggat tinggal 4 hari.
- **Keputusan:** Disetujui manusia pada 2026-11-10. Task yang tidak bergantung pada hasil CHECKPOINT (kode kontrak, logika murni enclave, kerangka simulasi, web baca-saja) boleh dikerjakan paralel. Deploy, penguncian parameter, dan keputusan cabang tetap menunggu CHECKPOINT.
- **Alasan:** Waktu. Risikonya: kalau CHECKPOINT 1 memilih jalur cadangan TEBAK HARGA, kode sidak (S2-T5) harus diganti.
