//! Blueprint Section 2 sandbox scenarios against `contracts/mock-outlayer`.
//! Run in WSL: `cargo test --test sandbox` (see contracts/taksir/README.md).

use near_api::{AccountId, NearGas, NearToken, NetworkConfig, Signer};
use near_sdk::serde_json::{json, Value};
use std::sync::{Arc, OnceLock};

const ONE: u128 = 1_000_000_000_000_000_000;
const SUPPLY: u128 = 100_000_000 * ONE;

/// (taksir.wasm, mock_outlayer.wasm), built once per test binary.
fn wasms() -> &'static (Vec<u8>, Vec<u8>) {
    static W: OnceLock<(Vec<u8>, Vec<u8>)> = OnceLock::new();
    W.get_or_init(|| {
        let taksir = cargo_near_build::build_with_cli(Default::default()).expect("build taksir");
        let mock = cargo_near_build::build_with_cli(
            cargo_near_build::BuildOpts::builder().manifest_path("../mock-outlayer/Cargo.toml").build(),
        )
        .expect("build mock-outlayer");
        (std::fs::read(taksir).unwrap(), std::fs::read(mock).unwrap())
    })
}

struct Env {
    sandbox: near_sandbox::Sandbox,
    net: NetworkConfig,
    signer: Arc<Signer>,
    taksir: AccountId,
    mock: AccountId,
    alice: AccountId,
    bob: AccountId,
}

fn params(mock: &AccountId, overrides: Value) -> Value {
    let mut p = json!({
        "appraisal_fee": (10 * ONE).to_string(),
        "challenge_stake": (50 * ONE).to_string(),
        "reward_multiplier": 4,
        "threshold_bps": 7500,
        "budget_ppm": 20,
        "max_challenges": 3,
        "faucet_amount": (500 * ONE).to_string(),
        // A day, so tests that do not test epochs never cross a boundary mid-test.
        "epoch_ms": 86_400_000,
        "challenge_window_ms": 3_600_000,
        "min_rows": 5,
        "max_rows": 100,
        "max_data_bytes": 2000,
        "price_min": 1,
        "price_max": 10_000,
        "outlayer_id": mock,
        "wasm_url": "https://example.com/appraiser.wasm",
        "wasm_hash": "ab".repeat(32),
        "secrets_profile": "taksir",
        "secrets_owner": "owner.sandbox",
        "exec_deposit": NearToken::from_millinear(100),
        "storage_fee": NearToken::from_millinear(50),
    });
    for (k, v) in overrides.as_object().unwrap() {
        p[k] = v.clone();
    }
    p
}

async fn account(sandbox: &near_sandbox::Sandbox, name: &str) -> AccountId {
    let id: AccountId = name.parse().unwrap();
    sandbox
        .create_account(id.as_str().parse().unwrap())
        .initial_balance(NearToken::from_near(20))
        .send()
        .await
        .unwrap();
    id
}

impl Env {
    async fn start(overrides: Value) -> Env {
        let (taksir_wasm, mock_wasm) = wasms().clone();
        let sandbox = near_sandbox::Sandbox::start_sandbox().await.unwrap();
        let net = NetworkConfig::from_rpc_url("sandbox", sandbox.rpc_addr.parse().unwrap());
        let signer =
            Signer::from_secret_key(near_sandbox::config::DEFAULT_GENESIS_ACCOUNT_PRIVATE_KEY.parse().unwrap())
                .unwrap();
        let taksir = account(&sandbox, "taksir.sandbox").await;
        let mock = account(&sandbox, "outlayer.sandbox").await;
        let alice = account(&sandbox, "alice.sandbox").await;
        let bob = account(&sandbox, "bob.sandbox").await;
        near_api::Contract::deploy(mock.clone())
            .use_code(mock_wasm)
            .without_init_call()
            .with_signer(signer.clone())
            .send_to(&net)
            .await
            .unwrap()
            .assert_success();
        near_api::Contract::deploy(taksir.clone())
            .use_code(taksir_wasm)
            .with_init_call("new", json!({ "params": params(&mock, overrides) }))
            .unwrap()
            .with_signer(signer.clone())
            .send_to(&net)
            .await
            .unwrap()
            .assert_success();
        let env = Env { sandbox, net, signer, taksir, mock, alice, bob };
        env.faucet(&env.alice).await;
        env.faucet(&env.bob).await;
        env
    }

