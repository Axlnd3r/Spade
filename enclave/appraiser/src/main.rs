//! The WASI layer: stdin → `flow::run` → stdout. OutLayer runs this as a
//! `wasm32-wasip2` command; the API key comes from its secrets as an env var.

#[cfg(target_os = "wasi")]
fn main() {
    use std::io::{Read, Write};
    let mut stdin = Vec::new();
    // Read one byte past the limit so `run` can tell an oversized input apart.
    let _ = std::io::stdin().take(appraiser::flow::MAX_STDIN as u64 + 1).read_to_end(&mut stdin);
    let key = std::env::var("NEAR_AI_API_KEY").ok();
    let out = appraiser::flow::run(&stdin, key.as_deref(), &appraiser::wasi_http::WasiHttp);
    let mut stdout = std::io::stdout();
    let _ = stdout.write_all(out.as_bytes());
    let _ = stdout.flush();
}

/// Native builds exist only so `cargo test` compiles; the enclave is wasm32-wasip2.
#[cfg(not(target_os = "wasi"))]
fn main() {
    println!("{}", appraiser::output::render_err("bad_input"));
}
