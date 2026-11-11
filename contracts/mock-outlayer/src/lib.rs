//! Stand-in for OutLayer's `request_execution` in sandbox tests. Each call
//! takes the next scripted reply from a queue.

use near_sdk::serde_json::{self, json, Value};
use near_sdk::{env, near, AccountId, PromiseOrValue};

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub enum MockItem {
    /// A well-formed enclave reply with this price, hashed over the data received.
    Price(u32),
    /// Like `Price`, with every field near its realistic maximum (140-char 3-byte
    /// reason, full model id, chat id, address and signature): the heaviest reply.
    Padded(u32),
    /// This exact stdout.
    Raw(String),
    /// The execution fails (also what an empty queue does).
    Fail,
}

#[near(contract_state)]
#[derive(Default)]
pub struct Mock {
    queue: Vec<MockItem>,
    last: Option<String>,
}

#[near]
impl Mock {
    pub fn push(&mut self, item: MockItem) {
        self.queue.push(item);
    }

    #[payable]
    pub fn request_execution(
        &mut self,
        source: Value,
        resource_limits: Value,
        input_data: String,
        secrets_ref: Value,
        response_format: String,
        payer_account_id: Option<AccountId>,
    ) -> PromiseOrValue<String> {
        self.last = Some(
            json!({
                "source": source,
                "resource_limits": resource_limits,
                "input_data": input_data,
                "secrets_ref": secrets_ref,
                "response_format": response_format,
                "payer_account_id": payer_account_id,
                "attached_deposit": env::attached_deposit(),
            })
            .to_string(),
        );
        let item = if self.queue.is_empty() { MockItem::Fail } else { self.queue.remove(0) };
        let input: Value = serde_json::from_str(&input_data).unwrap_or_default();
        let data = input["data"].as_str().unwrap_or_default();
        let h: String = env::sha256(data.as_bytes()).iter().map(|b| format!("{b:02x}")).collect();
        match item {
            MockItem::Price(p) => PromiseOrValue::Value(
                json!({"v": 1, "h": h, "p": p, "r": "mock", "m": "mock", "c": "", "a": "", "g": ""}).to_string(),
            ),
            MockItem::Padded(p) => PromiseOrValue::Value(
                json!({
                    "v": 1, "h": h, "p": p,
                    "r": "あ".repeat(140),
                    "m": "Qwen/Qwen3-VL-30B-A3B-Instruct",
                    "c": format!("chatcmpl-{}", "f".repeat(32)),
                    "a": format!("0x{}", "a".repeat(40)),
                    "g": "b".repeat(130),
                })
                .to_string(),
            ),
            MockItem::Raw(s) => PromiseOrValue::Value(s),
            // A failing promise (not a panic) so the queue pop above is kept.
            MockItem::Fail => PromiseOrValue::Promise(Self::ext(env::current_account_id()).fail()),
        }
    }

    pub fn fail(&self) {
        env::panic_str("mock: execution failed");
    }

    pub fn last_request(&self) -> Option<Value> {
        self.last.as_deref().and_then(|s| serde_json::from_str(s).ok())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::serde_json::{self, json, Value};

    fn call(m: &mut Mock, data: &str) -> Option<String> {
        match m.request_execution(
            json!({"WasmUrl": {}}),
            json!({}),
            json!({ "data": data }).to_string(),
            json!({}),
            "Text".to_string(),
            None,
        ) {
            PromiseOrValue::Value(s) => Some(s),
            PromiseOrValue::Promise(_) => None,
        }
    }

    #[test]
    fn price_reply_hashes_the_data_it_was_sent() {
        let mut m = Mock::default();
        m.push(MockItem::Price(300));
        let out: Value = serde_json::from_str(&call(&mut m, "a\nb").unwrap()).unwrap();
        let want: String = env::sha256("a\nb".as_bytes()).iter().map(|b| format!("{b:02x}")).collect();
        assert_eq!((out["v"].as_u64(), out["p"].as_u64(), out["h"].as_str()), (Some(1), Some(300), Some(want.as_str())));
        assert_eq!(m.last_request().unwrap()["input_data"], json!({ "data": "a\nb" }).to_string());
    }

    #[test]
    fn padded_reply_is_heavy_and_valid() {
        let mut m = Mock::default();
        m.push(MockItem::Padded(42));
        let s = call(&mut m, "a\nb").unwrap();
        assert!(s.len() > 700 && s.len() <= 900, "{} bytes", s.len());
        let out: Value = serde_json::from_str(&s).unwrap();
        assert_eq!((out["p"].as_u64(), out["r"].as_str().unwrap().chars().count()), (Some(42), 140));
    }

    #[test]
    fn raw_and_fail_replies() {
        let mut m = Mock::default();
        m.push(MockItem::Raw("garbage".to_string()));
        m.push(MockItem::Fail);
        assert_eq!(call(&mut m, "x").as_deref(), Some("garbage"));
        assert_eq!(call(&mut m, "x"), None, "Fail returns a promise that will fail");
        assert_eq!(call(&mut m, "x"), None, "empty queue fails too");
    }
}
