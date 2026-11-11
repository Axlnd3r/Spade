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

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum AppraisalStatus {
    Pending,
    Priced,
    Caught,
    Failed,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Appraisal {
    pub id: u64,
    pub owner: AccountId,
    /// Normalized lines joined with "\n": exactly what the enclave saw.
    pub data: String,
    pub raw_hash: String,
    pub canonical_hash: String,
    pub status: AppraisalStatus,
    pub price: Option<u32>,
    pub reason: String,
    pub model: String,
    pub chat_id: String,
    pub signing_address: String,
    pub signature: String,
    pub created_ms: u64,
    pub priced_ms: Option<u64>,
    /// Challenges that count toward `max_challenges`: pending or resolved, not failed.
    pub active_challenges: u32,
    pub challenge_ids: Vec<u64>,
}
