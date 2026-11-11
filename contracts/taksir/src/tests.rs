use super::*;
use near_contract_standards::fungible_token::core::FungibleTokenCore;
use near_contract_standards::fungible_token::metadata::FungibleTokenMetadataProvider;
use near_contract_standards::storage_management::StorageManagement;
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::{testing_env, NearToken};

pub const ONE: u128 = 1_000_000_000_000_000_000;
pub const SUPPLY: u128 = 100_000_000 * ONE;

pub fn contract_id() -> AccountId {
    "taksir.testnet".parse().unwrap()
}

pub fn user(name: &str) -> AccountId {
    format!("{name}.testnet").parse().unwrap()
}

pub fn test_params() -> Params {
    Params {
        appraisal_fee: U128(10 * ONE),
        challenge_stake: U128(50 * ONE),
        reward_multiplier: 4,
        threshold_bps: 7500,
        budget_ppm: 20,
        max_challenges: 3,
        faucet_amount: U128(500 * ONE),
        epoch_ms: 600_000,
        challenge_window_ms: 3_600_000,
        min_rows: 5,
        max_rows: 100,
        max_data_bytes: 2000,
        price_min: 1,
        price_max: 10_000,
        outlayer_id: "outlayer.testnet".parse().unwrap(),
        wasm_url: "https://example.com/appraiser.wasm".to_string(),
        wasm_hash: "ab".repeat(32),
        secrets_profile: "taksir".to_string(),
        secrets_owner: user("owner"),
        exec_deposit: NearToken::from_millinear(100),
        storage_fee: NearToken::from_millinear(50),
    }
}

pub const GENESIS_MS: u64 = 1_800_000_000_000;

/// Context with `predecessor` calling the contract at `now_ms`, attaching `deposit`.
pub fn ctx(predecessor: &AccountId, now_ms: u64, deposit: NearToken) {
    let mut b = VMContextBuilder::new();
    b.current_account_id(contract_id())
        .predecessor_account_id(predecessor.clone())
        .signer_account_id(predecessor.clone())
        .block_timestamp(now_ms * 1_000_000)
        .attached_deposit(deposit)
        .prepaid_gas(near_sdk::Gas::from_tgas(300));
    testing_env!(b.build());
}

pub fn setup_with(p: Params) -> Contract {
    ctx(&user("deployer"), GENESIS_MS, NearToken::from_near(0));
    Contract::new(p)
}

pub fn setup() -> Contract {
    setup_with(test_params())
}

pub fn min_storage(c: &Contract) -> NearToken {
    c.storage_balance_bounds().min
}

/// Covers registration plus the claim record and log entry a faucet call stores.
pub const FAUCET_DEPOSIT: NearToken = NearToken::from_millinear(10);

/// Registers `who` and gives it the faucet amount.
pub fn fund(c: &mut Contract, who: &AccountId, now_ms: u64) {
    ctx(who, now_ms, FAUCET_DEPOSIT);
    c.faucet();
}

#[test]
#[should_panic(expected = "deposit_low")]
fn faucet_registration_deposit_alone_is_not_enough() {
    let mut c = setup();
    let min = min_storage(&c);
    ctx(&user("alice"), GENESIS_MS + 1, min);
    c.faucet();
}

#[test]
#[should_panic(expected = "deposit_low")]
fn faucet_registered_account_still_pays_its_storage() {
    let mut c = setup();
    let a = user("alice");
    let min = min_storage(&c);
    ctx(&a, GENESIS_MS + 1, min);
    c.storage_deposit(None, None);
    ctx(&a, GENESIS_MS + 2, NearToken::from_near(0));
    c.faucet();
}

#[test]
fn new_mints_once() {
    let c = setup();
    assert_eq!(c.ft_total_supply().0, SUPPLY);
    assert_eq!(c.ft_balance_of(contract_id()).0, SUPPLY);
    let s = c.get_stats();
    assert_eq!(s.treasury.0, 60_000_000 * ONE);
    assert_eq!(s.faucet_pool.0, 40_000_000 * ONE);
    assert_eq!(c.log.len(), 1);
    let first = c.log.get(0).unwrap();
    assert!(matches!(first.kind, LogKind::Mint));
    assert_eq!(first.amount.0, SUPPLY);
    let m = c.ft_metadata();
    assert_eq!(m.decimals, 18);
    assert_eq!(m.symbol, "TAKSIR");
    assert_eq!(m.name, "TAKSIR");
}

