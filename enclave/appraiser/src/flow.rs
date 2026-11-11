//! stdin → NEAR AI Cloud → stdout, over an `Http` trait so the whole flow is
//! tested natively. Always returns one JSON line and never panics: a panic in
//! the enclave writes nothing and OutLayer reports a bare failure.

use crate::data::{normalize_lines, raw_hash_hex, sha256_hex};
use crate::output::{render_err, render_ok, Priced};
use crate::reply::parse_reply;
use crate::request::{completion_body, API_BASE, MODEL};
use serde_json::Value;

pub struct HttpResponse {
    pub status: u16,
    pub body: Vec<u8>,
}

pub trait Http {
    /// `timeout_ms` bounds the whole exchange, so a stalled server cannot outlive the budget.
    fn post(&self, url: &str, headers: &[(&str, String)], body: &[u8], timeout_ms: u64) -> Result<HttpResponse, String>;
    fn get(&self, url: &str, headers: &[(&str, String)], timeout_ms: u64) -> Result<HttpResponse, String>;
    fn sleep_ms(&self, ms: u64);
    /// A monotonic clock in milliseconds; only differences are used.
    fn now_ms(&self) -> u64;
}

/// Real input is `{"data": "<= 2000 bytes"}`; anything far larger is not from the contract.
pub const MAX_STDIN: usize = 65_536;
const RETRY_DELAY_MS: u64 = 1000;

/// OutLayer stops the run at 60 s and then nothing is written, so all network
/// work fits in this budget with room to spare.
pub const BUDGET_MS: u64 = 50_000;
pub const COMPLETION_TIMEOUT_MS: u64 = 25_000;
/// A failed completion is retried only if the retry still starts before this.
const RETRY_BEFORE_MS: u64 = 20_000;
pub const SIGNATURE_TIMEOUT_MS: u64 = 5_000;
/// No signature request is started with less than this left.
const MIN_REQUEST_MS: u64 = 1_000;
const SIGNATURE_TRIES: usize = 3;

fn retryable(r: &Result<HttpResponse, String>) -> bool {
    match r {
        Ok(res) => res.status == 429 || res.status >= 500,
        Err(_) => true,
    }
}

/// `(signing_address, signature)` for `chat_id`, or empty strings.
///
/// Kept only when the signed text is `MODEL:sha256(request):sha256(response)`
/// for the exact bytes this run sent and received (D-8), so it proves this
/// price. The signature is cached on the node that served the completion,
/// so another node can answer 404 for a moment: retry within the budget, then
/// give up quietly; the price matters more than the extra proof.
fn fetch_signature(http: &dyn Http, key: &str, chat_id: &str, expected_text: &str, deadline: u64) -> (String, String) {
    let model = MODEL.replace('/', "%2F");
    let url = format!("{API_BASE}/signature/{chat_id}?model={model}&signing_algo=ecdsa");
    let headers = [("Authorization", format!("Bearer {key}"))];
    let left = || deadline.saturating_sub(http.now_ms());
    for attempt in 0..SIGNATURE_TRIES {
        if attempt > 0 {
            if left() < RETRY_DELAY_MS + MIN_REQUEST_MS {
                break;
            }
            http.sleep_ms(RETRY_DELAY_MS);
        }
        if left() < MIN_REQUEST_MS {
            break;
        }
        let Ok(res) = http.get(&url, &headers, SIGNATURE_TIMEOUT_MS.min(left())) else { continue };
        if res.status != 200 {
            continue;
        }
        let Ok(v) = serde_json::from_slice::<Value>(&res.body) else { continue };
        if let (Some(text), Some(a), Some(g)) =
            (v["text"].as_str(), v["signing_address"].as_str(), v["signature"].as_str())
        {
            if text != expected_text {
                break;
            }
            return (a.to_string(), g.to_string());
        }
    }
    (String::new(), String::new())
}

/// `(content, chat_id)` from a chat completion response body.
fn read_completion(body: &[u8]) -> Option<(String, String)> {
    let v: Value = serde_json::from_slice(body).ok()?;
    let content = v["choices"][0]["message"]["content"].as_str()?.to_string();
    let id = v["id"].as_str()?.to_string();
    Some((content, id))
}