    /// Calls `method` on `contract` as `who`; returns the debug text of the result and whether it succeeded.
    async fn call(&self, who: &AccountId, contract: &AccountId, method: &str, args: Value, deposit: NearToken) -> (bool, String) {
        let r = near_api::Contract(contract.clone())
            .call_function(method, args)
            .transaction()
            .deposit(deposit)
            .gas(NearGas::from_tgas(300))
            .with_signer(who.clone(), self.signer.clone())
            .send_to(&self.net)
            .await
            .unwrap();
        let text = format!("{r:?}");
        (r.into_result().is_ok(), text)
    }

    async fn ok(&self, who: &AccountId, method: &str, args: Value, deposit: NearToken) {
        let (ok, text) = self.call(who, &self.taksir, method, args, deposit).await;
        assert!(ok, "{method} should succeed: {text}");
    }

    async fn fails_with(&self, who: &AccountId, method: &str, args: Value, deposit: NearToken, code: &str) {
        let (ok, text) = self.call(who, &self.taksir, method, args, deposit).await;
        assert!(!ok, "{method} should fail with {code}");
        assert!(text.contains(code), "{method} should fail with {code}: {text}");
    }

    async fn view(&self, contract: &AccountId, method: &str, args: Value) -> Value {
        near_api::Contract(contract.clone())
            .call_function(method, args)
            .read_only()
            .fetch_from(&self.net)
            .await
            .unwrap()
            .data
    }

    async fn stats(&self) -> Value {
        self.view(&self.taksir, "get_stats", json!({})).await
    }

    async fn balance(&self, who: &AccountId) -> u128 {
        as_u128(&self.view(&self.taksir, "ft_balance_of", json!({ "account_id": who })).await)
    }

    async fn faucet(&self, who: &AccountId) {
        self.ok(who, "faucet", json!({}), NearToken::from_millinear(10)).await;
    }

    async fn push(&self, item: Value) {
        let (ok, text) = self.call(&self.mock, &self.mock, "push", json!({ "item": item }), NearToken::from_near(0)).await;
        assert!(ok, "push: {text}");
    }

    async fn appraise(&self, who: &AccountId, data: &str) {
        self.ok(who, "appraise", json!({ "data": data }), op_deposit()).await;
    }

    async fn challenge(&self, who: &AccountId, id: u64, variant: &str) {
        self.ok(who, "challenge", json!({ "appraisal_id": id, "variant": variant }), op_deposit()).await;
    }

    /// Alice's `data` priced at `price`; returns its id.
    async fn priced(&self, data: &str, price: u32) -> u64 {
        self.push(json!({ "Price": price })).await;
        self.appraise(&self.alice, data).await;
        let id = as_u64(&self.stats().await["appraisal_count"]) - 1;
        assert_eq!(self.view(&self.taksir, "get_appraisal", json!({ "id": id })).await["status"], "Priced");
        id
    }
}

fn op_deposit() -> NearToken {
    NearToken::from_millinear(150)
}

fn as_u128(v: &Value) -> u128 {
    v.as_str().unwrap().parse().unwrap()
}

fn as_u64(v: &Value) -> u64 {
    v.as_u64().unwrap()
}

fn data5(tag: &str) -> String {
    (1..=5).map(|i| format!("{tag} line {i}")).collect::<Vec<_>>().join("\n")
}

fn rotated(text: &str, k: usize) -> String {
    let mut lines: Vec<&str> = text.lines().collect();
    lines.rotate_left(k);
    lines.join("\n")
}

