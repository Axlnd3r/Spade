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

## D-11 Harness test sandbox kontrak (S2-T1, 2026-11-11)

- **Konteks:** Blueprint menyebut `near-workspaces` untuk test integrasi. Template resmi `cargo near new` (cargo-near 0.23, near-sdk 5.30.1) memakai `near-sandbox` 0.4 + `near-api` 0.8 + `cargo-near-build`, dan skill `near-smart-contracts` juga memakai pasangan itu.
- **Keputusan:** test sandbox `contracts/taksir/tests/` memakai `near-sandbox` + `near-api`, mengikuti template.
- **Alasan:** Mengikuti template mengurangi konfigurasi buatan tangan. Perilaku yang diuji (13 skenario Section 2) tidak berubah.

## D-12 Pelengkap dan penyimpangan kontrak terhadap bagian 2.3 (S2-T5, 2026-11-11)

- **Konteks:** Blueprint diam atau tidak lengkap di beberapa titik yang menyangkut uang. Masing-masing diputuskan di plan Section 2 dan dikunci dengan test.
- **Keputusan:**
  1. **Status sidak `Voided`.** Hasil sidak yang masuk setelah taksirannya sudah `Caught` oleh sidak lain: stake dikembalikan, tanpa hadiah, dan tidak dihitung ke epoch. Enum blueprint tidak punya status untuk kasus ini (M-11).
  2. **`LogKind::Mint`.** Satu entri saat `new`, supaya log memuat setiap mint dan burn (T-5).
  3. **Satu entri `BurnEpoch` per pemanggilan**, dengan rentang `epoch_from..epoch_to`. Tanpa ini, 1.000 epoch yang terlewat berarti 1.000 entri log dan gas habis (M-14).
  4. **`storage_unregister` selalu panic `unregister_disabled`.** Refund atau hadiah ke akun yang sudah tidak terdaftar akan panic di callback, sehingga escrow tertahan selamanya (I-5).
  5. **`ft_transfer` dan `ft_transfer_call` ke akun kontrak ditolak** (`transfer_to_contract`). Token yang masuk dengan cara itu berada di luar kas, faucet, dan escrow, sehingga I-2 tidak lagi berlaku.
  6. **Parameter tambahan `exec_deposit` dan `storage_fee`.** Pemanggil `appraise` dan `challenge` wajib melampirkan minimal `exec_deposit + storage_fee` NEAR dan 170 TGas.
     - `exec_deposit` diteruskan ke OutLayer.
     - `storage_fee` adalah biaya storage tetap yang tidak dikembalikan.
     - Kelebihan deposit dikembalikan.
     - Nilai riil keduanya ditetapkan di S4 dari `estimate_execution_cost`.
  7. **Sidak `Failed` melepas slot `max_challenges`**, sesuai M-12 "tidak ada yang berubah". Sidak `Pending`, `Caught`, `Survived`, dan `Voided` tetap memakai slot.
  8. **Hadiah nol tidak dicatat sebagai entri `Reward`.** Penantang yang benar saat budget habis hanya menerima stake kembali.
  9. **Sidak dihitung ke epoch hanya jika `Caught` atau `Survived`.** `Failed` dan `Voided` tidak memengaruhi streak (M-15).
  10. **`faucet` membayar penyimpanannya sendiri.** Pemanggil membayar setiap byte yang ditulis panggilan itu: registrasi akun, catatan klaim, dan entri log. Lampirkan 0,01 NEAR; kelebihannya dikembalikan. Tanpa ini, klaim dari akun sybil menguras NEAR kontrak sampai callback gagal karena storage staking, dan escrow tertahan selamanya (temuan review S2).
  11. **`new` bersifat `#[private]`.** Hanya akun kontrak sendiri yang bisa menginisialisasi, supaya deploy dan init yang terkirim terpisah tidak bisa didahului pihak lain dengan `outlayer_id` miliknya sendiri. Skrip deploy S4 memanggil `new` dari akun kontrak.
  12. **Parameter bernilai nol ditolak (`bad_params`).** Aturan ini berlaku untuk `appraisal_fee`, `challenge_stake`, `faucet_amount`, `exec_deposit`, `challenge_window_ms`, dan `reward_multiplier`. Parameter tidak bisa diubah setelah `new`, jadi nilai nol akan membuat alurnya macet atau tak bermakna selamanya (S4 Task 1).
  13. **`response_hash` disimpan di setiap taksiran dan sidak.** Isinya diambil dari field `s` enclave (D-13), yaitu sha256 body respons NEAR AI. Dengan begitu, siapa pun bisa memeriksa signature `g` atas `MODEL:sha256(request):response_hash` tanpa bergantung pada log OutLayer. Kalau `s` tidak ada, isinya `""`. Storage terburuk diukur sandbox s15: taksiran 3.177 byte (0,0318 NEAR) dan sidak 2.598 byte, semuanya di bawah `storage_fee` 0,05 NEAR.
