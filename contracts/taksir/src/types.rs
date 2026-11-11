use near_sdk::json_types::U128;
use near_sdk::{near, AccountId};

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum LogKind {
    Mint,
    BurnFee,
    BurnStake,
    BurnEpoch,
    Reward,
    Faucet,
}

impl LogKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            LogKind::Mint => "mint",
            LogKind::BurnFee => "burn_fee",
            LogKind::BurnStake => "burn_stake",
            LogKind::BurnEpoch => "burn_epoch",
            LogKind::Reward => "reward",
            LogKind::Faucet => "faucet",
        }
    }
}

/// One supply or treasury movement, for the Log page (T-5).
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct LogEntry {
    pub kind: LogKind,
    pub account_id: Option<AccountId>,
    pub amount: U128,
    pub ref_id: Option<u64>,
    pub epoch_from: u64,
    pub epoch_to: u64,
    pub ts_ms: u64,
}

#[near(serializers = [json])]
#[derive(Debug)]
pub struct Stats {
    pub total_supply: U128,
    pub burned_total: U128,
    pub treasury: U128,
    pub faucet_pool: U128,
    pub escrow: U128,
    pub epoch_index: u64,
    pub epoch_by_time: u64,
    pub budget: U128,
    pub budget_left: U128,
    pub epoch_challenges: u32,
    pub epoch_catches: u32,
    pub clean_streak: u32,
    pub best_streak: u32,
    pub appraisal_count: u64,
    pub challenge_count: u64,
    pub log_count: u64,
}