#[tokio::test]
async fn s01_appraise_success_burns_fee() {
    let e = Env::start(json!({})).await;
    let id = e.priced(&data5("menu"), 300).await;
    let s = e.stats().await;
    assert_eq!(as_u128(&s["total_supply"]), SUPPLY - 10 * ONE);
    assert_eq!(e.balance(&e.alice).await, 490 * ONE);
    let ap = e.view(&e.taksir, "get_appraisal", json!({ "id": id })).await;
    assert_eq!(ap["price"], 300);
    // M-10 and D-7: what OutLayer received.
    let req = e.view(&e.mock, "last_request", json!({})).await;
    assert_eq!(req["input_data"], json!({ "data": data5("menu") }).to_string());
    assert_eq!(req["payer_account_id"], e.alice.as_str());
    assert_eq!(req["response_format"], "Text");
    assert_eq!(req["source"]["WasmUrl"]["build_target"], "wasm32-wasip2");
    assert_eq!(req["attached_deposit"], NearToken::from_millinear(100).as_yoctonear().to_string());
}

#[tokio::test]
async fn s02_appraise_failure_refunds_fee() {
    let e = Env::start(json!({})).await;
    e.push(json!("Fail")).await;
    e.appraise(&e.alice, &data5("menu")).await;
    assert_eq!(e.view(&e.taksir, "get_appraisal", json!({ "id": 0 })).await["status"], "Failed");
    assert_eq!(e.balance(&e.alice).await, 500 * ONE);
    let s = e.stats().await;
    assert_eq!((as_u128(&s["total_supply"]), as_u128(&s["escrow"])), (SUPPLY, 0));
}

#[tokio::test]
async fn s03_same_canonical_hash_rejected() {
    let e = Env::start(json!({})).await;
    let text = data5("menu");
    e.priced(&text, 300).await;
    e.fails_with(&e.bob, "appraise", json!({ "data": rotated(&text, 2) }), op_deposit(), "already_appraised").await;
}

#[tokio::test]
async fn s04_bad_variants_rejected() {
    let e = Env::start(json!({})).await;
    let text = data5("menu");
    let id = e.priced(&text, 300).await;
    let args = |v: &str| json!({ "appraisal_id": id, "variant": v });
    e.fails_with(&e.bob, "challenge", args(&data5("other")), op_deposit(), "not_equivalent").await;
    e.fails_with(&e.bob, "challenge", args(&text), op_deposit(), "same_order").await;
    assert_eq!(e.balance(&e.bob).await, 500 * ONE);
}

#[tokio::test]
async fn s05_caught_pays_stake_and_reward() {
    let e = Env::start(json!({})).await;
    let text = data5("menu");
    let id = e.priced(&text, 100).await;
    e.push(json!({ "Price": 401 })).await;
    e.challenge(&e.bob, id, &rotated(&text, 1)).await;
    assert_eq!(e.balance(&e.bob).await, 700 * ONE);
    let s = e.stats().await;
    assert_eq!(as_u128(&s["treasury"]), 60_000_000 * ONE - 200 * ONE);
    assert_eq!(as_u128(&s["total_supply"]), SUPPLY - 10 * ONE);
    assert_eq!(e.view(&e.taksir, "get_appraisal", json!({ "id": id })).await["status"], "Caught");
    let chs = e.view(&e.taksir, "get_challenges", json!({ "appraisal_id": id })).await;
    assert_eq!(chs[0]["status"], "Caught");
    // M-10: the challenge reached OutLayer in the same {"data": …} shape as the appraisal.
    let req = e.view(&e.mock, "last_request", json!({})).await;
    assert_eq!(req["input_data"], json!({ "data": rotated(&text, 1) }).to_string());
    assert_eq!(req["payer_account_id"], e.bob.as_str());
    // A caught appraisal cannot be challenged again.
    let again = json!({ "appraisal_id": id, "variant": rotated(&text, 2) });
    e.fails_with(&e.bob, "challenge", again, op_deposit(), "not_priced").await;
}

