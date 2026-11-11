//! The chat completion request. Its bytes must equal the spike's
//! (vectors/request.json): the NEAR AI signature covers sha256 of the request
//! body, so a verifier recomputes it from the prompt, the model and the data.

use serde::Serialize;

pub const API_BASE: &str = "https://cloud-api.near.ai/v1";
/// D-9. A constant, so the model is locked by the WASM hash.
pub const MODEL: &str = "Qwen/Qwen3-VL-30B-A3B-Instruct";
pub const MAX_TOKENS: u32 = 120;
pub const PROMPT: &str = include_str!("../prompt.txt");

#[derive(Serialize)]
struct Message<'a> {
    role: &'a str,
    content: &'a str,
}

/// Field order matters: it fixes the bytes (and so the signed hash).
#[derive(Serialize)]
struct Body<'a> {
    model: &'a str,
    messages: [Message<'a>; 2],
    /// An integer so it serializes as `0`, like the spike's `JSON.stringify`.
    temperature: u32,
    max_tokens: u32,
}

/// The data goes in exactly as received; the enclave never sorts lines.
pub fn completion_body(lines: &[String]) -> Vec<u8> {
    let data = lines.join("\n");
    serde_json::to_vec(&Body {
        model: MODEL,
        messages: [Message { role: "system", content: PROMPT }, Message { role: "user", content: &data }],
        temperature: 0,
        max_tokens: MAX_TOKENS,
    })
    .expect("serializing plain strings cannot fail")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::data::sha256_hex;
    use serde_json::Value;

    #[test]
    fn request_vectors_match() {
        let cases: Vec<Value> = serde_json::from_str(include_str!("../vectors/request.json")).unwrap();
        assert!(!cases.is_empty());
        for c in cases {
            let lines: Vec<String> = serde_json::from_value(c["lines"].clone()).unwrap();
            assert_eq!(
                sha256_hex(&completion_body(&lines)),
                c["body_sha256"].as_str().unwrap(),
                "{}",
                c["name"]
            );
        }
    }

    #[test]
    fn order_is_kept() {
        let body = String::from_utf8(completion_body(&["b".to_string(), "a".to_string()])).unwrap();
        assert!(body.contains(r#""content":"b\na""#), "{body}");
    }

    #[test]
    fn temperature_is_integer_zero() {
        let body = String::from_utf8(completion_body(&["x".to_string()])).unwrap();
        assert!(body.contains(r#""temperature":0,"max_tokens":120}"#), "{body}");
        assert!(!body.contains("0.0"));
        assert!(body.starts_with(r#"{"model":"Qwen/Qwen3-VL-30B-A3B-Instruct","messages":[{"role":"system","content":"#));
    }
}