#[test]
#[should_panic(expected = "bad_params")]
fn bad_params_price_min_zero() {
    setup_with(Params { price_min: 0, ..test_params() });
}

#[test]
#[should_panic(expected = "bad_params")]
fn bad_params_threshold_10000() {
    setup_with(Params { threshold_bps: 10_000, ..test_params() });
}

#[test]
#[should_panic(expected = "bad_params")]
fn bad_params_wasm_hash() {
    setup_with(Params { wasm_hash: "xyz".to_string(), ..test_params() });
}

macro_rules! bad_params_zero {
    ($($name:ident: $field:ident = $zero:expr;)*) => {$(
        #[test]
        #[should_panic(expected = "bad_params")]
        fn $name() {
            setup_with(Params { $field: $zero, ..test_params() });
        }
    )*};
}

bad_params_zero! {
    bad_params_zero_appraisal_fee: appraisal_fee = U128(0);
    bad_params_zero_challenge_stake: challenge_stake = U128(0);
    bad_params_zero_faucet_amount: faucet_amount = U128(0);
    bad_params_zero_exec_deposit: exec_deposit = NearToken::from_yoctonear(0);
    bad_params_zero_challenge_window: challenge_window_ms = 0;
    bad_params_zero_reward_multiplier: reward_multiplier = 0;
}

#[test]
fn faucet_once() {
    let mut c = setup();
    let a = user("alice");
    fund(&mut c, &a, GENESIS_MS + 1);
    assert_eq!(c.ft_balance_of(a.clone()).0, 500 * ONE);
    assert_eq!(c.get_stats().faucet_pool.0, 40_000_000 * ONE - 500 * ONE);
    let last = c.log.get(c.log.len() - 1).unwrap();
    assert!(matches!(last.kind, LogKind::Faucet));
    assert_eq!(last.account_id.as_ref(), Some(&a));
    assert_eq!(last.amount.0, 500 * ONE);
}

#[test]
#[should_panic(expected = "faucet_claimed")]
fn faucet_twice_panics() {
    let mut c = setup();
    let a = user("alice");
    fund(&mut c, &a, GENESIS_MS + 1);
    ctx(&a, GENESIS_MS + 2, NearToken::from_near(0));
    c.faucet();
}

#[test]
#[should_panic(expected = "deposit_low")]
fn faucet_unregistered_without_deposit_panics() {
    let mut c = setup();
    ctx(&user("alice"), GENESIS_MS + 1, NearToken::from_near(0));
    c.faucet();
}

#[test]
#[should_panic(expected = "faucet_empty")]
fn faucet_empty_panics() {
    let mut c = setup_with(Params { faucet_amount: U128(40_000_000 * ONE + 1), ..test_params() });
    fund(&mut c, &user("alice"), GENESIS_MS + 1);
}

#[test]
#[should_panic(expected = "transfer_to_contract")]
fn ft_transfer_to_contract_rejected() {
    let mut c = setup();
    let a = user("alice");
    fund(&mut c, &a, GENESIS_MS + 1);
    ctx(&a, GENESIS_MS + 2, NearToken::from_yoctonear(1));
    c.ft_transfer(contract_id(), U128(ONE), None);
}

#[test]
#[should_panic(expected = "transfer_to_contract")]
fn ft_transfer_call_to_contract_rejected() {
    let mut c = setup();
    let a = user("alice");
    fund(&mut c, &a, GENESIS_MS + 1);
    ctx(&a, GENESIS_MS + 2, NearToken::from_yoctonear(1));
    let _ = c.ft_transfer_call(contract_id(), U128(ONE), None, String::new());
}

#[test]
#[should_panic(expected = "unregister_disabled")]
fn unregister_disabled() {
    let mut c = setup();
    let a = user("alice");
    fund(&mut c, &a, GENESIS_MS + 1);
    ctx(&a, GENESIS_MS + 2, NearToken::from_yoctonear(1));
    c.storage_unregister(Some(false));
}

