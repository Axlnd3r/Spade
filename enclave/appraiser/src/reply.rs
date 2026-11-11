//! Reading the model's answer. Port of `parseReply` in spike/lib.mjs, except
//! that a string price must be decimal ("0x10" is rejected, the spike reads 16).

use serde_json::Value;

pub const PRICE_MIN: u32 = 1;
pub const PRICE_MAX: u32 = 10_000;
pub const REASON_MAX_CHARS: usize = 140;

#[derive(Debug, PartialEq)]
pub struct Reply {
    pub price: u32,
    pub reason: String,
}

fn to_price(v: &Value) -> Option<u32> {
    let n = match v {
        Value::Number(n) => n.as_f64()?,
        Value::String(s) if !s.trim().is_empty() => s.trim().parse::<f64>().ok()?,
        _ => return None,
    };
    n.is_finite().then(|| n.round().clamp(PRICE_MIN as f64, PRICE_MAX as f64) as u32)
}

/// The JSON object between the first `{` and the last `}`, so code fences and
/// surrounding prose are tolerated. `None` when there is no usable price.
pub fn parse_reply(content: &str) -> Option<Reply> {
    let start = content.find('{')?;
    let end = content.rfind('}').filter(|&e| e >= start)?;
    let obj: Value = serde_json::from_str(&content[start..=end]).ok()?;
    let price = to_price(obj.get("price")?)?;
    let reason = obj
        .get("reason")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .chars()
        .filter(|&c| !(c <= '\u{1F}' || c == '\u{7F}'))
        .take(REASON_MAX_CHARS)
        .collect();
    Some(Reply { price, reason })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn price_of(v: serde_json::Value) -> Option<u32> {
        parse_reply(&json!({ "price": v, "reason": "r" }).to_string()).map(|r| r.price)
    }

    fn reason_of(v: &str) -> String {
        parse_reply(&json!({ "price": 1, "reason": v }).to_string()).unwrap().reason
    }

    #[test]
    fn reads_clean_fenced_and_wrapped_json() {
        assert_eq!(
            parse_reply(r#"{"price": 300, "reason": "ok"}"#),
            Some(Reply { price: 300, reason: "ok".to_string() })
        );
        assert_eq!(parse_reply("```json\n{\"price\": 42, \"reason\": \"x\"}\n```").unwrap().price, 42);
        assert_eq!(parse_reply(r#"Here: {"price": 77, "reason": "y"} thanks"#).unwrap().price, 77);
    }

    #[test]
    fn coerces_and_clamps_price() {
        assert_eq!(price_of(json!("300")), Some(300));
        assert_eq!(price_of(json!(" 42 ")), Some(42));
        assert_eq!(price_of(json!(3.7)), Some(4));
        assert_eq!(price_of(json!(0)), Some(1));
        assert_eq!(price_of(json!(-5)), Some(1));
        assert_eq!(price_of(json!(20000)), Some(10_000));
    }

    #[test]
    fn no_usable_price_is_none() {
        assert_eq!(parse_reply("I cannot appraise this."), None);
        assert_eq!(parse_reply(r#"{"reason": "no price"}"#), None);
        assert_eq!(price_of(json!("abc")), None);
        assert_eq!(price_of(json!(null)), None);
        assert_eq!(price_of(json!("0x10")), None);
        assert_eq!(price_of(json!("")), None);
        assert_eq!(parse_reply("{not json}"), None);
    }

    #[test]
    fn reason_cleaned_and_cut() {
        assert_eq!(reason_of("a\u{0}b\nc\u{7F}"), "abc");
        assert_eq!(reason_of(&"😀".repeat(150)).chars().count(), 140);
        assert_eq!(parse_reply(r#"{"price": 5}"#).unwrap().reason, "");
    }
}
