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
  5. Urutan pengecekan sekaligus prioritas kode error: `too_large` lebih dulu, lalu `too_few_rows`, lalu `too_many_rows`.
  6. Form feed (0x0C) dan vertical tab (0x0B) **tidak** dibuang. Port Rust tidak boleh memakai `is_ascii_whitespace()` atau `trim()`.
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

## D-6 Aturan hackathon dan track (diverifikasi 2026-11-10)

- **Konteks:** Bagian 2.1 dan 2.2 blueprint disusun dari sumber kedua. Sumber primer: `https://nearhackathon.com/HACKATHON.md` dan `tracks/11-memecoins.md`.
- **Keputusan:** H-1..H-9 dan T-1..T-6 **cocok** dengan sumber primer. Tidak ada BLOCKER. Tambahan dan perbedaan:
  1. Agent juga **tidak boleh push, force-push, atau membuat repo publik** tanpa konfirmasi eksplisit manusia. Ini ditambahkan ke daftar larangan.
  2. Submission dikirim lewat `POST https://nearhackathon.com/api/applications`. Field yang diisi manusia: `projectName`, `leadName`, `email`, `size`, `tracks`, `nearAddress` (akun **mainnet** untuk hadiah), `projectUrl`, `demoUrl`, `idea` (20–2000 karakter), `consent`. `requestId` adalah UUID yang dibuat sekali dan dipakai ulang saat retry. Payload tidak boleh di-commit.
  3. **Satu proyek boleh masuk beberapa track**, dalam satu submission dengan array `tracks` ("every track the project fits"). Track utama `memecoins`. Kandidat tambahan: `security` (TEE attestation) dan `privacy` (TEE, NEAR AI Cloud). Diputuskan manusia saat submit.
  4. Q-012: kalau juri tidak bisa membuka demo, screenshot saja tidak cukup, jadi video wajib ada. Demo yang di-host dijaga sampai 18 Nov, idealnya 25 Nov.
  5. Q-015: kalau orang yang sama juga mengirim proyek lain, README harus menyebut proyek itu.
  6. Q-000: kredit NEAR AI $10 bisa diklaim lewat NEAR Builders (API key terpisah).
  7. Partner BRRRAIN ("Memecoin with AI rewards") temanya mirip. README publik perlu menjelaskan bedanya. meme.cooking hanya petunjuk, tidak wajib.
- **Alasan:** Dokumentasi primer menang (blueprint bagian 0, poin 5).

## D-7 OutLayer (diverifikasi 2026-11-10 dari `/docs/near-integration`, `/docs/wasi`, `/docs/secrets`, `/docs/tee-attestation`, `docs/CLI.md`)

- **`request_execution`:** bentuk di blueprint benar.
  - `source.WasmUrl {url, hash, build_target}`.
  - `resource_limits` **wajib** (boleh `{}`): `max_instructions` default 1e9, maksimal 5e11; `max_memory_mb` default 128, maksimal 4096; `max_execution_seconds` default 60, maksimal 180. Halaman `/docs/wasi` menyebut batas 100 miliar instruksi dan 60 detik, jadi nilai di blueprint (1e10, 128, 60) aman.
  - `input_data` berupa String. `secrets_ref {profile, account_id}`. `response_format` salah satu dari `Text|Json|Bytes`.
- **`payer_account_id`:** kalau dikosongkan, pengirim (yaitu kontrak kita) yang membayar dan menerima refund. **Keputusan:** diisi dengan akun pengguna (`predecessor`). Perilakunya tetap diuji di testnet (S3-T4).
- **Biaya:** base fee + instruksi + waktu. Eksekusi yang gagal tetap dibayar sesuai resource yang terpakai. Ada view `estimate_execution_cost(resource_limits, input_len)` untuk menentukan deposit minimum.
- **Callback:** saat sukses, isinya stdout sesuai `response_format`. Bentuk hasil saat gagal atau timeout **tidak didokumentasikan**. **Keputusan:** semua hasil yang tidak sukses atau tidak bisa di-parse diperlakukan sebagai `Failed`, lalu bentuk riilnya dicatat di `docs/TESTNET.md`.
- **Gas:** contoh di docs memakai 100 TGas untuk request dan 10 TGas untuk callback. Kita tetap memakai 40 TGas untuk callback, sesuai blueprint.
- **Secret yang terikat hash:** untuk sumber `WasmUrl`, secret disegel ke hash WASM, sehingga hanya biner dengan hash itu yang bisa mendekripsinya.
  - **Penting:** secara default, aturan akses dinilai terhadap *penanda tangan transaksi* (pengguna acak), bukan kontrak. Untuk "akses hanya lewat kontrak", rencananya: `outlayer secrets set '{"NEAR_AI_API_KEY":"…"}' --wasm-hash <sha> --profile taksir --access whitelist:<akun-kontrak> --direct`.
  - **[VERIFIKASI di S3-T4]** Belum jelas apakah aturan `--direct` menilai `predecessor` = kontrak kita, karena OutLayer dipanggil kontrak, bukan pengguna.