#[test]
#[should_panic(expected = "unregister_disabled")]
fn unregister_force_disabled() {
    let mut c = setup();
    let a = user("alice");
    fund(&mut c, &a, GENESIS_MS + 1);
    ctx(&a, GENESIS_MS + 2, NearToken::from_yoctonear(1));
    c.storage_unregister(Some(true));
}

#[test]
fn params_unchanged_and_supply_never_rises() {
    let mut c = setup();
    let before = near_sdk::serde_json::to_string(&c.get_params()).unwrap();
    let (a, b) = (user("alice"), user("bob"));
    fund(&mut c, &a, GENESIS_MS + 1);
    fund(&mut c, &b, GENESIS_MS + 2);
    ctx(&a, GENESIS_MS + 3, NearToken::from_yoctonear(1));
    c.ft_transfer(b.clone(), U128(7 * ONE), None);
    assert_eq!(c.ft_balance_of(b).0, 507 * ONE);
    assert_eq!(near_sdk::serde_json::to_string(&c.get_params()).unwrap(), before);
    assert!(c.ft_total_supply().0 <= SUPPLY);
}

mod epochs {
    use super::*;
    use crate::epoch::budget_for;

    const EPOCH: u64 = 600_000;

    #[test]
    fn genesis_budget() {
        let c = setup();
        let s = c.get_stats();
        assert_eq!(s.budget.0, 1200 * ONE);
        assert_eq!(s.budget_left.0, 1200 * ONE);
        assert_eq!(s.epoch_index, 0);
    }

    #[test]
    fn unused_budget_burned() {
        let mut c = setup();
        ctx(&user("anyone"), GENESIS_MS + EPOCH, NearToken::from_near(0));
        c.poke();
        let s = c.get_stats();
        let treasury = 60_000_000 * ONE - 1200 * ONE;
        assert_eq!(s.treasury.0, treasury);
        assert_eq!(s.total_supply.0, SUPPLY - 1200 * ONE);
        assert_eq!(s.burned_total.0, 1200 * ONE);
        assert_eq!(s.budget.0, budget_for(treasury, 20));
        assert_eq!(s.epoch_index, 1);
        let last = c.log.get(c.log.len() - 1).unwrap();
        assert!(matches!(last.kind, LogKind::BurnEpoch));
        assert_eq!((last.epoch_from, last.epoch_to, last.amount.0), (0, 0, 1200 * ONE));
    }

    #[test]
    fn many_epochs_one_log() {
        let mut c = setup();
        let logs_before = c.log.len();
        ctx(&user("anyone"), GENESIS_MS + 5 * EPOCH, NearToken::from_near(0));
        c.poke();
        let mut t = 60_000_000 * ONE;
        let mut burned = 0;
        for _ in 0..5 {
            let b = budget_for(t, 20);
            t -= b;
            burned += b;
        }
        assert_eq!(c.log.len(), logs_before + 1);
        let last = c.log.get(c.log.len() - 1).unwrap();
        assert_eq!((last.epoch_from, last.epoch_to, last.amount.0), (0, 4, burned));
        assert_eq!(c.get_stats().treasury.0, t);
    }

    #[test]
    fn cap_1000_resumes_on_next_poke() {
        let mut c = setup();
        ctx(&user("anyone"), GENESIS_MS + 2500 * EPOCH, NearToken::from_near(0));
        c.poke();
        let s = c.get_stats();
        assert_eq!((s.epoch_index, s.epoch_by_time), (1000, 2500));
        c.poke();
        c.poke();
        assert_eq!(c.get_stats().epoch_index, 2500);
    }

    #[test]
    fn faucet_rolls_epoch() {
        let mut c = setup();
        fund(&mut c, &user("alice"), GENESIS_MS + EPOCH);
        assert_eq!(c.get_stats().epoch_index, 1);
    }
}

pub mod appraisals {
    use super::*;
    use crate::data::{canonical_hash, normalize_lines, raw_hash, to_hex};
    use near_sdk::serde_json::{self, json};
    use near_sdk::PromiseResult;

    /// exec_deposit + storage_fee of `test_params`.
    pub fn op_deposit() -> NearToken {
        NearToken::from_millinear(150)
    }

