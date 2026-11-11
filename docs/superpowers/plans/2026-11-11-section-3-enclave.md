# Section 3 — Enclave `appraiser.wasm`: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Program WASI P2 yang menerima `{"data": "..."}` di stdin, meminta harga ke NEAR AI Cloud, lalu menulis JSON ≤ 900 byte ke stdout. Program ini berjalan di OutLayer testnet.

**Architecture:**
- Crate `enclave/appraiser` dengan dua target. `src/lib.rs` adalah logika murni yang diuji native. `src/main.rs` adalah lapisan tipis WASI.
- Modul di `lib.rs`:
  - `data` — normalisasi dan hash, identik dengan kontrak lewat `vectors.json`;
  - `request` — body request yang byte-nya identik dengan spike, sehingga hash request di signature bisa dihitung ulang;
  - `reply` — parsing jawaban model;
  - `output` — skema output dan batas 900 byte;
  - `flow` — alur lengkap di atas trait `Http`, supaya bisa diuji dengan HTTP palsu.
- `main.rs` mengimplementasikan `Http` dengan `wasi-http-client` dan hanya dikompilasi untuk `target_os = "wasi"`.

**Tech Stack:** Rust 1.95 di WSL, target `wasm32-wasip2`. Dependensi: `serde` dan `serde_json` (serialisasi), `sha2` 0.11 (hash), `wasi-http-client` 0.2.1 (hanya untuk wasi). Uji lokal dengan wasmtime 50. CLI `outlayer` dipasang di WSL.

**Spec:** `README.md` (blueprint) Section 3. Lihat juga `docs/DECISIONS.md`:
- D-2 dan D-3 (normalisasi);
- D-7 (OutLayer);
- D-8 (NEAR AI, signature, dan batas 900 byte);
- D-9 (model);
- D-12 (kontrak menerima objek JSON maupun string JSON).

Hasil probe 2026-11-11 dicatat di Task 3: `chat_id` 45 karakter, signature 132 karakter, `signature_kind` `provider_tee`, dan hash request/respons cocok dengan byte yang dikirim dan diterima.

## Global Constraints

- **Perintah Rust** dijalankan di WSL:
  `wsl -e bash -lc "cd /mnt/c/Users/User/Documents/Spade/enclave/appraiser && CARGO_TARGET_DIR=\$HOME/.cache/spade-target/appraiser cargo test"`.
- **Build:** `cargo build --target wasm32-wasip2 --release` menghasilkan `appraiser.wasm`, dengan target `[[bin]] name = "appraiser"`.
- **Konstanta permintaan** (ikut terkunci oleh hash WASM):
  - `API_BASE` = `https://cloud-api.near.ai/v1`;
  - `MODEL` = `Qwen/Qwen3-VL-30B-A3B-Instruct` (D-9);
  - `MAX_TOKENS` = 120;
  - `temperature` = bilangan bulat `0`, supaya terserialisasi sebagai `0` seperti `JSON.stringify` di spike, bukan `0.0`.
- **Header completion:** `Authorization: Bearer <key>`, `Content-Type: application/json`, `x-no-aliasing: true`, `Accept-Encoding: identity`.
- **Body completion** persis berurutan `{"model","messages":[{"role":"system","content":<prompt.txt>},{"role":"user","content":<baris digabung "\n">}],"temperature":0,"max_tokens":120}`, tanpa spasi. Baris dikirim **dalam urutan yang diterima**, tidak pernah diurutkan.
- **Skema output sukses:** `{"v":1,"h":<raw_hash hex>,"p":<1..10000>,"r":<maks 140 karakter>,"m":<MODEL>,"c":<chat_id>,"a":<signing_address>,"g":<signature>}`.
- **Skema output gagal:** `{"v":1,"err":<kode>}`, dengan kode `bad_input`, `no_lines`, `no_key`, `ai_http`, atau `ai_reply`.
- **Total stdout ≤ 900 byte** (D-8). Kalau melebihi, `r` dipendekkan per karakter sampai muat.
- **Secret dibaca dari `std::env::var("NEAR_AI_API_KEY")`.** Isinya tidak pernah muncul di stdout, stderr, log, atau commit.
- **Stdin dibatasi 65.536 byte.** Lebih dari itu menghasilkan `bad_input`.
- **Commit** diakhiri baris `Co-Authored-By` sesuai instruksi sesi. Push, rilis GitHub, dan membuat repo publik hanya dilakukan dengan izin eksplisit manusia.