- **Alasan:** Setiap butir menutup jalur yang membuat token hilang, tertahan, atau tidak tercatat, tanpa mengubah aturan M yang tertulis.

## D-13 Enclave: client HTTP, batas waktu, dan bukti signature (S3 review, 2026-11-11)

- **Konteks:** Review S3 menemukan tiga masalah.
  1. `wasi-http-client` 0.2.1 menulis seluruh body dalam satu `blocking-write-and-flush`. Batas wasmtime untuk satu panggilan itu 4.096 byte, dan kelebihannya membuat trap. Data sah 1.999 byte (100 baris `"1","2","3","4","5"`) terbukti membuat run berakhir dengan exit 1 tanpa stdout.
  2. Tidak ada read timeout maupun batas waktu total, padahal OutLayer menghentikan run pada 60 detik.
  3. `g` tidak bisa diverifikasi dari luar, karena hash respons (bagian ketiga teks yang ditandatangani, D-8) tidak ikut keluar.
- **Keputusan:**
  1. **Client sendiri di atas crate `wasi` 0.13** (`src/wasi_http.rs`):
     - urutannya: request dimulai (`handle`), body ditulis per potongan 4.096 byte, lalu `finish`;
     - header `content-length` dikirim;
     - timeout connect 10 detik, first-byte dan between-bytes mengikuti timeout per panggilan;
     - body respons dibatasi 1 MB;
     - header respons yang bukan UTF-8 tidak lagi menggagalkan respons.

     Dicek di level wasm oleh `enclave/appraiser/scripts/wasm-http-check.sh` (100 byte sampai 70 KB).
  2. **Anggaran 50 detik per run:**
     - completion 25 detik;
     - retry completion hanya kalau masih bisa dimulai sebelum detik ke-20;
     - signature maksimal 5 detik per percobaan, dipotong ke sisa anggaran;
     - percobaan signature baru tidak dimulai kalau sisa waktu kurang dari 1 detik.
  3. **Kunci output tambahan `s` = sha256 body respons AI.** Enclave hanya mengisi `a` dan `g` kalau `text` signature persis `MODEL:sha256(body request):s`. Dengan begitu, siapa pun bisa memverifikasi dari luar: hitung ulang hash request dari `prompt.txt` dan data, ambil `s` dari output, lalu recover EIP-191 terhadap `a`. `parse_output` di kontrak mengabaikan kunci yang tidak dikenal (test `parse_output_ignores_extra_keys`). Apakah `s` disimpan on-chain diputuskan di S4.
- **Alasan:**
  - Keputusan 1 dan 2 mencegah run yang mati tanpa output.
  - Keputusan 3 memenuhi tujuan blueprint: field `c`, `a`, `g` ada "supaya bisa diverifikasi di luar".

## D-14 Bentuk hasil OutLayer dan deposit eksekusi (S3-T4, 2026-11-11)

- **Konteks:** D-7 mencatat bahwa bentuk hasil `request_execution` belum didokumentasikan. Kontrak dibuat menerima objek JSON maupun string JSON.
- **Temuan** (transaksi `HxcCsWyo…`, `docs/TESTNET.md`): dengan `response_format: "Text"`, nilai kembalian adalah string JSON yang memuat stdout enclave apa adanya.
- **Keputusan:**
  - Kontrak tetap memakai `Text`, sehingga urutan kunci dan byte stdout tidak diubah OutLayer. `parse_output` tidak perlu diubah.
  - Nilai awal `exec_deposit` di S4: **0,0071 NEAR**, yaitu estimasi 0,007001 NEAR ditambah margin. Sisanya dikembalikan OutLayer ke `payer_account_id`.
- **Alasan:** bentuk Text sudah diuji di unit test kontrak dan dibuktikan on-chain.