    pub fn data5(tag: &str) -> String {
        (1..=5).map(|i| format!("{tag} line {i}")).collect::<Vec<_>>().join("\n")
    }

    pub fn hash_of(text: &str) -> String {
        to_hex(&raw_hash(&normalize_lines(text)))
    }

    pub fn ok_output(text: &str, price: u32) -> Vec<u8> {
        let out = json!({"v":1,"h":hash_of(text),"p":price,"r":"why","m":"model","c":"chat","a":"0xa","g":"sig","s":"cd".repeat(32)});
        serde_json::to_vec(&serde_json::Value::String(out.to_string())).unwrap()
    }

    /// The contract calling its own callback, with `result` as promise 0.
    pub fn callback_ctx(now_ms: u64, result: PromiseResult) {
        let mut b = VMContextBuilder::new();
        b.current_account_id(contract_id())
            .predecessor_account_id(contract_id())
            .signer_account_id(contract_id())
            .block_timestamp(now_ms * 1_000_000)
            .prepaid_gas(near_sdk::Gas::from_tgas(40));
        testing_env!(
            b.build(),
            near_sdk::test_vm_config(),
            near_sdk::RuntimeFeesConfig::test(),
            Default::default(),
            vec![result]
        );
    }

    /// Funded `who` appraises `text`; returns the appraisal id.
    pub fn appraise_as(c: &mut Contract, who: &AccountId, text: &str, now_ms: u64) -> u64 {
        ctx(who, now_ms, op_deposit());
        let _ = c.appraise(text.to_string());
        c.get_stats().appraisal_count - 1
    }

    /// Appraisal priced at `price`.
    pub fn priced(c: &mut Contract, who: &AccountId, text: &str, price: u32, now_ms: u64) -> u64 {
        let id = appraise_as(c, who, text, now_ms);
        callback_ctx(now_ms, PromiseResult::Successful(ok_output(text, price)));
        c.on_appraise_result(id);
        id
    }

    #[test]
    fn appraise_holds_fee() {
        let mut c = setup();
        let a = user("alice");
        fund(&mut c, &a, GENESIS_MS + 1);
        let id = appraise_as(&mut c, &a, &data5("menu"), GENESIS_MS + 2);
        assert_eq!(c.ft_balance_of(a.clone()).0, 490 * ONE);
        assert_eq!(c.get_stats().escrow.0, 10 * ONE);
        let ap = c.get_appraisal(id).unwrap();
        assert_eq!(ap.status, AppraisalStatus::Pending);
        assert_eq!(ap.owner, a);
        assert_eq!(ap.raw_hash, hash_of(&data5("menu")));
        assert_eq!(ap.canonical_hash, to_hex(&canonical_hash(&normalize_lines(&data5("menu")))));
    }

    #[test]
    #[should_panic(expected = "too_few_rows")]
    fn appraise_rejects_four_rows() {
        let mut c = setup();
        let a = user("alice");
        fund(&mut c, &a, GENESIS_MS + 1);
        appraise_as(&mut c, &a, "a\nb\nc\nd", GENESIS_MS + 2);
    }

    #[test]
    #[should_panic(expected = "too_large")]
    fn appraise_rejects_too_large() {
        let mut c = setup();
        let a = user("alice");
        fund(&mut c, &a, GENESIS_MS + 1);
        let text = format!("{}\n{}", data5("x"), "y".repeat(2001 - data5("x").len() - 1));
        assert_eq!(text.len(), 2001);
        appraise_as(&mut c, &a, &text, GENESIS_MS + 2);
    }

    #[test]
    #[should_panic(expected = "already_appraised")]
    fn appraise_rejects_same_data_while_pending() {
        let mut c = setup();
        let a = user("alice");
        fund(&mut c, &a, GENESIS_MS + 1);
        appraise_as(&mut c, &a, &data5("menu"), GENESIS_MS + 2);
        appraise_as(&mut c, &a, &data5("menu"), GENESIS_MS + 3);
    }

    #[test]
    #[should_panic(expected = "already_appraised")]
    fn appraise_rejects_reordered_data() {
        let mut c = setup();
        let a = user("alice");
        fund(&mut c, &a, GENESIS_MS + 1);
        let text = data5("menu");
        let mut lines: Vec<&str> = text.lines().collect();
        lines.reverse();
        priced(&mut c, &a, &text, 300, GENESIS_MS + 2);
        appraise_as(&mut c, &a, &lines.join("\n"), GENESIS_MS + 3);
    }