## Review Focus

1. **Alasan dari model yang berat.** Emoji 4-byte, tanda kutip, atau backslash bisa membuat stdout melewati 900 byte atau menjadi JSON tidak valid. Output harus tetap JSON valid, ≤ 900 byte, dan `r` dipendekkan per karakter, bukan per byte. Test di Task 1.
2. **Jawaban model yang kotor** (code fence, teks tambahan, price berupa string, float, di luar rentang, atau tanpa price). Price di-clamp ke 1..10.000. Tanpa price sama sekali hasilnya `ai_reply`, tidak boleh panic. Test di Task 1.
3. **Stdin rusak** (bukan JSON, tanpa field `data`, `data` bukan string, hanya baris kosong, atau > 64 KB). Hasilnya JSON `err`, bukan panic, karena panic di WASM tidak menulis apa pun ke stdout. Test di Task 2.
4. **Signature belum siap** (404 sementara dari node lain). Coba ulang sampai 3 kali dengan jeda 1 detik. Kalau tetap gagal, harga tetap keluar dengan `a` dan `g` kosong, karena harga lebih penting dari bukti tambahan. Test di Task 3.
5. **Kebocoran key di jalur error.** Untuk HTTP 401/429/5xx, body error yang memantulkan header, atau key tidak ada: output tidak pernah memuat string key. Completion dicoba ulang sekali untuk 429/5xx. Test di Task 2 dengan key palsu yang khas.

---

### Task 1 (S3-T1): Crate + logika murni

**Files:**
- Create: `enclave/appraiser/Cargo.toml`, `enclave/appraiser/rust-toolchain.toml`, `enclave/appraiser/.gitignore`
- Create: `enclave/appraiser/src/lib.rs` (`mod data; mod request; mod reply; mod output;` + re-export), dan file modul `src/data.rs`, `src/request.rs`, `src/reply.rs`, `src/output.rs`
- Create: `spike/make-request-vectors.mjs` → `enclave/appraiser/vectors/request.json`

**Interfaces:**
- Consumes:
  - `enclave/appraiser/vectors/vectors.json` (bentuk sama dengan yang dipakai kontrak di S2-T1);
  - `enclave/appraiser/prompt.txt` lewat `include_str!`;
  - `spike/lib.mjs` `buildMessages`.
- Produces:
  - `data.rs`:
    - `pub fn normalize_lines(text: &str) -> Vec<String>` — D-2, sama dengan kontrak;
    - `pub fn sha256_hex(bytes: &[u8]) -> String` — hex huruf kecil;
    - `pub fn raw_hash_hex(lines: &[String]) -> String` — `sha256_hex(lines.join("\n"))`.
  - `request.rs`:
    - `pub const API_BASE`, `pub const MODEL`, `pub const MAX_TOKENS: u32 = 120`, `pub const PROMPT: &str = include_str!("../prompt.txt")`;
    - `pub fn completion_body(lines: &[String]) -> Vec<u8>` — urutan field dan format sesuai Global Constraints, dibentuk dari struct serde dengan `temperature: u32 = 0`.
  - `reply.rs`:
    - `pub struct Reply { pub price: u32, pub reason: String }`;
    - `pub fn parse_reply(content: &str) -> Option<Reply>` — port `spike/lib.mjs` `parseReply`:
      - ambil dari `{` pertama sampai `}` terakhir;
      - `price` berupa angka JSON yang finite, atau string desimal yang di-trim;
      - `f64::round`, lalu clamp ke 1..=10000;
      - `reason` dibuang karakter kontrolnya (`\u0000-\u001F`, `\u007F`) lalu dipotong ke 140 karakter.
  - `output.rs`:
    - `pub struct Priced<'a> { pub h: &'a str, pub p: u32, pub r: &'a str, pub c: &'a str, pub a: &'a str, pub g: &'a str }`;
    - `pub fn render_ok(x: &Priced) -> String` — urutan kunci `v,h,p,r,m,c,a,g`, `m = MODEL`, ≤ 900 byte;
    - `pub fn render_err(code: &str) -> String`;
    - `pub const MAX_STDOUT: usize = 900`.
  - `request.json`: array `{name, lines, body_sha256}`. `body_sha256` adalah sha256 dari `JSON.stringify({model, messages: buildMessages(prompt, lines), temperature: 0, max_tokens: 120})`, yaitu bentuk yang sama dengan body di `spike/consistency.mjs`.

