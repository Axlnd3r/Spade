//! M-4 / M-5 data rules. Must stay byte-identical with spike/lib.mjs and the
//! enclave; shared cases live in enclave/appraiser/vectors/vectors.json.

use near_sdk::env;

#[derive(Debug, PartialEq, Eq)]
pub enum DataError {
    TooLarge,
    TooFewRows,
    TooManyRows,
}

impl DataError {
    pub fn code(&self) -> &'static str {
        match self {
            DataError::TooLarge => "too_large",
            DataError::TooFewRows => "too_few_rows",
            DataError::TooManyRows => "too_many_rows",
        }
    }
}

/// Split on `\n`, strip only ASCII space, tab and CR at both ends (D-2), drop empty lines.
pub fn normalize_lines(text: &str) -> Vec<String> {
    text.split('\n')
        .map(|l| l.trim_matches(|c| c == ' ' || c == '\t' || c == '\r'))
        .filter(|l| !l.is_empty())
        .map(str::to_string)
        .collect()
}

/// Size is measured on the raw input; checks run in D-2 precedence order.
pub fn validate_data(
    text: &str,
    lines: &[String],
    min_rows: u32,
    max_rows: u32,
    max_data_bytes: u32,
) -> Result<(), DataError> {
    if text.len() > max_data_bytes as usize {
        return Err(DataError::TooLarge);
    }
    if lines.len() < min_rows as usize {
        return Err(DataError::TooFewRows);
    }
    if lines.len() > max_rows as usize {
        return Err(DataError::TooManyRows);
    }
    Ok(())
}

pub fn raw_hash(lines: &[String]) -> [u8; 32] {
    env::sha256_array(lines.join("\n").as_bytes())
}

/// `String` ordering is byte-wise UTF-8, which is the order D-3 fixes.
pub fn canonical_hash(lines: &[String]) -> [u8; 32] {
    let mut sorted = lines.to_vec();
    sorted.sort();
    raw_hash(&sorted)
}

pub fn to_hex(h: &[u8; 32]) -> String {
    h.iter().map(|b| format!("{b:02x}")).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::serde_json::{self, Value};

    fn owned(v: &[&str]) -> Vec<String> {
        v.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn vectors_match() {
        let cases: Vec<Value> =
            serde_json::from_str(include_str!("../../../enclave/appraiser/vectors/vectors.json")).unwrap();
        assert!(!cases.is_empty());
        for c in cases {
            let name = c["name"].as_str().unwrap();
            let input = c["input"].as_str().unwrap();
            let expected: Vec<String> = serde_json::from_value(c["lines"].clone()).unwrap();
            let lines = normalize_lines(input);
            assert_eq!(lines, expected, "{name}: lines");
            let verdict = validate_data(input, &lines, 5, 100, 2000);
            if c["valid"].as_bool().unwrap() {
                assert!(verdict.is_ok(), "{name}: should be valid");
                assert_eq!(to_hex(&raw_hash(&lines)), c["raw_hash"].as_str().unwrap(), "{name}: raw_hash");
                assert_eq!(
                    to_hex(&canonical_hash(&lines)),
                    c["canonical_hash"].as_str().unwrap(),
                    "{name}: canonical_hash"
                );
            } else {
                assert_eq!(verdict.unwrap_err().code(), c["error_code"].as_str().unwrap(), "{name}: error_code");
            }
        }
    }

    #[test]
    fn form_feed_and_nbsp_kept() {
        assert_eq!(normalize_lines("\u{0C}a\u{0B}\n b\u{A0} "), owned(&["\u{0C}a\u{0B}", "b\u{A0}"]));
    }

    #[test]
    fn canonical_is_order_free() {
        let ab = owned(&["a", "b"]);
        let ba = owned(&["b", "a"]);
        assert_eq!(canonical_hash(&ba), canonical_hash(&ab));
        assert_ne!(canonical_hash(&ba), raw_hash(&ba));
    }
}
