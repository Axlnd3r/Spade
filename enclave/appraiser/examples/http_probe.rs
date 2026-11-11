//! Wasm-level check of `WasiHttp` (run by scripts/wasm-http-check.sh): POST a
//! body of `size` bytes to `url`, then GET it, and print what came back.
//! Usage: wasmtime run -S http http_probe.wasm <url> <size>

#[cfg(target_os = "wasi")]
fn main() {
    use appraiser::flow::Http;
    let args: Vec<String> = std::env::args().collect();
    let (url, size): (&str, usize) = (&args[1], args[2].parse().unwrap());
    let http = appraiser::wasi_http::WasiHttp;
    let body = vec![b'x'; size];
    match http.post(url, &[("Content-Type", "text/plain".to_string())], &body, 5_000) {
        Ok(r) => println!("post status={} body={}", r.status, String::from_utf8_lossy(&r.body)),
        Err(e) => println!("post error={e}"),
    }
    match http.get(url, &[], 5_000) {
        Ok(r) => println!("get status={} body={}", r.status, String::from_utf8_lossy(&r.body)),
        Err(e) => println!("get error={e}"),
    }
}

#[cfg(not(target_os = "wasi"))]
fn main() {}