    #[test]
    #[should_panic(expected = "deposit_low")]
    fn appraise_rejects_low_deposit() {
        let mut c = setup();
        let a = user("alice");
        fund(&mut c, &a, GENESIS_MS + 1);
        ctx(&a, GENESIS_MS + 2, NearToken::from_millinear(149));
        let _ = c.appraise(data5("menu"));
    }

    #[test]
    fn appraise_success_burns() {
        let mut c = setup();
        let a = user("alice");
        fund(&mut c, &a, GENESIS_MS + 1);
        let id = priced(&mut c, &a, &data5("menu"), 300, GENESIS_MS + 2);
        let ap = c.get_appraisal(id).unwrap();
        assert_eq!((ap.status, ap.price), (AppraisalStatus::Priced, Some(300)));
        assert_eq!((ap.reason.as_str(), ap.chat_id.as_str(), ap.signature.as_str()), ("why", "chat", "sig"));
        assert_eq!(ap.priced_ms, Some(GENESIS_MS + 2));
        let s = c.get_stats();
        assert_eq!(s.total_supply.0, SUPPLY - 10 * ONE);
        assert_eq!(s.burned_total.0, 10 * ONE);
        assert_eq!(s.escrow.0, 0);
        let last = c.log.get(c.log.len() - 1).unwrap();
        assert!(matches!(last.kind, LogKind::BurnFee));
        assert_eq!((last.ref_id, last.amount.0), (Some(id), 10 * ONE));
    }

    #[test]
    fn appraise_success_stores_response_hash() {
        let mut c = setup();
        let a = user("alice");
        fund(&mut c, &a, GENESIS_MS + 1);
        let id = priced(&mut c, &a, &data5("menu"), 300, GENESIS_MS + 2);
        assert_eq!(c.get_appraisal(id).unwrap().response_hash, "cd".repeat(32));
    }

    #[test]
    fn appraise_failure_refunds() {
        let mut c = setup();
        let a = user("alice");
        fund(&mut c, &a, GENESIS_MS + 1);
        let id = appraise_as(&mut c, &a, &data5("menu"), GENESIS_MS + 2);
        callback_ctx(GENESIS_MS + 3, PromiseResult::Failed);
        c.on_appraise_result(id);
        assert_eq!(c.get_appraisal(id).unwrap().status, AppraisalStatus::Failed);
        assert_eq!(c.ft_balance_of(a.clone()).0, 500 * ONE);
        let s = c.get_stats();
        assert_eq!((s.total_supply.0, s.escrow.0), (SUPPLY, 0));
        let again = priced(&mut c, &a, &data5("menu"), 300, GENESIS_MS + 4);
        assert_eq!(c.get_appraisal(again).unwrap().status, AppraisalStatus::Priced);
    }

    #[test]
    fn appraise_bad_output_refunds() {
        let mut c = setup();
        let a = user("alice");
        fund(&mut c, &a, GENESIS_MS + 1);
        let id = appraise_as(&mut c, &a, &data5("menu"), GENESIS_MS + 2);
        callback_ctx(GENESIS_MS + 3, PromiseResult::Successful(ok_output(&data5("other"), 300)));
        c.on_appraise_result(id);
        assert_eq!(c.get_appraisal(id).unwrap().status, AppraisalStatus::Failed);
        assert_eq!(c.ft_balance_of(a).0, 500 * ONE);
        assert_eq!(c.get_stats().escrow.0, 0);
    }

    #[test]
    fn appraise_oversized_result_refunds() {
        let mut c = setup();
        let a = user("alice");
        fund(&mut c, &a, GENESIS_MS + 1);
        let id = appraise_as(&mut c, &a, &data5("menu"), GENESIS_MS + 2);
        callback_ctx(GENESIS_MS + 3, PromiseResult::Successful(vec![b' '; MAX_RESULT_BYTES + 1]));
        c.on_appraise_result(id);
        assert_eq!(c.get_appraisal(id).unwrap().status, AppraisalStatus::Failed);
    }
}

mod challenges;
mod views;
