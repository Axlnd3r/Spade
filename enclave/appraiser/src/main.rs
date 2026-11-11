//! The WASI layer: stdin → `flow::run` → stdout. OutLayer runs this as a
//! `wasm32-wasip2` command; the API key comes from its secrets as an env var.

#[cfg(target_os = "wasi")]
mod wasi_http {
    use appraiser::flow::{Http, HttpResponse};
    use std::time::Duration;
    use wasi_http_client::Client;

    pub struct WasiHttp;

    fn finish<E: std::fmt::Display>(res: Result<wasi_http_client::Response, E>) -> Result<HttpResponse, String> {
        let res = res.map_err(|e| e.to_string())?;
        let status = res.status();
        let body = res.body().map_err(|e| e.to_string())?;
        Ok(HttpResponse { status, body })
    }

    impl Http for WasiHttp {
        fn post(&self, url: &str, headers: &[(&str, String)], body: &[u8]) -> Result<HttpResponse, String> {
            let mut req = Client::new().post(url).connect_timeout(Duration::from_secs(10));
            for (k, v) in headers {
                req = req.header(k.to_string(), v.as_bytes().to_vec());
            }
            finish(req.body(body).send())
        }

        fn get(&self, url: &str, headers: &[(&str, String)]) -> Result<HttpResponse, String> {
            let mut req = Client::new().get(url).connect_timeout(Duration::from_secs(10));
            for (k, v) in headers {
                req = req.header(k.to_string(), v.as_bytes().to_vec());
            }
            finish(req.send())
        }

        fn sleep_ms(&self, ms: u64) {
            std::thread::sleep(Duration::from_millis(ms));
        }
    }
}

#[cfg(target_os = "wasi")]
fn main() {
    use std::io::{Read, Write};
    let mut stdin = Vec::new();
    // Read one byte past the limit so `run` can tell an oversized input apart.
    let _ = std::io::stdin().take(appraiser::flow::MAX_STDIN as u64 + 1).read_to_end(&mut stdin);
    let key = std::env::var("NEAR_AI_API_KEY").ok();
    let out = appraiser::flow::run(&stdin, key.as_deref(), &wasi_http::WasiHttp);
    let mut stdout = std::io::stdout();
    let _ = stdout.write_all(out.as_bytes());
    let _ = stdout.flush();
}

/// Native builds exist only so `cargo test` compiles; the enclave is wasm32-wasip2.
#[cfg(not(target_os = "wasi"))]
fn main() {
    println!("{}", appraiser::output::render_err("bad_input"));
}