- [ ] **Step 1:** Buat `spike/make-request-vectors.mjs`. Script ini membaca `prompt.txt` dan menulis `request.json` untuk kasus berikut:
  - `["a","b"]`;
  - `["b","a"]` (urutan tetap dipertahankan);
  - baris berisi `"` dan `\`;
  - baris berisi tab di tengah dan `\u0001`;
  - baris CJK + emoji;
  - dataset `normal/n01.txt` yang sudah dinormalisasi.

  Jalankan `node spike/make-request-vectors.mjs`. Hasilnya: file tertulis dengan 6 kasus.
- [ ] **Step 2:** Buat crate secara manual. Isinya:
  - `[package] name = "appraiser"`, `edition = "2024"`;
  - `[lib]` dan `[[bin]] name = "appraiser" path = "src/main.rs"`;
  - `src/main.rs` sementara berisi `fn main() {}`;
  - dependensi `serde` dengan fitur derive, `serde_json`, dan `sha2 = "0.11"`;
  - `[target.'cfg(target_os = "wasi")'.dependencies] wasi-http-client = "0.2.1"`;
  - `rust-toolchain.toml` dengan channel `1.95.0` dan targets `["wasm32-wasip2"]`;
  - `.gitignore` berisi `/target`.
- [ ] **Step 3: Tulis test yang gagal** di setiap modul:
  - **`data`:**
    - `vectors_match` — untuk tiap kasus di `vectors.json`, `normalize_lines(input) == lines`; kalau `valid`, `raw_hash_hex(lines) == raw_hash`;
    - `nbsp_and_form_feed_kept`.
  - **`request`:**
    - `request_vectors_match` — `sha256_hex(completion_body(lines)) == body_sha256` untuk semua kasus di `request.json`;
    - `order_is_kept` — body untuk `["b","a"]` memuat `"content":"b\na"`;
    - `temperature_is_integer_zero` — body memuat `"temperature":0,` dan tidak memuat `0.0`.
  - **`reply`:** semua kasus `parseReply` dari `spike/lib.test.mjs`:
    - jawaban bersih, dalam code fence, dan `Here: {…} thanks`;
    - `"300"` → 300, `3.7` → 4, `0` → 1, `20000` → 10000;
    - `"abc"` atau `null` → `None`;
    - tanpa JSON → `None`;
    - karakter kontrol dibuang, dan 150 emoji dipotong jadi 140;
    - tanpa `reason` → `""`.

    Tambahan:
    - `"0x10"` → `None` (spike menghasilkan 16; enclave hanya menerima desimal);
    - `" 42 "` → 42.
  - **`output`:**
    - `render_ok_is_valid_json_in_key_order` — `serde_json` mem-parse hasilnya, dan string diawali `{"v":1,"h":`;
    - `heavy_reason_is_cut_to_fit` (Review Focus 1) — `r` = 140 × `"😀"`, `c` = 45 karakter, `a` = 42, `g` = 132. Hasilnya ≤ 900 byte, JSON valid, dan `r` hasil parse adalah prefiks dari aslinya dengan jumlah karakter < 140;
    - `quotes_and_backslashes_escaped` — `r` = 140 × `"\\\""` (backslash + kutip). Hasilnya JSON valid dan ≤ 900 byte;
    - `light_reason_untouched` — `r` ASCII 140 karakter tetap utuh;
    - `render_err_shape` — `render_err("no_key") == "{\"v\":1,\"err\":\"no_key\"}"`.
- [ ] **Step 4:** Jalankan `cargo test`. Harus FAIL karena fungsinya belum ada.
- [ ] **Step 5:** Implementasikan modul sesuai Interfaces. `render_ok` menyusun lewat `serde_json` dengan struct berurutan. Selama hasilnya > `MAX_STDOUT`, buang satu karakter terakhir `r` lalu render ulang.
- [ ] **Step 6:** Jalankan `cargo test`. Semua PASS.
- [ ] **Step 7:** Commit `feat(enclave): pure appraiser logic shared with contract and spike vectors`.

### Task 2 (S3-T2): Alur `run`, `main.rs` WASI, build wasm

**Files:**
- Create: `enclave/appraiser/src/flow.rs`
- Modify: `enclave/appraiser/src/main.rs`, `enclave/appraiser/src/lib.rs`

**Interfaces:**
- Consumes: semua yang di-produce Task 1.
- Produces (`flow.rs`):
  - `pub struct HttpResponse { pub status: u16, pub body: Vec<u8> }`;
  - `pub trait Http { fn post(&self, url: &str, headers: &[(&str, String)], body: &[u8]) -> Result<HttpResponse, String>; fn get(&self, url: &str, headers: &[(&str, String)]) -> Result<HttpResponse, String>; fn sleep_ms(&self, ms: u64); }`;
  - `pub const MAX_STDIN: usize = 65_536`;
  - `pub fn run(stdin: &[u8], api_key: Option<&str>, http: &dyn Http) -> String`. Fungsi ini selalu mengembalikan JSON output dan tidak pernah panic. Langkahnya:
    1. Stdin > `MAX_STDIN`, atau bukan objek JSON dengan field `data` bertipe string → `bad_input`.
    2. `normalize_lines` kosong → `no_lines`.
    3. Key `None` atau kosong → `no_key`.
    4. POST ke `API_BASE + "/chat/completions"` dengan header dan body dari Global Constraints. Untuk 429/5xx atau error transport: `sleep_ms(1000)` lalu coba sekali lagi. Kalau masih bukan 2xx → `ai_http`.
    5. Body respons harus JSON yang memuat `choices[0].message.content` (string) dan `id` (string). Kalau tidak, atau `parse_reply` mengembalikan `None` → `ai_reply`.
    6. `render_ok` dengan `h = raw_hash_hex(lines)`, `c = id`, dan `a = g = ""`. Bagian signature ditambahkan di Task 3.
- Produces (`main.rs`, hanya untuk wasi):
  - `struct WasiHttp` yang mengimplementasikan `Http` dengan `wasi_http_client::Client` (`connect_timeout` 10 detik) dan `std::thread::sleep`;
  - `fn main()`: baca seluruh stdin, panggil `run(&stdin, env::var("NEAR_AI_API_KEY").ok().as_deref(), &WasiHttp)`, tulis ke stdout, lalu `flush()`;
  - di luar wasi, `main` cukup mencetak `render_err("bad_input")`, supaya `cargo test` native tetap ter-build.

- [ ] **Step 1: Tulis test yang gagal** di `flow.rs`. Pakai `FakeHttp` yang menyimpan antrean respons dan semua request yang diterimanya. Key palsu: `"sk-SECRET-XYZ"`.
  - `bad_input_cases` (Review Focus 3): `b"not json"`, `b"{}"`, `{"data":5}`, dan stdin 65.537 byte → `bad_input`. `{"data":"\n \n"}` → `no_lines`. Tidak ada HTTP yang dipanggil.
  - `no_key`: key `None` atau `Some("")` → `no_key`.
  - `success_shape`:
    - respons 200 berisi `{"id":"chatcmpl-1","choices":[{"message":{"content":"{\"price\": 300, \"reason\": \"ok\"}"}}]}`;
    - output ter-parse dengan `p == 300`, `h == raw_hash_hex(lines)`, `c == "chatcmpl-1"`, `m == MODEL`;
    - request yang tercatat ditujukan ke `.../chat/completions`;
    - header `Authorization` = `Bearer sk-SECRET-XYZ`, `x-no-aliasing` = `true`, `Accept-Encoding` = `identity`;
    - body sama dengan `completion_body(lines)`.
  - `retries_once_on_5xx`: antrean 503 lalu 200 → sukses, dengan 2 POST dan satu `sleep_ms(1000)`. Antrean 503, 503 → `ai_http`.
  - `no_retry_on_401`: 401 → `ai_http` dengan 1 POST.
  - `bad_completion_body`: body bukan JSON, tanpa `choices`, atau content `"I cannot"` → `ai_reply`.
  - `key_never_leaks` (Review Focus 5): untuk setiap kasus di atas, termasuk respons error yang body-nya berisi `sk-SECRET-XYZ`, output tidak memuat `SECRET`.
- [ ] **Step 2:** Jalankan `cargo test flow`. Harus FAIL.
- [ ] **Step 3:** Implementasikan `flow.rs` dan `main.rs` sesuai Interfaces.
- [ ] **Step 4:** Jalankan `cargo test`. Semua PASS.
- [ ] **Step 5:** Jalankan `cargo build --target wasm32-wasip2 --release`. Hasilnya `appraiser.wasm` ter-build. Catat ukurannya.
- [ ] **Step 6:** Uji lokal dengan key asli. Key dibaca dari `.env` tanpa dicetak, dan `\r` dibuang:
  ```bash
  export NEAR_AI_API_KEY=$(grep '^NEAR_AI_API_KEY=' ../../.env | cut -d= -f2- | tr -d '\r')
  printf '{"data":"espresso 3\\nlatte 4\\nmocha 5\\ntea 2\\nwater 1"}' \
    | wasmtime run -S http --env NEAR_AI_API_KEY target/wasm32-wasip2/release/appraiser.wasm
  ```
  Hasil yang diharapkan:
  - satu baris JSON dengan `p` di rentang 1..10000 dan `h` sama dengan `raw_hash` dari kelima baris;
  - waktu tempuh < 30 detik;
  - jumlah byte ≤ 900.

  Lalu jalankan ulang tanpa `--env`. Hasilnya harus `{"v":1,"err":"no_key"}`.
- [ ] **Step 7:** Commit `feat(enclave): stdin-to-stdout flow over wasi-http`.

### Task 3 (S3-T3): Signature (`c`, `a`, `g`)

**Files:**
- Modify: `enclave/appraiser/src/flow.rs`

**Interfaces:**
- Consumes: `Http`, `run` (Task 2).
- Produces: `run` sekarang mengisi `a` dan `g`. Setelah completion sukses, fungsi ini memanggil `GET API_BASE/signature/{id}?model=<MODEL url-encoded, "/" → "%2F">&signing_algo=ecdsa` dengan header `Authorization`.
  - 200 + JSON berisi `signing_address` dan `signature` (string) → isi `a` dan `g`.
  - 404, status lain, atau error transport → `sleep_ms(1000)` lalu coba lagi, maksimal 3 percobaan.
  - Setelah 3 kali gagal → `a = g = ""`, dan output tetap sukses.

- [ ] **Step 1: Tulis test yang gagal**:
  - `signature_filled`:
    - completion 200, lalu signature 200 `{"text":"…","signature":"0xabc","signing_address":"0xdef","signing_algo":"ecdsa","signature_kind":"provider_tee"}`;
    - output `a == "0xdef"`, `g == "0xabc"`;
    - URL GET tepat `https://cloud-api.near.ai/v1/signature/chatcmpl-1?model=Qwen%2FQwen3-VL-30B-A3B-Instruct&signing_algo=ecdsa`.
  - `signature_retries_404` (Review Focus 4): 404, 404, 200 → terisi, dengan 3 GET dan 2 `sleep_ms(1000)`.
  - `signature_gives_up_after_3`: 404 × 3 → `p` tetap ada, `a == ""`, `g == ""`, dan tidak ada GET keempat.
  - `signature_bad_json_counts_as_failure`: 200 dengan body `"x"` → dicoba ulang.
  - `real_sizes_fit` — output dengan `c` 45 karakter, `a` 42, `g` 132, dan `r` 140 karakter ASCII tetap ≤ 900 byte **tanpa** pemotongan. Ini ukuran dari probe 2026-11-11.
- [ ] **Step 2:** Jalankan `cargo test flow`. Harus FAIL.
- [ ] **Step 3:** Implementasikan sesuai Interfaces.
- [ ] **Step 4:** Jalankan `cargo test`. Semua PASS. Build ulang wasm, lalu ulangi uji lokal Task 2 Step 6. Kali ini `a` harus `0x2665cce942fa427ef30d87f4b0bff67fb7645462`, alamat dari D-9, dan `g` harus diawali `0x` dengan panjang 132.
- [ ] **Step 5:** Commit `feat(enclave): attach NEAR AI response signature`.

### Task 4 (S3-R): Review sebelum hash dikunci

- [ ] **Step 1:** Jalankan `cargo test` dan `cargo clippy --all-targets -- -D warnings` untuk native, serta `cargo clippy --target wasm32-wasip2 -- -D warnings`. Semua bersih.
- [ ] **Step 2:** Lakukan review menyeluruh oleh reviewer baru, dengan fokus:
  - Review Focus di atas;
  - kesamaan normalisasi dengan kontrak;
  - kebocoran secret;
  - batas 900 byte.

  Perbaiki temuan Critical dan Important dengan TDD. Hash WASM baru dibuat setelah langkah ini, karena setiap perubahan kode mengubah hash dan memaksa secret dibuat ulang.

### Task 5 (S3-T4): Rilis + OutLayer testnet → CHECKPOINT 3 (👤)

**Files:**
- Create: `docs/TESTNET.md`
- Modify: `docs/DECISIONS.md` (D-13), `docs/WORKLOG.md`

- [ ] **Step 1: Build reproducible.** Coba skrip OutLayer `scripts/build_github_wasm.sh --dir enclave/appraiser --target wasm32-wasip2 --twice` (D-7), dengan meng-clone repo `out-layer` ke `/tmp`, bukan lewat installer pipe. Kalau Docker atau skrip itu gagal, pakai build biasa. Apa pun jalurnya, catat di `docs/TESTNET.md`:
  - jalur yang dipakai;
  - versi `rustc`;
  - `sha256sum appraiser.wasm`;
  - ukuran file.
- [ ] **Step 2: 👤 Keputusan manusia.** URL wasm harus bisa diambil OutLayer tanpa login, sedangkan repo `Axlnd3r/Spade` masih privat. Tanyakan pilihannya:
  - (a) buat repo publik sekarang (H-1 tetap mewajibkan ini sebelum tenggat), lalu `gh release create enclave-v1 appraiser.wasm`;
  - (b) repo publik terpisah khusus rilis.

  Jangan push atau rilis sebelum ada jawaban.
- [ ] **Step 3:** Pasang CLI dengan `cargo +stable install --locked outlayer-cli` di WSL. Lalu siapkan perintah untuk dijalankan **manusia**, karena login menyimpan private key tanpa enkripsi dan secret berisi API key:
  - `outlayer login testnet`;
  - `outlayer secrets set '{"NEAR_AI_API_KEY":"…"}' --wasm-hash <sha> --profile taksir --access whitelist:<akun-testnet-manusia> --direct`.

  Akses di sini sementara untuk uji S3. Di S4, secret dibuat ulang dengan akses whitelist akun kontrak (D-7).
- [ ] **Step 4:** Uji lewat CLI: `outlayer run --wasm <url> --hash <sha> '{"data":"espresso 3\nlatte 4\nmocha 5\ntea 2\nwater 1"}' --secrets-profile taksir --secrets-account <owner>`. Hasilnya: JSON sesuai skema dalam < 60 detik.
- [ ] **Step 5:** Kirim satu `request_execution` on-chain ke `outlayer.testnet` dari akun manusia. Argumennya sama dengan yang dibentuk kontrak (`outlayer::request_args`, D-7), dan deposit diambil dari view `estimate_execution_cost`. Catat di `docs/TESTNET.md`:
  - hash transaksi;
  - waktu eksekusi;
  - biaya NEAR riil dan refund-nya;
  - **bentuk byte persis** nilai yang dikembalikan ke pemanggil (objek JSON, string JSON, atau bentuk lain);
  - perilaku `payer_account_id`.
- [ ] **Step 6:** Tulis D-13 berisi bentuk riil hasil OutLayer dan dampaknya ke `parse_output` di kontrak. Kalau bentuknya bukan objek JSON atau string JSON, tambahkan test RED→GREEN di kontrak di S4-T1, bukan di sini. Commit `docs: enclave release and first testnet execution`.
- [ ] **Step 7: CHECKPOINT 3. Berhenti.** Laporkan ke manusia: hash WASM, URL, hash transaksi uji, waktu eksekusi, biaya NEAR per panggilan, bentuk hasil OutLayer, dan hasil review. Tunggu jawaban sebelum S4.
