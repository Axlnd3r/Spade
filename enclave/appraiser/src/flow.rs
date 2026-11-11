//! stdin → NEAR AI Cloud → stdout, over an `Http` trait so the whole flow is
//! tested natively. Always returns one JSON line and never panics: a panic in
//! the enclave writes nothing and OutLayer reports a bare failure.

use crate::data::{normalize_lines, raw_hash_hex};
use crate::output::{render_err, render_ok, Priced};
use crate::reply::parse_reply;
use crate::request::{completion_body, API_BASE};
use serde_json::Value;

pub struct HttpResponse {
    pub status: u16,
    pub body: Vec<u8>,
}

pub trait Http {
    fn post(&self, url: &str, headers: &[(&str, String)], body: &[u8]) -> Result<HttpResponse, String>;
    fn get(&self, url: &str, headers: &[(&str, String)]) -> Result<HttpResponse, String>;
    fn sleep_ms(&self, ms: u64);
}

/// Real input is `{"data": "<= 2000 bytes"}`; anything far larger is not from the contract.
pub const MAX_STDIN: usize = 65_536;
const RETRY_DELAY_MS: u64 = 1000;

fn retryable(r: &Result<HttpResponse, String>) -> bool {
    match r {
        Ok(res) => res.status == 429 || res.status >= 500,
        Err(_) => true,
    }
}

const SIGNATURE_TRIES: usize = 3;

