//! TAKSIR × SIDAK contract. Rules are numbered as in the blueprint (README.md §2).
//! All tokens the contract holds (treasury, faucet pool, escrow) sit on its own
//! FT account; the counters below say which part is which (I-2).

mod data;
mod epoch;
mod params;
mod types;

pub use params::Params;
pub use types::{LogEntry, LogKind, Stats};

use epoch::{EpochState, Streak};

use near_contract_standards::fungible_token::core::FungibleTokenCore;
use near_contract_standards::fungible_token::events::{FtBurn, FtMint};
use near_contract_standards::fungible_token::metadata::{
    FungibleTokenMetadata, FungibleTokenMetadataProvider, FT_METADATA_SPEC,
};
use near_contract_standards::fungible_token::resolver::FungibleTokenResolver;
use near_contract_standards::fungible_token::FungibleToken;
use near_contract_standards::storage_management::{
    StorageBalance, StorageBalanceBounds, StorageManagement,
};
use near_sdk::collections::LazyOption;
use near_sdk::json_types::U128;
use near_sdk::store::{LookupSet, Vector};
use near_sdk::{
    env, near, require, AccountId, BorshStorageKey, NearToken, PanicOnDefault, Promise,
    PromiseOrValue,
};

const ONE_TOKEN: u128 = 1_000_000_000_000_000_000;
const TOTAL_SUPPLY: u128 = 100_000_000 * ONE_TOKEN;
const TREASURY_SHARE: u128 = 60_000_000 * ONE_TOKEN;

#[derive(BorshStorageKey)]
#[near]
enum StorageKey {
    Token,
    Metadata,
    FaucetClaimed,
    Log,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    token: FungibleToken,
    metadata: LazyOption<FungibleTokenMetadata>,
    params: Params,
    treasury: u128,
    faucet_pool: u128,
    /// Fees and stakes held while their enclave call is in flight.
    escrow: u128,
    faucet_claimed: LookupSet<AccountId>,
    burned_total: u128,
    log: Vector<LogEntry>,
    genesis_ms: u64,
    epoch: EpochState,
    streak: Streak,
}

#[near]
impl Contract {
    #[init]
    pub fn new(params: Params) -> Self {
        params.validate();
        let me = env::current_account_id();
        let metadata = FungibleTokenMetadata {
            spec: FT_METADATA_SPEC.to_string(),
            name: "TAKSIR".to_string(),
            symbol: "TAKSIR".to_string(),
            icon: None,
            reference: None,
            reference_hash: None,
            decimals: 18,
        };
        let mut this = Self {
            token: FungibleToken::new(StorageKey::Token),
            metadata: LazyOption::new(StorageKey::Metadata, Some(&metadata)),
            params,
            treasury: TREASURY_SHARE,
            faucet_pool: TOTAL_SUPPLY - TREASURY_SHARE,
            escrow: 0,
            faucet_claimed: LookupSet::new(StorageKey::FaucetClaimed),
            burned_total: 0,
            log: Vector::new(StorageKey::Log),
            genesis_ms: env::block_timestamp_ms(),
            epoch: EpochState { index: 0, budget: 0, budget_left: 0, challenges: 0, catches: 0 },
            streak: Streak { clean: 0, best: 0 },
        };
        this.epoch.budget = epoch::budget_for(this.treasury, this.params.budget_ppm);
        this.epoch.budget_left = this.epoch.budget;
        // M-1: the only mint, ever.
        this.token.internal_register_account(&me);
        this.token.internal_deposit(&me, TOTAL_SUPPLY);
        FtMint { owner_id: &me, amount: U128(TOTAL_SUPPLY), memo: Some("genesis") }.emit();
        this.push_log(LogKind::Mint, None, TOTAL_SUPPLY, None);
        this
    }

    /// M-3: one `faucet_amount` per account. Registers storage (NEP-145) when needed.
    #[payable]
    pub fn faucet(&mut self) -> U128 {
        self.touch_epoch();
        let who = env::predecessor_account_id();
        let amount = self.params.faucet_amount.0;
        require!(!self.faucet_claimed.contains(&who), "faucet_claimed");
        require!(self.faucet_pool >= amount, "faucet_empty");
        let mut refund = env::attached_deposit();
        if self.token.accounts.get(&who).is_none() {
            let min = self.storage_balance_bounds().min;
            require!(refund >= min, "deposit_low");
            self.token.internal_register_account(&who);
            refund = refund.saturating_sub(min);
        }
        self.faucet_claimed.insert(who.clone());
        self.faucet_pool -= amount;
        self.pay_from_contract(&who, amount);
        self.push_log(LogKind::Faucet, Some(who.clone()), amount, None);
        refund_near(&who, refund);
        U128(amount)
    }

    /// M-13: anyone can roll pending epochs forward.
    pub fn poke(&mut self) {
        self.touch_epoch();
    }

    pub fn get_params(&self) -> Params {
        self.params.clone()
    }

    pub fn get_stats(&self) -> Stats {
        Stats {
            total_supply: U128(self.token.total_supply),
            burned_total: U128(self.burned_total),
            treasury: U128(self.treasury),
            faucet_pool: U128(self.faucet_pool),
            escrow: U128(self.escrow),
            epoch_index: self.epoch.index,
            epoch_by_time: self.epoch_by_time(),
            budget: U128(self.epoch.budget),
            budget_left: U128(self.epoch.budget_left),
            epoch_challenges: self.epoch.challenges,
            epoch_catches: self.epoch.catches,
            clean_streak: self.streak.clean,
            best_streak: self.streak.best,
            appraisal_count: 0,
            challenge_count: 0,
            log_count: self.log.len() as u64,
        }
    }
}