pub fn run(stdin: &[u8], api_key: Option<&str>, http: &dyn Http) -> String {
    if stdin.len() > MAX_STDIN {
        return render_err("bad_input");
    }
    let Some(data) = serde_json::from_slice::<Value>(stdin).ok().and_then(|v| v["data"].as_str().map(str::to_string))
    else {
        return render_err("bad_input");
    };
    let lines = normalize_lines(&data);
    if lines.is_empty() {
        return render_err("no_lines");
    }
    let Some(key) = api_key.filter(|k| !k.is_empty()) else {
        return render_err("no_key");
    };

    let headers = [
        ("Authorization", format!("Bearer {key}")),
        ("Content-Type", "application/json".to_string()),
        ("x-no-aliasing", "true".to_string()),
        ("Accept-Encoding", "identity".to_string()),
    ];
    let start = http.now_ms();
    let deadline = start + BUDGET_MS;
    let url = format!("{API_BASE}/chat/completions");
    let body = completion_body(&lines);
    let mut res = http.post(&url, &headers, &body, COMPLETION_TIMEOUT_MS);
    if retryable(&res) && http.now_ms() + RETRY_DELAY_MS < start + RETRY_BEFORE_MS {
        http.sleep_ms(RETRY_DELAY_MS);
        let left = deadline.saturating_sub(http.now_ms());
        res = http.post(&url, &headers, &body, COMPLETION_TIMEOUT_MS.min(left));
    }
    let res = match res {
        Ok(r) if (200..300).contains(&r.status) => r,
        _ => return render_err("ai_http"),
    };
    let Some((content, chat_id)) = read_completion(&res.body) else {
        return render_err("ai_reply");
    };
    let Some(reply) = parse_reply(&content) else {
        return render_err("ai_reply");
    };
    // The model never sees the key, but never echo it even if it shows up.
    let reason = reply.reason.replace(key, "");
    let s = sha256_hex(&res.body);
    let expected_text = format!("{MODEL}:{}:{s}", sha256_hex(&body));
    let (a, g) = fetch_signature(http, key, &chat_id, &expected_text, deadline);
    let h = raw_hash_hex(&lines);
    render_ok(&Priced { h: &h, p: reply.price, r: &reason, c: &chat_id, a: &a, g: &g, s: &s })
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use crate::data::{normalize_lines, raw_hash_hex, sha256_hex};
    use crate::request::{completion_body, MODEL};
    use serde_json::{json, Value};
    use std::cell::{Cell, RefCell};
    use std::collections::VecDeque;

    pub const KEY: &str = "sk-SECRET-XYZ";

    #[derive(Debug, Clone)]
    pub struct Sent {
        pub method: &'static str,
        pub url: String,
        pub headers: Vec<(String, String)>,
        pub body: Vec<u8>,
        pub timeout_ms: u64,
        pub at_ms: u64,
    }

    type Scripted = (u64, Result<HttpResponse, String>);

    /// Scripted replies, each taking `latency` ms on a fake clock. A reply
    /// slower than the call's timeout becomes a "timeout" error at the timeout.
    #[derive(Default)]
    pub struct FakeHttp {
        pub posts: RefCell<VecDeque<Scripted>>,
        pub gets: RefCell<VecDeque<Scripted>>,
        pub sent: RefCell<Vec<Sent>>,
        pub sleeps: RefCell<Vec<u64>>,
        pub now: Cell<u64>,
    }

    fn reply(status: u16, body: &str) -> Result<HttpResponse, String> {
        Ok(HttpResponse { status, body: body.as_bytes().to_vec() })
    }

    impl FakeHttp {
        pub fn post_reply(&self, status: u16, body: &str) -> &Self {
            self.post_after(0, status, body)
        }
        pub fn post_after(&self, latency_ms: u64, status: u16, body: &str) -> &Self {
            self.posts.borrow_mut().push_back((latency_ms, reply(status, body)));
            self
        }
        pub fn get_reply(&self, status: u16, body: &str) -> &Self {
            self.get_after(0, status, body)
        }
        pub fn get_after(&self, latency_ms: u64, status: u16, body: &str) -> &Self {
            self.gets.borrow_mut().push_back((latency_ms, reply(status, body)));
            self
        }
        pub fn posts_sent(&self) -> usize {
            self.sent.borrow().iter().filter(|s| s.method == "POST").count()
        }
        pub fn gets_sent(&self) -> usize {
            self.sent.borrow().iter().filter(|s| s.method == "GET").count()
        }
        fn answer(&self, method: &'static str, url: &str, headers: &[(&str, String)], body: &[u8], timeout_ms: u64) -> Result<HttpResponse, String> {
            let headers = headers.iter().map(|(k, v)| (k.to_string(), v.clone())).collect();
            let at_ms = self.now.get();
            self.sent.borrow_mut().push(Sent { method, url: url.to_string(), headers, body: body.to_vec(), timeout_ms, at_ms });
            let queue = if method == "POST" { &self.posts } else { &self.gets };
            let (latency, result) = queue.borrow_mut().pop_front().unwrap_or((0, Err(format!("no scripted {method}"))));
            self.now.set(at_ms + latency.min(timeout_ms));
            if latency > timeout_ms { Err("timeout".to_string()) } else { result }
        }
    }

    impl Http for FakeHttp {
        fn post(&self, url: &str, headers: &[(&str, String)], body: &[u8], timeout_ms: u64) -> Result<HttpResponse, String> {
            self.answer("POST", url, headers, body, timeout_ms)
        }
        fn get(&self, url: &str, headers: &[(&str, String)], timeout_ms: u64) -> Result<HttpResponse, String> {
            self.answer("GET", url, headers, &[], timeout_ms)
        }
        fn sleep_ms(&self, ms: u64) {
            self.sleeps.borrow_mut().push(ms);
            self.now.set(self.now.get() + ms);
        }
        fn now_ms(&self) -> u64 {
            self.now.get()
        }
    }

    pub const DATA: &str = "espresso 3\nlatte 4\nmocha 5\ntea 2\nwater 1";
    const PRICED: &str = r#"{"price": 300, "reason": "ok"}"#;

    pub fn stdin() -> Vec<u8> {
        json!({ "data": DATA }).to_string().into_bytes()
    }

    pub fn completion(content: &str) -> String {
        json!({ "id": "chatcmpl-1", "choices": [{ "message": { "role": "assistant", "content": content } }] }).to_string()
    }

    /// A signature whose `text` binds this request (DATA) and `response` (D-8).
    pub fn signature_for(response: &str) -> String {
        let req = sha256_hex(&completion_body(&normalize_lines(DATA)));
        let text = format!("{MODEL}:{req}:{}", sha256_hex(response.as_bytes()));
        json!({ "text": text, "signature": "0xabc", "signing_address": "0xdef", "signing_algo": "ecdsa", "signature_kind": "provider_tee" }).to_string()
    }

    pub fn out(s: &str) -> Value {
        assert!(!s.contains("SECRET"), "key leaked: {s}");
        assert!(s.len() <= crate::output::MAX_STDOUT, "{} bytes", s.len());
        serde_json::from_str(s).unwrap_or_else(|e| panic!("invalid JSON ({e}): {s}"))
    }

    fn err_of(stdin: &[u8], key: Option<&str>, http: &FakeHttp) -> String {
        out(&run(stdin, key, http))["err"].as_str().unwrap_or("<none>").to_string()
    }

    #[test]
    fn bad_input_cases() {
        let http = FakeHttp::default();
        for bad in [b"not json".to_vec(), b"{}".to_vec(), br#"{"data":5}"#.to_vec(), vec![b' '; MAX_STDIN + 1]] {
            assert_eq!(err_of(&bad, Some(KEY), &http), "bad_input", "{}", String::from_utf8_lossy(&bad[..bad.len().min(20)]));
        }
        assert_eq!(err_of(br#"{"data":"\n \n"}"#, Some(KEY), &http), "no_lines");
        assert_eq!(http.sent.borrow().len(), 0);
    }

    #[test]
    fn no_key() {
        let http = FakeHttp::default();
        assert_eq!(err_of(&stdin(), None, &http), "no_key");
        assert_eq!(err_of(&stdin(), Some(""), &http), "no_key");
        assert_eq!(http.sent.borrow().len(), 0);
    }

    #[test]
    fn success_shape() {
        let http = FakeHttp::default();
        let response = completion(PRICED);
        http.post_reply(200, &response);
        let v = out(&run(&stdin(), Some(KEY), &http));
        let lines = normalize_lines(DATA);
        assert_eq!((v["p"].as_u64(), v["r"].as_str()), (Some(300), Some("ok")));
        assert_eq!(v["h"].as_str().unwrap(), raw_hash_hex(&lines));
        assert_eq!((v["c"].as_str(), v["m"].as_str()), (Some("chatcmpl-1"), Some(MODEL)));
        assert_eq!(v["s"].as_str().unwrap(), sha256_hex(response.as_bytes()), "s = sha256 of the response body");
        let sent = http.sent.borrow();
        let post = sent.iter().find(|s| s.method == "POST").unwrap();
        assert_eq!(post.url, "https://cloud-api.near.ai/v1/chat/completions");
        let header = |k: &str| post.headers.iter().find(|(n, _)| n.eq_ignore_ascii_case(k)).map(|(_, v)| v.as_str());
        assert_eq!(header("Authorization"), Some("Bearer sk-SECRET-XYZ"));
        assert_eq!(header("Content-Type"), Some("application/json"));
        assert_eq!(header("x-no-aliasing"), Some("true"));
        assert_eq!(header("Accept-Encoding"), Some("identity"));
        assert_eq!(post.body, completion_body(&lines));
    }

    #[test]
    fn retries_once_on_5xx() {
        let http = FakeHttp::default();
        let response = completion(r#"{"price": 9}"#);
        http.post_reply(503, "busy").post_reply(200, &response);
        http.get_reply(200, &signature_for(&response));
        assert_eq!(out(&run(&stdin(), Some(KEY), &http))["p"].as_u64(), Some(9));
        assert_eq!((http.posts_sent(), http.sleeps.borrow().clone()), (2, vec![1000]));

        let http = FakeHttp::default();
        http.post_reply(503, "busy").post_reply(429, "slow down");
        assert_eq!(err_of(&stdin(), Some(KEY), &http), "ai_http");
        assert_eq!(http.posts_sent(), 2);
    }

    #[test]
    fn retries_once_on_transport_error() {
        let http = FakeHttp::default();
        http.posts.borrow_mut().push_back((0, Err("connection reset".to_string())));
        http.post_reply(200, &completion(r#"{"price": 9}"#));
        assert_eq!(out(&run(&stdin(), Some(KEY), &http))["p"].as_u64(), Some(9));
    }

    #[test]
    fn no_retry_on_401() {
        let http = FakeHttp::default();
        http.post_reply(401, r#"{"error":"bad key sk-SECRET-XYZ"}"#);
        assert_eq!(err_of(&stdin(), Some(KEY), &http), "ai_http");
        assert_eq!(http.posts_sent(), 1);
    }

    #[test]
    fn bad_completion_body() {
        for body in ["not json".to_string(), json!({ "id": "x" }).to_string(), completion("I cannot"), json!({ "choices": [{ "message": { "content": "{\"price\":1}" } }] }).to_string()] {
            let http = FakeHttp::default();
            http.post_reply(200, &body);
            assert_eq!(err_of(&stdin(), Some(KEY), &http), "ai_reply", "{body}");
        }
    }

    fn priced_http() -> (FakeHttp, String) {
        let http = FakeHttp::default();
        let response = completion(PRICED);
        http.post_reply(200, &response);
        (http, response)
    }

    #[test]
    fn signature_filled() {
        let (http, response) = priced_http();
        http.get_reply(200, &signature_for(&response));
        let v = out(&run(&stdin(), Some(KEY), &http));
        assert_eq!((v["a"].as_str(), v["g"].as_str(), v["p"].as_u64()), (Some("0xdef"), Some("0xabc"), Some(300)));
        let sent = http.sent.borrow();
        let get = sent.iter().find(|s| s.method == "GET").unwrap();
        assert_eq!(
            get.url,
            "https://cloud-api.near.ai/v1/signature/chatcmpl-1?model=Qwen%2FQwen3-VL-30B-A3B-Instruct&signing_algo=ecdsa"
        );
        assert!(get.headers.iter().any(|(k, v)| k == "Authorization" && v == "Bearer sk-SECRET-XYZ"));
    }

    #[test]
    fn signature_over_other_bytes_is_dropped() {
        // Review S3 Important-3: a signature that does not bind this exact
        // request and response proves nothing about this price.
        for other in [signature_for("some other response"), signature_for(&completion(PRICED)).replace(MODEL, "other/model")] {
            let (http, _) = priced_http();
            http.get_reply(200, &other);
            let v = out(&run(&stdin(), Some(KEY), &http));
            assert_eq!((v["p"].as_u64(), v["a"].as_str(), v["g"].as_str()), (Some(300), Some(""), Some("")));
            assert_eq!(http.gets_sent(), 1, "a mismatch is final, not retried");
        }
    }

    #[test]
    fn signature_retries_404() {
        let (http, response) = priced_http();
        http.get_reply(404, "Chat id not found or expired").get_reply(404, "nope").get_reply(200, &signature_for(&response));
        let v = out(&run(&stdin(), Some(KEY), &http));
        assert_eq!(v["g"].as_str(), Some("0xabc"));
        assert_eq!((http.gets_sent(), http.sleeps.borrow().clone()), (3, vec![1000, 1000]));
    }

    #[test]
    fn signature_gives_up_after_3() {
        let (http, response) = priced_http();
        http.get_reply(404, "x").get_reply(500, "x").get_reply(404, "x").get_reply(200, &signature_for(&response));
        let v = out(&run(&stdin(), Some(KEY), &http));
        assert_eq!((v["p"].as_u64(), v["a"].as_str(), v["g"].as_str()), (Some(300), Some(""), Some("")));
        assert_eq!(http.gets_sent(), 3);
    }

    #[test]
    fn signature_bad_json_counts_as_failure() {
        let (http, response) = priced_http();
        http.get_reply(200, "x").get_reply(200, r#"{"signature":"0xabc"}"#).get_reply(200, &signature_for(&response));
        assert_eq!(out(&run(&stdin(), Some(KEY), &http))["a"].as_str(), Some("0xdef"));
        assert_eq!(http.gets_sent(), 3);
    }

    // Review S3 Important-2: OutLayer kills the run at 60 s and then nothing
    // is written, so the enclave keeps its own 50 s budget.

    #[test]
    fn completion_timeouts_fit_the_budget() {
        let http = FakeHttp::default();
        http.post_after(60_000, 200, "never").post_after(60_000, 200, "never");
        assert_eq!(err_of(&stdin(), Some(KEY), &http), "ai_http");
        let sent = http.sent.borrow();
        assert_eq!(sent[0].timeout_ms, COMPLETION_TIMEOUT_MS);
        assert!(http.now_ms() <= BUDGET_MS, "spent {} ms", http.now_ms());
    }

    #[test]
    fn slow_failure_is_not_retried() {
        let http = FakeHttp::default();
        http.post_after(21_000, 503, "busy").post_reply(200, &completion(PRICED));
        assert_eq!(err_of(&stdin(), Some(KEY), &http), "ai_http");
        assert_eq!(http.posts_sent(), 1);
    }

    /// The slowest path that still prices: a quick failure, the retry, then a
    /// completion that uses its whole timeout. The signature gets what is left.
    #[test]
    fn signature_waits_are_clamped_to_the_budget() {
        let http = FakeHttp::default();
        let response = completion(PRICED);
        http.post_after(18_500, 503, "busy").post_after(COMPLETION_TIMEOUT_MS, 200, &response);
        for _ in 0..3 {
            http.get_after(60_000, 200, "never");
        }
        let v = out(&run(&stdin(), Some(KEY), &http));
        assert_eq!((v["p"].as_u64(), v["a"].as_str()), (Some(300), Some("")), "the price is kept");
        assert_eq!(http.posts_sent(), 2);
        assert!(http.now_ms() <= BUDGET_MS, "spent {} ms", http.now_ms());
        let sent = http.sent.borrow();
        for get in sent.iter().filter(|s| s.method == "GET") {
            assert!(get.timeout_ms <= SIGNATURE_TIMEOUT_MS && get.at_ms + get.timeout_ms <= BUDGET_MS, "{get:?}");
        }
    }

    #[test]
    fn key_never_leaks_even_when_echoed() {
        let http = FakeHttp::default();
        http.post_reply(500, "echo: Bearer sk-SECRET-XYZ").post_reply(500, "echo: Bearer sk-SECRET-XYZ");
        let s = run(&stdin(), Some(KEY), &http);
        out(&s);
        let http = FakeHttp::default();
        http.post_reply(200, &completion(r#"{"price": 5, "reason": "sk-SECRET-XYZ"}"#));
        let s = run(&stdin(), Some(KEY), &http);
        assert!(!s.contains("SECRET"), "a reason echoing the key must be scrubbed: {s}");
    }
}