#[tokio::test]
async fn s06_survived_burns_stake() {
    let e = Env::start(json!({})).await;
    let text = data5("menu");
    let id = e.priced(&text, 100).await;
    e.push(json!({ "Price": 400 })).await;
    e.challenge(&e.bob, id, &rotated(&text, 1)).await;
    assert_eq!(e.balance(&e.bob).await, 450 * ONE);
    assert_eq!(as_u128(&e.stats().await["total_supply"]), SUPPLY - 60 * ONE);
    let chs = e.view(&e.taksir, "get_challenges", json!({ "appraisal_id": id })).await;
    assert_eq!(chs[0]["status"], "Survived");
}

#[tokio::test]
async fn s07_enclave_failure_refunds_stake() {
    let e = Env::start(json!({})).await;
    let text = data5("menu");
    let id = e.priced(&text, 100).await;
    e.push(json!("Fail")).await;
    e.challenge(&e.bob, id, &rotated(&text, 1)).await;
    e.push(json!({ "Raw": "not json" })).await;
    e.challenge(&e.bob, id, &rotated(&text, 2)).await;
    assert_eq!(e.balance(&e.bob).await, 500 * ONE);
    let chs = e.view(&e.taksir, "get_challenges", json!({ "appraisal_id": id })).await;
    assert_eq!((chs[0]["status"].as_str(), chs[1]["status"].as_str()), (Some("Failed"), Some("Failed")));
    let s = e.stats().await;
    assert_eq!((as_u128(&s["escrow"]), as_u64(&s["epoch_challenges"])), (0, 0));
}

#[tokio::test]
async fn s08_reward_capped_by_budget() {
    // 60M treasury * 1 ppm = a 60 TAKSIR budget.
    let e = Env::start(json!({ "budget_ppm": 1 })).await;
    let t1 = data5("menu");
    let id1 = e.priced(&t1, 100).await;
    e.push(json!({ "Price": 9000 })).await;
    e.challenge(&e.bob, id1, &rotated(&t1, 1)).await;
    assert_eq!(e.balance(&e.bob).await, 560 * ONE);
    assert_eq!(as_u128(&e.stats().await["budget_left"]), 0);
    let t2 = data5("schedule");
    let id2 = e.priced(&t2, 100).await;
    e.push(json!({ "Price": 9000 })).await;
    e.challenge(&e.bob, id2, &rotated(&t2, 1)).await;
    assert_eq!(e.balance(&e.bob).await, 560 * ONE, "budget empty: stake back only");
    let chs = e.view(&e.taksir, "get_challenges", json!({ "appraisal_id": id2 })).await;
    assert_eq!(chs[0]["status"], "Caught");
}

#[tokio::test]
async fn s09_epoch_rollover_burns_budget() {
    let e = Env::start(json!({ "epoch_ms": 1000 })).await;
    let burned_before = as_u128(&e.stats().await["burned_total"]);
    e.sandbox.fast_forward(100).await.unwrap();
    e.ok(&e.alice, "poke", json!({}), NearToken::from_near(0)).await;
    let s = e.stats().await;
    assert!(as_u64(&s["epoch_index"]) >= 20, "many skipped epochs processed: {s}");
    assert!(as_u64(&s["epoch_index"]) <= as_u64(&s["epoch_by_time"]));
    assert!(as_u128(&s["burned_total"]) >= burned_before + 1200 * ONE * 20 / 100, "{s}");
    let n = as_u64(&s["log_count"]);
    let log = e.view(&e.taksir, "get_log", json!({ "from": n - 1, "limit": 1 })).await;
    assert_eq!(log[0]["kind"], "BurnEpoch");
    assert!(as_u64(&log[0]["epoch_to"]) > as_u64(&log[0]["epoch_from"]));
}

#[tokio::test]
async fn s10a_challenge_window_enforced() {
    let e = Env::start(json!({ "challenge_window_ms": 30_000 })).await;
    let text = data5("menu");
    let id = e.priced(&text, 100).await;
    e.sandbox.fast_forward(200).await.unwrap();
    let args = json!({ "appraisal_id": id, "variant": rotated(&text, 1) });
    e.fails_with(&e.bob, "challenge", args, op_deposit(), "window_closed").await;
}

