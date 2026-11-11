//! The stdout the contract reads (blueprint Section 3 output schema), at most
//! `MAX_STDOUT` bytes (OutLayer's limit, D-8).

use crate::request::MODEL;
use serde::Serialize;

pub const MAX_STDOUT: usize = 900;

pub struct Priced<'a> {
    /// `raw_hash` of the lines the enclave received.
    pub h: &'a str,
    pub p: u32,
    pub r: &'a str,
    /// NEAR AI chat id, signing address and signature, for outside verification.
    pub c: &'a str,
    pub a: &'a str,
    pub g: &'a str,
    /// sha256 of the completion response body: the third part of the signed
    /// text, which a verifier cannot rebuild from the data (review S3, D-13).
    pub s: &'a str,
}

#[derive(Serialize)]
struct Ok<'a> {
    v: u8,
    h: &'a str,
    p: u32,
    r: &'a str,
    m: &'a str,
    c: &'a str,
    a: &'a str,
    g: &'a str,
    s: &'a str,
}

#[derive(Serialize)]
struct Err<'a> {
    v: u8,
    err: &'a str,
}

/// Keys in schema order. If the result is over `MAX_STDOUT`, `r` loses
/// characters from its end until it fits (D-8).
pub fn render_ok(x: &Priced) -> String {
    let mut r = x.r;
    loop {
        let out = serde_json::to_string(&Ok { v: 1, h: x.h, p: x.p, r, m: MODEL, c: x.c, a: x.a, g: x.g, s: x.s })
            .expect("serializing plain strings cannot fail");
        if out.len() <= MAX_STDOUT || r.is_empty() {
            return out;
        }
        let cut = r.char_indices().last().map_or(0, |(i, _)| i);
        r = &r[..cut];
    }
}

pub fn render_err(code: &str) -> String {
    serde_json::to_string(&Err { v: 1, err: code }).expect("serializing plain strings cannot fail")
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    fn priced<'a>(r: &'a str, c: &'a str, a: &'a str, g: &'a str) -> Priced<'a> {
        Priced { h: H, p: 10_000, r, c, a, g, s: S }
    }

    const H: &str = "42064da518ab63d9fbf594e39f6147ee429d6c1637b0855b4894f7a6d68d2df1";
    const S: &str = "00422104fb7dec2b179b81a6682d76554201f39efbba47bfed4646b1beacd873";

    fn parsed(s: &str) -> Value {
        serde_json::from_str(s).unwrap_or_else(|e| panic!("invalid JSON ({e}): {s}"))
    }

    #[test]
    fn render_ok_is_valid_json_in_key_order() {
        let s = render_ok(&priced("ok", "chatcmpl-1", "0xa", "0xg"));
        assert!(s.starts_with(r#"{"v":1,"h":""#), "{s}");
        let v = parsed(&s);
        assert_eq!((v["p"].as_u64(), v["r"].as_str(), v["m"].as_str()), (Some(10_000), Some("ok"), Some(crate::request::MODEL)));
        assert_eq!((v["c"].as_str(), v["a"].as_str(), v["g"].as_str()), (Some("chatcmpl-1"), Some("0xa"), Some("0xg")));
        assert_eq!(v.as_object().unwrap().len(), 9);
        let at: Vec<usize> = ["v", "h", "p", "r", "m", "c", "a", "g", "s"]
            .iter()
            .map(|k| s.find(&format!("\"{k}\":")).unwrap())
            .collect();
        assert!(at.windows(2).all(|w| w[0] < w[1]), "keys out of schema order: {s}");
        assert_eq!(v["s"].as_str(), Some(S));
    }

    #[test]
    fn heavy_reason_is_cut_to_fit() {
        let r = "😀".repeat(140);
        let (c, a, g) = ("c".repeat(45), format!("0x{}", "a".repeat(40)), format!("0x{}", "b".repeat(130)));
        let s = render_ok(&priced(&r, &c, &a, &g));
        assert!(s.len() <= MAX_STDOUT, "{} bytes", s.len());
        let got = parsed(&s)["r"].as_str().unwrap().to_string();
        assert!(r.starts_with(&got) && got.chars().count() < 140, "{} chars", got.chars().count());
    }

    #[test]
    fn quotes_and_backslashes_escaped() {
        let r = "\\\"".repeat(70);
        let (c, a, g) = ("c".repeat(45), "a".repeat(42), "b".repeat(132));
        let s = render_ok(&priced(&r, &c, &a, &g));
        assert!(s.len() <= MAX_STDOUT, "{} bytes", s.len());
        assert!(r.starts_with(parsed(&s)["r"].as_str().unwrap()));
    }

    #[test]
    fn light_reason_untouched() {
        let r = "x".repeat(140);
        let (c, a, g) = ("c".repeat(45), "a".repeat(42), "b".repeat(132));
        let s = render_ok(&priced(&r, &c, &a, &g));
        assert_eq!(parsed(&s)["r"].as_str().unwrap(), r);
    }

    /// Sizes measured on 2026-11-11: chat id 45, address 42, signature 132 chars.
    #[test]
    fn real_sizes_fit_without_cutting() {
        let r = "x".repeat(140);
        let c = format!("chatcmpl-{}", "8072ce3f-08e5-4625-8d54-b2ea1bd79a85");
        let (a, g) = (format!("0x{}", "a".repeat(40)), format!("0x{}", "b".repeat(130)));
        assert_eq!((c.len(), a.len(), g.len()), (45, 42, 132));
        let s = render_ok(&priced(&r, &c, &a, &g));
        assert!(s.len() <= MAX_STDOUT, "{} bytes", s.len());
        assert_eq!(parsed(&s)["r"].as_str().unwrap(), r);
    }

    #[test]
    fn render_err_shape() {
        assert_eq!(render_err("no_key"), r#"{"v":1,"err":"no_key"}"#);
    }
}
