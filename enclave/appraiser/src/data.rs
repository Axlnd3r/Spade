//! M-4 / M-5 normalization and `raw_hash`, identical to the contract
//! (contracts/taksir/src/data.rs) and the spike; both test against
//! vectors/vectors.json.

use sha2::{Digest, Sha256};

/// Split on `\n`, strip only ASCII space, tab and CR at both ends (D-2), drop empty lines.
pub fn normalize_lines(text: &str) -> Vec<String> {
    text.split('\n')
        .map(|l| l.trim_matches(|c| c == ' ' || c == '\t' || c == '\r'))
        .filter(|l| !l.is_empty())
        .map(str::to_string)
        .collect()
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    Sha256::digest(bytes).iter().map(|b| format!("{b:02x}")).collect()
}

/// M-5 `raw_hash`: the lines in the order received, never sorted.
pub fn raw_hash_hex(lines: &[String]) -> String {
    sha256_hex(lines.join("\n").as_bytes())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    #[test]
    fn vectors_match() {
        let cases: Vec<Value> = serde_json::from_str(include_str!("../vectors/vectors.json")).unwrap();
        assert!(!cases.is_empty());
        for c in cases {
            let name = c["name"].as_str().unwrap();
            let expected: Vec<String> = serde_json::from_value(c["lines"].clone()).unwrap();
            let lines = normalize_lines(c["input"].as_str().unwrap());
            assert_eq!(lines, expected, "{name}: lines");
            if c["valid"].as_bool().unwrap() {
                assert_eq!(raw_hash_hex(&lines), c["raw_hash"].as_str().unwrap(), "{name}: raw_hash");
            }
        }
    }

    #[test]
    fn nbsp_and_form_feed_kept() {
        assert_eq!(normalize_lines("\u{0C}a\u{0B}\n b\u{A0} "), vec!["\u{0C}a\u{0B}", "b\u{A0}"]);
    }

    #[test]
    fn sha256_hex_known_value() {
        assert_eq!(sha256_hex(b"abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    }
}