// Internal money movements. Every token that leaves the contract account goes
// through one of these, so the log and `burned_total` stay complete.
impl Contract {
    fn current_epoch(&self) -> u64 {
        self.epoch.index
    }

    fn epoch_by_time(&self) -> u64 {
        epoch::epoch_at(env::block_timestamp_ms(), self.genesis_ms, self.params.epoch_ms)
    }

    /// M-13/M-14: runs first in every state-changing method. Burns the unused
    /// budgets of all epochs closed by this call as one `BurnEpoch` entry.
    fn touch_epoch(&mut self) {
        let target = self.epoch_by_time();
        let closed = epoch::advance(
            &mut self.epoch,
            &mut self.streak,
            &mut self.treasury,
            target,
            self.params.budget_ppm,
        );
        if let Some((from, to, total)) = closed {
            if total > 0 {
                self.burn_tokens(total, LogKind::BurnEpoch.as_str());
                self.push_log_range(LogKind::BurnEpoch, None, total, None, from, to);
            }
        }
    }

    fn push_log(&mut self, kind: LogKind, account_id: Option<AccountId>, amount: u128, ref_id: Option<u64>) {
        let e = self.current_epoch();
        self.push_log_range(kind, account_id, amount, ref_id, e, e);
    }

    fn push_log_range(
        &mut self,
        kind: LogKind,
        account_id: Option<AccountId>,
        amount: u128,
        ref_id: Option<u64>,
        epoch_from: u64,
        epoch_to: u64,
    ) {
        self.log.push(LogEntry {
            kind,
            account_id,
            amount: U128(amount),
            ref_id,
            epoch_from,
            epoch_to,
            ts_ms: env::block_timestamp_ms(),
        });
    }

    #[allow(dead_code)]
    fn burn_from_contract(&mut self, amount: u128, kind: LogKind, account_id: Option<AccountId>, ref_id: Option<u64>) {
        self.burn_tokens(amount, kind.as_str());
        self.push_log(kind, account_id, amount, ref_id);
    }

    fn burn_tokens(&mut self, amount: u128, memo: &str) {
        let me = env::current_account_id();
        self.token.internal_withdraw(&me, amount);
        self.burned_total += amount;
        FtBurn { owner_id: &me, amount: U128(amount), memo: Some(memo) }.emit();
    }

    fn pay_from_contract(&mut self, to: &AccountId, amount: u128) {
        self.token.internal_transfer(&env::current_account_id(), to, amount, None);
    }

    #[allow(dead_code)]
    fn take_from_user(&mut self, from: &AccountId, amount: u128) {
        self.token.internal_transfer(from, &env::current_account_id(), amount, None);
    }
}

fn refund_near(to: &AccountId, amount: NearToken) {
    if !amount.is_zero() {
        Promise::new(to.clone()).transfer(amount).detach();
    }
}

#[near]
impl FungibleTokenCore for Contract {
    /// Tokens sent straight to the contract would sit outside treasury,
    /// faucet pool and escrow and break I-2, so they are refused.
    #[payable]
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>) {
        require!(receiver_id != env::current_account_id(), "transfer_to_contract");
        self.token.ft_transfer(receiver_id, amount, memo)
    }

    #[payable]
    fn ft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        amount: U128,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<U128> {
        require!(receiver_id != env::current_account_id(), "transfer_to_contract");
        self.token.ft_transfer_call(receiver_id, amount, memo, msg)
    }

    fn ft_total_supply(&self) -> U128 {
        self.token.ft_total_supply()
    }

    fn ft_balance_of(&self, account_id: AccountId) -> U128 {
        self.token.ft_balance_of(account_id)
    }
}

#[near]
impl FungibleTokenResolver for Contract {
    #[private]
    fn ft_resolve_transfer(&mut self, sender_id: AccountId, receiver_id: AccountId, amount: U128) -> U128 {
        let (used, burned) = self.token.internal_ft_resolve_transfer(&sender_id, receiver_id, amount);
        // Only reachable if the sender unregistered mid-call, which
        // `storage_unregister` forbids; counted anyway so I-1 bookkeeping holds.
        self.burned_total += burned;
        used.into()
    }
}

#[near]
impl StorageManagement for Contract {
    #[payable]
    fn storage_deposit(&mut self, account_id: Option<AccountId>, registration_only: Option<bool>) -> StorageBalance {
        self.token.storage_deposit(account_id, registration_only)
    }

    #[payable]
    fn storage_withdraw(&mut self, amount: Option<NearToken>) -> StorageBalance {
        self.token.storage_withdraw(amount)
    }

    /// Disabled: a refund or reward to an unregistered account would panic
    /// inside a callback and leave its escrow stuck forever.
    #[payable]
    fn storage_unregister(&mut self, force: Option<bool>) -> bool {
        let _ = force;
        env::panic_str("unregister_disabled")
    }

    fn storage_balance_bounds(&self) -> StorageBalanceBounds {
        self.token.storage_balance_bounds()
    }

    fn storage_balance_of(&self, account_id: AccountId) -> Option<StorageBalance> {
        self.token.storage_balance_of(account_id)
    }
}

#[near]
impl FungibleTokenMetadataProvider for Contract {
    fn ft_metadata(&self) -> FungibleTokenMetadata {
        self.metadata.get().unwrap()
    }
}

#[cfg(test)]
mod tests;
