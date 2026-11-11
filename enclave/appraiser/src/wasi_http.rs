//! `Http` over wasi:http, used by `main.rs` and by `examples/http_probe.rs`
//! (the wasm-level check in scripts/wasm-http-check.sh).
//!
//! Written on the `wasi` bindings directly: wasi-http-client 0.2.1 writes the
//! whole body in one `blocking-write-and-flush`, which wasmtime caps at 4096
//! bytes and answers with a trap (review S3, Critical-1). It also has no
//! first-byte or between-bytes timeout, and fails on a non-UTF-8 header.

use crate::flow::{Http, HttpResponse};
use std::time::{Duration, Instant};
use wasi::http::outgoing_handler;
use wasi::http::types::{Fields, Method, OutgoingBody, OutgoingRequest, RequestOptions, Scheme};
use wasi::io::streams::StreamError;

pub struct WasiHttp;

/// wasmtime's limit for one `blocking-write-and-flush`.
const WRITE_CHUNK: usize = 4096;
const CONNECT_TIMEOUT_MS: u64 = 10_000;
const MAX_RESPONSE_BYTES: usize = 1 << 20;

fn ns(ms: u64) -> u64 {
    ms.saturating_mul(1_000_000)
}

/// `(scheme, authority, path_with_query)` of an absolute http(s) URL.
fn split_url(url: &str) -> Result<(Scheme, &str, &str), String> {
    let (scheme, rest) = if let Some(r) = url.strip_prefix("https://") {
        (Scheme::Https, r)
    } else if let Some(r) = url.strip_prefix("http://") {
        (Scheme::Http, r)
    } else {
        return Err("unsupported url".to_string());
    };
    let slash = rest.find('/').unwrap_or(rest.len());
    let path = if slash == rest.len() { "/" } else { &rest[slash..] };
    Ok((scheme, &rest[..slash], path))
}

fn send(method: Method, url: &str, headers: &[(&str, String)], body: &[u8], timeout_ms: u64) -> Result<HttpResponse, String> {
    let started = Instant::now();
    let (scheme, authority, path) = split_url(url)?;

    let mut entries: Vec<(String, Vec<u8>)> =
        headers.iter().map(|(k, v)| (k.to_ascii_lowercase(), v.as_bytes().to_vec())).collect();
    if !body.is_empty() {
        entries.push(("content-length".to_string(), body.len().to_string().into_bytes()));
    }
    let fields = Fields::from_list(&entries).map_err(|e| format!("headers: {e:?}"))?;

    let req = OutgoingRequest::new(fields);
    req.set_method(&method).map_err(|()| "method")?;
    req.set_scheme(Some(&scheme)).map_err(|()| "scheme")?;
    req.set_authority(Some(authority)).map_err(|()| "authority")?;
    req.set_path_with_query(Some(path)).map_err(|()| "path")?;
    let outgoing = req.body().map_err(|()| "body")?;

    let options = RequestOptions::new();
    options.set_connect_timeout(Some(ns(CONNECT_TIMEOUT_MS.min(timeout_ms)))).map_err(|()| "connect timeout")?;
    options.set_first_byte_timeout(Some(ns(timeout_ms))).map_err(|()| "first byte timeout")?;
    options.set_between_bytes_timeout(Some(ns(timeout_ms))).map_err(|()| "between bytes timeout")?;

    // Start the request first, then stream the body into it in host-sized chunks.
    let future = outgoing_handler::handle(req, Some(options)).map_err(|e| format!("{e:?}"))?;
    {
        let stream = outgoing.write().map_err(|()| "body stream")?;
        for chunk in body.chunks(WRITE_CHUNK) {
            stream.blocking_write_and_flush(chunk).map_err(|e| format!("write: {e:?}"))?;
        }
    }
    OutgoingBody::finish(outgoing, None).map_err(|e| format!("finish: {e:?}"))?;

    let response = loop {
        match future.get() {
            Some(r) => break r.map_err(|()| "response taken")?.map_err(|e| format!("{e:?}"))?,
            None => future.subscribe().block(),
        }
    };
    let status = response.status();
    let incoming = response.consume().map_err(|()| "consume")?;
    let mut out = Vec::new();
    {
        let stream = incoming.stream().map_err(|()| "response stream")?;
        loop {
            if started.elapsed() > Duration::from_millis(timeout_ms) {
                return Err("timeout".to_string());
            }
            match stream.blocking_read(64 * 1024) {
                Ok(chunk) => out.extend_from_slice(&chunk),
                Err(StreamError::Closed) => break,
                Err(e) => return Err(format!("read: {e:?}")),
            }
            if out.len() > MAX_RESPONSE_BYTES {
                return Err("response too large".to_string());
            }
        }
    }
    Ok(HttpResponse { status, body: out })
}

impl Http for WasiHttp {
    fn post(&self, url: &str, headers: &[(&str, String)], body: &[u8], timeout_ms: u64) -> Result<HttpResponse, String> {
        send(Method::Post, url, headers, body, timeout_ms)
    }

    fn get(&self, url: &str, headers: &[(&str, String)], timeout_ms: u64) -> Result<HttpResponse, String> {
        send(Method::Get, url, headers, &[], timeout_ms)
    }

    fn sleep_ms(&self, ms: u64) {
        std::thread::sleep(Duration::from_millis(ms));
    }

    fn now_ms(&self) -> u64 {
        // Monotonic clock in nanoseconds since an arbitrary point.
        wasi::clocks::monotonic_clock::now() / 1_000_000
    }
}
