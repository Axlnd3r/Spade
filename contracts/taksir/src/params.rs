use near_sdk::json_types::U128;
use near_sdk::{near, require, AccountId, NearToken};

/// Fixed at `new` and never written again (M-16, T-2).
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct Params {
    pub appraisal_fee: U128,
    pub challenge_stake: U128,
    pub reward_multiplier: u32,
    pub threshold_bps: u32,
    pub budget_ppm: u32,
    pub max_challenges: u32,
    pub faucet_amount: U128,
    pub epoch_ms: u64,
    pub challenge_window_ms: u64,
    pub min_rows: u32,
    pub max_rows: u32,
    pub max_data_bytes: u32,
    pub price_min: u32,
    pub price_max: u32,
    pub outlayer_id: AccountId,
    pub wasm_url: String,
    pub wasm_hash: String,
    pub secrets_profile: String,
    pub secrets_owner: AccountId,
    /// NEAR forwarded to OutLayer with every `request_execution`.
    pub exec_deposit: NearToken,
    /// Flat, non-refundable NEAR kept per appraisal or challenge to pay for its storage.
    pub storage_fee: NearToken,
}

impl Params {
    pub fn validate(&self) {
        let hex64 = self.wasm_hash.len() == 64
            && self.wasm_hash.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b));
        require!(
            self.price_min >= 1
                && self.price_min <= self.price_max
                && (1..=9999).contains(&self.threshold_bps)
                && self.epoch_ms > 0
                && self.min_rows >= 1
                && self.min_rows <= self.max_rows
                && self.budget_ppm <= 1_000_000
                && self.max_challenges >= 1
                && hex64,
            "bad_params"
        );
    }
}