/// `(signing_address, signature)` for `chat_id`, or empty strings. The
/// signature is cached on the node that served the completion, so another node
/// can answer 404 for a moment; retry, and give up quietly: the price matters
/// more than the extra proof.
fn fetch_signature(http: &dyn Http, key: &str, chat_id: &str) -> (String, String) {
    let model = crate::request::MODEL.replace('/', "%2F");
    let url = format!("{API_BASE}/signature/{chat_id}?model={model}&signing_algo=ecdsa");
    let headers = [("Authorization", format!("Bearer {key}"))];
    for attempt in 0..SIGNATURE_TRIES {
        if attempt > 0 {
            http.sleep_ms(RETRY_DELAY_MS);
        }
        let Ok(res) = http.get(&url, &headers) else { continue };
        if res.status != 200 {
            continue;
        }
        let Ok(v) = serde_json::from_slice::<Value>(&res.body) else { continue };
        if let (Some(a), Some(g)) = (v["signing_address"].as_str(), v["signature"].as_str()) {
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
    let url = format!("{API_BASE}/chat/completions");
    let body = completion_body(&lines);
    let mut res = http.post(&url, &headers, &body);
    if retryable(&res) {
        http.sleep_ms(RETRY_DELAY_MS);
        res = http.post(&url, &headers, &body);
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
    let (a, g) = fetch_signature(http, key, &chat_id);
    let h = raw_hash_hex(&lines);
    render_ok(&Priced { h: &h, p: reply.price, r: &reason, c: &chat_id, a: &a, g: &g })
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use crate::data::{normalize_lines, raw_hash_hex};
    use crate::request::{completion_body, MODEL};
    use serde_json::{json, Value};
    use std::cell::RefCell;
    use std::collections::VecDeque;

    pub const KEY: &str = "sk-SECRET-XYZ";

    #[derive(Debug, Clone)]
    pub struct Sent {
        pub method: &'static str,
        pub url: String,
        pub headers: Vec<(String, String)>,
        pub body: Vec<u8>,
    }

    #[derive(Default)]
    pub struct FakeHttp {
        pub posts: RefCell<VecDeque<Result<HttpResponse, String>>>,
        pub gets: RefCell<VecDeque<Result<HttpResponse, String>>>,
        pub sent: RefCell<Vec<Sent>>,
        pub sleeps: RefCell<Vec<u64>>,
    }

    impl FakeHttp {
        pub fn post_reply(&self, status: u16, body: &str) -> &Self {
            self.posts.borrow_mut().push_back(Ok(HttpResponse { status, body: body.as_bytes().to_vec() }));
            self
        }
        pub fn get_reply(&self, status: u16, body: &str) -> &Self {
            self.gets.borrow_mut().push_back(Ok(HttpResponse { status, body: body.as_bytes().to_vec() }));
            self
        }
        pub fn posts_sent(&self) -> usize {
            self.sent.borrow().iter().filter(|s| s.method == "POST").count()
        }
        pub fn gets_sent(&self) -> usize {
            self.sent.borrow().iter().filter(|s| s.method == "GET").count()
        }
        fn record(&self, method: &'static str, url: &str, headers: &[(&str, String)], body: &[u8]) {
            let headers = headers.iter().map(|(k, v)| (k.to_string(), v.clone())).collect();
            self.sent.borrow_mut().push(Sent { method, url: url.to_string(), headers, body: body.to_vec() });
        }
    }

    impl Http for FakeHttp {
        fn post(&self, url: &str, headers: &[(&str, String)], body: &[u8]) -> Result<HttpResponse, String> {
            self.record("POST", url, headers, body);
            self.posts.borrow_mut().pop_front().unwrap_or_else(|| Err("no scripted POST".to_string()))
        }
        fn get(&self, url: &str, headers: &[(&str, String)]) -> Result<HttpResponse, String> {
            self.record("GET", url, headers, &[]);
            self.gets.borrow_mut().pop_front().unwrap_or_else(|| Err("no scripted GET".to_string()))
        }
        fn sleep_ms(&self, ms: u64) {
            self.sleeps.borrow_mut().push(ms);
        }
    }

    pub const DATA: &str = "espresso 3\nlatte 4\nmocha 5\ntea 2\nwater 1";

    pub fn stdin() -> Vec<u8> {
        json!({ "data": DATA }).to_string().into_bytes()
    }

    pub fn completion(content: &str) -> String {
        json!({ "id": "chatcmpl-1", "choices": [{ "message": { "role": "assistant", "content": content } }] }).to_string()
    }

    pub fn out(s: &str) -> Value {
        assert!(!s.contains("SECRET"), "key leaked: {s}");
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
        http.post_reply(200, &completion(r#"{"price": 300, "reason": "ok"}"#));
        let v = out(&run(&stdin(), Some(KEY), &http));
        let lines = normalize_lines(DATA);
        assert_eq!((v["p"].as_u64(), v["r"].as_str()), (Some(300), Some("ok")));
        assert_eq!(v["h"].as_str().unwrap(), raw_hash_hex(&lines));
        assert_eq!((v["c"].as_str(), v["m"].as_str()), (Some("chatcmpl-1"), Some(MODEL)));
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
        http.post_reply(503, "busy").post_reply(200, &completion(r#"{"price": 9}"#));
        http.get_reply(200, SIGNATURE);
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
        http.posts.borrow_mut().push_back(Err("connection reset".to_string()));
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

    pub const SIGNATURE: &str = r#"{"text":"m:a:b","signature":"0xabc","signing_address":"0xdef","signing_algo":"ecdsa","signature_kind":"provider_tee"}"#;

    fn priced_http() -> FakeHttp {
        let http = FakeHttp::default();
        http.post_reply(200, &completion(r#"{"price": 300, "reason": "ok"}"#));
        http
    }

    #[test]
    fn signature_filled() {
        let http = priced_http();
        http.get_reply(200, SIGNATURE);
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
    fn signature_retries_404() {
        let http = priced_http();
        http.get_reply(404, "Chat id not found or expired").get_reply(404, "nope").get_reply(200, SIGNATURE);
        let v = out(&run(&stdin(), Some(KEY), &http));
        assert_eq!(v["g"].as_str(), Some("0xabc"));
        assert_eq!((http.gets_sent(), http.sleeps.borrow().clone()), (3, vec![1000, 1000]));
    }

    #[test]
    fn signature_gives_up_after_3() {
        let http = priced_http();
        http.get_reply(404, "x").get_reply(500, "x").get_reply(404, "x").get_reply(200, SIGNATURE);
        let v = out(&run(&stdin(), Some(KEY), &http));
        assert_eq!((v["p"].as_u64(), v["a"].as_str(), v["g"].as_str()), (Some(300), Some(""), Some("")));
        assert_eq!(http.gets_sent(), 3);
    }

    #[test]
    fn signature_bad_json_counts_as_failure() {
        let http = priced_http();
        http.get_reply(200, "x").get_reply(200, r#"{"signature":"0xabc"}"#).get_reply(200, SIGNATURE);
        assert_eq!(out(&run(&stdin(), Some(KEY), &http))["a"].as_str(), Some("0xdef"));
        assert_eq!(http.gets_sent(), 3);
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
