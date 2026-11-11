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

/// Registers `who` and gives it the faucet amount.
pub fn fund(c: &mut Contract, who: &AccountId, now_ms: u64) {
    ctx(who, now_ms, min_storage(c));
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