## D-15 Parameter final testnet (S4-T2, 2026-11-11; direvisi setelah review S4; menunggu CHECKPOINT 4)
- **Sumber angka:** `docs/sim/summary.md` (`python sim/simulate.py`), model nilai harapan 60 hari. Tingkat tertangkapnya diambil dari `docs/EXPERIMENT.md`.
- **Temuan simulasi (setelah review S4):**
  - **Penyerang pasti.** Rata-rata data jahil tertangkap 46,7%, tetapi itu rata-rata. Data yang urutannya menentukan harga (kelas a02, a04–a06) tertangkap 3/3. Penyerang juga melihat harga taksiran sebelum memasang stake, sehingga ia cukup menyidak data yang injeksinya berhasil. Penyerang seperti ini tertangkap hampir 100%. Untung bersih per data = `multiplier × stake − appraisal_fee`.
  - **Dua batas farming.** Batas pertama adalah budget per epoch: penyerang tidak bisa mengambil lebih dari budget. Batas kedua adalah fee: kalau `appraisal_fee ≥ multiplier × stake`, farming tidak pernah untung, bahkan bagi penyerang pasti.
  - **Penantang jujur tersingkir.** Selama farming untung, penyerang menghabiskan budget lebih dulu, sehingga tangkapan jujur di epoch itu tidak mendapat hadiah.
  - **Kas tidak berubah.** Kas turun satu budget per epoch, dengan atau tanpa penyerang. Farming hanya mengalihkan budget dari dibakar menjadi dibayarkan ke penyerang.
- **Dua opsi** (sama di semua parameter kecuali fee; ambang 7500 (D-10), budget 5 ppm per epoch, multiplier 2, stake 25):

| | **A: fee 10** (v1 yang sudah aktif) | **B: fee 50** (rekomendasi) |
|---|---|---|
| Untung penyerang pasti per hari, testnet (epoch 10 menit) | 33.824 TAKSIR, biaya ~86 NEAR | **0**: farming tidak pernah untung |
| Untung penyerang pasti per hari, epoch 24 jam | 240 TAKSIR | **0** |
| Hadiah penantang jujur saat ada farming | 0% | **100%** |
| Biaya satu taksiran | 10 TAKSIR (faucet 500 = 50 taksiran) | 50 TAKSIR (faucet 500 = 10 taksiran), semuanya dibakar |
| Siapa yang membuat data jebakan | Penyerang yang memanen hadiah sendiri | Hanya orang iseng. Jebakannya menjadi umpan yang dibayar pembuatnya dan dipanen penyidak lain |
| Perlu deploy ulang | Tidak | Ya, `bash scripts/deploy.sh 2` lalu secret di-whitelist ulang untuk `v2` |

- **Rekomendasi: B.**
  - Narasi "Rug the AI, not the holders" tetap utuh. Yang dibayar adalah orang yang menangkap jebakan orang lain, bukan orang yang memanen jebakannya sendiri.
  - Setiap taksiran membakar 5× lebih banyak token.
  - Biayanya: lebih sedikit taksiran per akun dari faucet.
- **Nilai parameter lain:**

| Parameter | Nilai | Alasan |
|---|---|---|
| `threshold_bps` | 7500 | D-10 (keputusan manusia). |
| `budget_ppm` | 5 per epoch | Nilai terkecil di grid yang tetap membayar penuh hadiah penantang jujur pada skenario normal. Pada opsi A, ini juga batas utama farming. Kas testnet tersisa 57,46 jt setelah 60 hari (epoch 10 menit). |
| `reward_multiplier` | 2 | Titik impas naik menjadi 33,3%. Data biasa (10,0%) tetap jauh di bawahnya, sehingga menyidak asal-asalan merugi. |
| `challenge_stake` | 25 TAKSIR | Hadiah tangkapan 50 TAKSIR. Pada opsi B, nilai ini sama dengan fee. |
| `max_challenges` | 3 | Blueprint. |
| `faucet_amount` | 500 TAKSIR | Blueprint. |
| `epoch_ms` | 600.000 (10 menit) | Blueprint 2.4 untuk testnet. Arah mainnet adalah 86.400.000. |
| `challenge_window_ms` | 3.600.000 (1 jam) | Blueprint. |
| `min_rows` / `max_rows` / `max_data_bytes` | 5 / 100 / 2.000 | Blueprint. Gas terburuk sudah diuji di s14 dan storage di s15. |
| `price_min` / `price_max` | 1 / 10.000 | Sama dengan clamp di enclave. |
| `exec_deposit` | 0,0071 NEAR | D-14. |
| `storage_fee` | 0,05 NEAR | s15: taksiran terburuk 3.177 byte (0,0318 NEAR), sidak terburuk 2.598 byte. |
| `outlayer_id`, `wasm_url`, `wasm_hash`, `secrets_profile`, `secrets_owner` | `outlayer.testnet`, rilis `enclave-v1`, `0206187e…8ee2`, `taksir`, `spade-taksir.testnet` | S3 dan `docs/TESTNET.md`. |

- **Status:**
  - `v1.spade-taksir.testnet` berjalan dengan opsi A.
  - Parameter baru dianggap terkunci setelah manusia memilih A atau B di CHECKPOINT 4.
  - Kalau B dipilih, `scripts/params.testnet.json` diubah ke `appraisal_fee` = 50 TAKSIR, lalu deploy ke `v2`.