#[tokio::test]
async fn s10b_max_challenges_enforced() {
    let e = Env::start(json!({})).await;
    let text = data5("menu");
    let id = e.priced(&text, 100).await;
    for k in 1..=3 {
        e.push(json!({ "Price": 100 })).await;
        e.challenge(&e.bob, id, &rotated(&text, k)).await;
    }
    let args = json!({ "appraisal_id": id, "variant": rotated(&text, 4) });
    e.fails_with(&e.bob, "challenge", args, op_deposit(), "max_challenges").await;
}

#[tokio::test]
async fn s11_faucet_once_per_account() {
    let e = Env::start(json!({})).await;
    assert_eq!(e.balance(&e.alice).await, 500 * ONE);
    e.fails_with(&e.alice, "faucet", json!({}), NearToken::from_near(0), "faucet_claimed").await;
}

#[tokio::test]
async fn s12_callbacks_are_private() {
    let e = Env::start(json!({})).await;
    let text = data5("menu");
    e.priced(&text, 100).await;
    let no = NearToken::from_near(0);
    e.fails_with(&e.alice, "on_appraise_result", json!({ "id": 0 }), no, "is private").await;
    e.fails_with(&e.alice, "on_challenge_result", json!({ "challenge_id": 0 }), no, "is private").await;
    let resolve = json!({ "sender_id": e.alice, "receiver_id": e.bob, "amount": "1" });
    e.fails_with(&e.alice, "ft_resolve_transfer", resolve, no, "is private").await;
}

#[tokio::test]
async fn s12b_init_twice_rejected() {
    let e = Env::start(json!({})).await;
    let args = json!({ "params": params(&e.mock, json!({})) });
    e.fails_with(&e.alice, "new", args, NearToken::from_near(0), "already been initialized").await;
}

/// Five-minute epochs; each step jumps ~330 s, so it always closes the epoch
/// holding the last resolved challenge. A jump that crosses two
/// boundaries adds a quiet epoch, which by M-15 leaves the streak alone.
#[tokio::test]
async fn s13_streak_clean_caught_quiet() {
    let e = Env::start(json!({ "epoch_ms": 300_000, "challenge_window_ms": 86_400_000 })).await;
    let next_epoch = || async { e.sandbox.fast_forward(1_100).await.unwrap() };

    // Clean epoch: one challenge, survived.
    let t1 = data5("clean");
    let id1 = e.priced(&t1, 100).await;
    e.push(json!({ "Price": 100 })).await;
    e.challenge(&e.bob, id1, &rotated(&t1, 1)).await;
    next_epoch().await;
    e.ok(&e.alice, "poke", json!({}), NearToken::from_near(0)).await;
    let s = e.stats().await;
    assert_eq!((as_u64(&s["clean_streak"]), as_u64(&s["best_streak"])), (1, 1), "{s}");

    // Caught epoch: resets the streak, best stays.
    let t2 = data5("caught");
    let id2 = e.priced(&t2, 100).await;
    e.push(json!({ "Price": 9000 })).await;
    e.challenge(&e.bob, id2, &rotated(&t2, 1)).await;
    next_epoch().await;
    e.ok(&e.alice, "poke", json!({}), NearToken::from_near(0)).await;
    let s = e.stats().await;
    assert_eq!((as_u64(&s["clean_streak"]), as_u64(&s["best_streak"])), (0, 1), "{s}");

    // Clean again, then a quiet epoch: unchanged.
    let t3 = data5("again");
    let id3 = e.priced(&t3, 100).await;
    e.push(json!({ "Price": 100 })).await;
    e.challenge(&e.bob, id3, &rotated(&t3, 1)).await;
    next_epoch().await;
    e.ok(&e.alice, "poke", json!({}), NearToken::from_near(0)).await;
    next_epoch().await;
    e.ok(&e.alice, "poke", json!({}), NearToken::from_near(0)).await;
    let s = e.stats().await;
    assert_eq!((as_u64(&s["clean_streak"]), as_u64(&s["best_streak"])), (1, 1), "{s}");
}

