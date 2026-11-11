//! OutLayer `request_execution` arguments (D-7) and enclave output checks
//! (blueprint Section 2, "Validasi hasil enclave di callback").

use crate::Params;
use near_sdk::serde_json::{self, json, Value};
use near_sdk::AccountId;

/// A successful, validated enclave reply. `r`, `m`, `c`, `a`, `g` may be absent
/// in early enclave builds (blueprint Section 3) and then default to "".
#[derive(Debug, PartialEq)]
pub struct EnclaveOk {
    pub h: String,
    pub p: u32,
    pub r: String,
    pub m: String,
    pub c: String,
    pub a: String,
    pub g: String,
}

/// M-10: appraisals and challenges send the enclave exactly this shape.
pub fn input_data(normalized: &str) -> String {
    json!({ "data": normalized }).to_string()
}

pub fn request_args(p: &Params, input_data: &str, payer: &AccountId) -> Vec<u8> {
    serde_json::to_vec(&json!({
        "source": { "WasmUrl": { "url": p.wasm_url, "hash": p.wasm_hash, "build_target": "wasm32-wasip2" } },
        "resource_limits": { "max_instructions": 10_000_000_000u64, "max_memory_mb": 128, "max_execution_seconds": 60 },
        "input_data": input_data,
        "secrets_ref": { "profile": p.secrets_profile, "account_id": p.secrets_owner },
        "response_format": "Text",
        "payer_account_id": payer,
    }))
    .unwrap()
}

/// D-7: the success payload shape is not documented, so both a JSON object and
/// a JSON string holding that object are accepted. Anything else is `None`.
pub fn parse_output(bytes: &[u8], expected_h: &str, price_min: u32, price_max: u32) -> Option<EnclaveOk> {
    let mut v: Value = serde_json::from_slice(bytes).ok()?;
    if let Value::String(inner) = &v {
        v = serde_json::from_str(inner).ok()?;
    }
    let o = v.as_object()?;
    if o.contains_key("err") || o.get("v")?.as_u64()? != 1 {
        return None;
    }
    let h = o.get("h")?.as_str()?;
    let p = o.get("p")?.as_u64()?;
    if h != expected_h || p < price_min as u64 || p > price_max as u64 {
        return None;
    }
    let field = |k: &str| o.get(k).and_then(Value::as_str).unwrap_or_default().to_string();
    Some(EnclaveOk { h: h.to_string(), p: p as u32, r: field("r"), m: field("m"), c: field("c"), a: field("a"), g: field("g") })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tests::{test_params, user};
    use near_sdk::serde_json::{self, json, Value};

    fn h() -> String {
        "ab".repeat(32)
    }

    fn good() -> Value {
        json!({"v":1,"h":h(),"p":300,"r":"ok","m":"model","c":"chat","a":"0xabc","g":"sig"})
    }

    #[test]
    fn parse_output_accepts_object_and_wrapped_string() {
        let raw = serde_json::to_vec(&good()).unwrap();
        let ok = parse_output(&raw, &h(), 1, 10_000).unwrap();
        assert_eq!((ok.p, ok.r.as_str(), ok.c.as_str(), ok.g.as_str()), (300, "ok", "chat", "sig"));
        let wrapped = serde_json::to_vec(&Value::String(good().to_string())).unwrap();
        assert_eq!(parse_output(&wrapped, &h(), 1, 10_000), Some(ok));
    }

    /// The enclave also emits `s` (sha256 of the AI response, D-13); unknown keys are ignored.
    #[test]
    fn parse_output_ignores_extra_keys() {
        let mut v = good();
        v["s"] = json!("cd".repeat(32));
        v["future"] = json!({"x": 1});
        let ok = parse_output(&serde_json::to_vec(&v).unwrap(), &h(), 1, 10_000).unwrap();
        assert_eq!(ok.p, 300);
    }

    #[test]
    fn parse_output_optional_fields_default_empty() {
        let raw = serde_json::to_vec(&json!({"v":1,"h":h(),"p":7})).unwrap();
        let ok = parse_output(&raw, &h(), 1, 10_000).unwrap();
        assert_eq!((ok.p, ok.r.as_str(), ok.m.as_str()), (7, "", ""));
    }

    #[test]
    fn parse_output_rejects_bad_results() {
        let mut bad: Vec<Vec<u8>> = vec![b"".to_vec(), b"not json".to_vec(), b"[1,2]".to_vec()];
        for v in [
            json!({"v":1,"err":"x"}),
            json!({"v":1,"h":h(),"p":300,"err":"x"}),
            json!({"v":1,"h":"cd".repeat(32),"p":300}),
            json!({"v":1,"h":h(),"p":0}),
            json!({"v":1,"h":h(),"p":10_001}),
            json!({"v":1,"h":h(),"p":3.5}),
            json!({"v":1,"h":h(),"p":"300"}),
            json!({"v":2,"h":h(),"p":300}),
            json!({"h":h(),"p":300}),
        ] {
            bad.push(serde_json::to_vec(&v).unwrap());
        }
        for b in bad {
            assert_eq!(parse_output(&b, &h(), 1, 10_000), None, "{}", String::from_utf8_lossy(&b));
        }
    }

    #[test]
    fn input_data_shape() {
        assert_eq!(input_data("a\nb\"c"), "{\"data\":\"a\\nb\\\"c\"}");
    }

    #[test]
    fn request_args_shape() {
        let p = test_params();
        let payer = user("alice");
        let v: Value = serde_json::from_slice(&request_args(&p, "{\"data\":\"x\"}", &payer)).unwrap();
        assert_eq!(v["source"]["WasmUrl"]["url"], p.wasm_url);
        assert_eq!(v["source"]["WasmUrl"]["hash"], p.wasm_hash);
        assert_eq!(v["source"]["WasmUrl"]["build_target"], "wasm32-wasip2");
        assert_eq!(v["resource_limits"]["max_instructions"], 10_000_000_000u64);
        assert_eq!(v["resource_limits"]["max_memory_mb"], 128);
        assert_eq!(v["resource_limits"]["max_execution_seconds"], 60);
        assert_eq!(v["input_data"], "{\"data\":\"x\"}");
        assert!(v["input_data"].is_string());
        assert_eq!(v["secrets_ref"]["profile"], "taksir");
        assert_eq!(v["secrets_ref"]["account_id"], p.secrets_owner.as_str());
        assert_eq!(v["response_format"], "Text");
        assert_eq!(v["payer_account_id"], "alice.testnet");
    }
}