- **CLI:**
  - Pasang dengan `curl -fsSL https://raw.githubusercontent.com/out-layer/outlayer-cli/main/install.sh | sh` di WSL, atau `cargo install outlayer-cli` (Rust 1.86+).
  - `outlayer login testnet` menyimpan private key **tanpa enkripsi** di `~/.outlayer/testnet/credentials.json`, jadi login dilakukan manusia.
  - Uji langsung: `outlayer run --wasm <url> --hash <sha> '<json>' --secrets-profile taksir --secrets-account <owner>`.
- **Build reproducible:** repo OutLayer menyediakan `scripts/build_github_wasm.sh --dir <dir> --target wasm32-wasip2 --twice` (image Docker terpin). **Rekomendasi:** pakai script ini di S3 supaya juri bisa membangun ulang dan mencocokkan hash. Docker Desktop sudah terpasang.
- **WASI P2:** butuh wasmtime 28+. Error `cabi_realloc` berarti hasil build bukan komponen P2. Env var `NEAR_SENDER_ID` dan `NEAR_BLOCK_HEIGHT` tersedia.
- **Attestation:** tidak ada route API yang didokumentasikan. Dashboard `/executions` → "View Attestation" menampilkan MRTD+RTMR0-3, `wasm_hash`, `input_hash`, `output_hash`, quote TDX, dan tautan transaksi (kuncinya `transaction_hash`). **Keputusan:** halaman Verifikasi menautkan transaksi dan dashboard, dan menjelaskan 6 langkah verifikasi pihak ketiga.

## D-8 NEAR AI Cloud (diverifikasi 2026-11-10)

- **API:** base URL `https://cloud-api.near.ai/v1`, header `Authorization: Bearer <key>`.
- **List model:** docs menyebut `GET /v1/models`, sedangkan blueprint menyebut `/v1/model/list`. **Keduanya mengembalikan 200** (dicek 2026-11-10). **Keputusan:** pakai `/v1/models`.
- **Tingkat privasi model:** Confidential TEE, 3P Confidential TEE, dan Incognito (bukan TEE). **Keputusan:** hanya model "Confidential TEE".
- **Signature:** `GET /v1/signature/{chat_id}?signing_algo=ecdsa`.
  - Field respons: `text`, `signature`, `signing_address`, `signing_algo`, `signature_kind`.
  - Untuk `provider_tee`, `text` = `<MODEL_ID>:<sha256 body request>:<sha256 body response>`. Untuk `ecdsa`, verifikasi dengan recover EIP-191.
  - Syarat: kirim model ID kanonik dengan header `x-no-aliasing: true`, hash byte persis (jangan re-serialize JSON, pakai `Accept-Encoding: identity`), dan retry singkat saat 404.
  - Lama penyimpanan signature tidak didokumentasikan.
- **Dampak ke enclave (S3):** output maksimal 900 byte, tapi `r` sepanjang 140 karakter bisa mencapai 560 byte UTF-8, sementara `g` (130 hex) + `a` (42) + `h` (64) + `c` + `m` juga ikut makan tempat. **Keputusan:** `r` dipotong per karakter (maksimal 140) **dan** output total dicek ≤ 900 byte. Kalau masih melebihi, `r` dipendekkan lagi.
- **Dampak ke spike:** `consistency.mjs` mengirim header `x-no-aliasing: true`, sama seperti enclave nanti.

## D-9 Model penaksir (S1-T7, 2026-11-11)

- **Keputusan:** `Qwen/Qwen3-VL-30B-A3B-Instruct`, milik `nearai`, berstatus Confidential TEE. Harganya $0,15 per 1 juta token input dan $0,55 per 1 juta token output.
- **Bukti TEE:** `GET /v1/attestation/report?model=…` mengembalikan HTTP 200 dengan `model_attestations` berisi Intel TDX quote, `nvidia_payload`, dan signing address model `0x2665cce942fa427ef30d87f4b0bff67fb7645462` (dicek 2026-11-11).
- **Alasan:**
  - Ini satu-satunya model TEE `nearai` yang menjawab JSON dalam `max_tokens` 120.
  - `z-ai/glm-5.3-flash`, `Qwen/Qwen3.6-35B-A3B-FP8`, dan `Qwen/Qwen3.8-27B` menghabiskan seluruh token untuk reasoning, sehingga content-nya kosong.
  - Latency rata-rata 716 ms, maksimal 1381 ms, jauh di bawah batas 30 detik.
- **Catatan:** di endpoint ini, `temperature: 0` tidak deterministik. Sekitar 20% pengulangan dengan urutan yang sama menghasilkan harga berbeda. Lihat `docs/EXPERIMENT.md`.

## D-10 CHECKPOINT 1 (2026-11-11)

- **Keputusan manusia:** SIDAK dilanjutkan, tanpa jalur cadangan TEBAK HARGA dan tanpa perbaikan prompt. `threshold_bps` awal = **7500**, menggantikan default blueprint 2500.
- **Alasan:** pada 7500, data biasa tertangkap 10% (di tengah target 3–15%) dan data jahil 46,7%, sedangkan tangkapan karena noise tanpa permutasi hanya 2,2% (`docs/EXPERIMENT.md`). Nilai 8000 (data biasa 5,6%) terlalu dekat dengan batas bawah target.
- **Belum final:** nilai dikunci di S4-T2 setelah simulasi.
