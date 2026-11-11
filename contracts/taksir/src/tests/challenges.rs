use super::appraisals::*;
use super::*;
use near_sdk::PromiseResult;

fn reversed(text: &str) -> String {
    let mut lines: Vec<&str> = text.lines().collect();
    lines.reverse();
    lines.join("\n")
}

/// The `k`-th rotation of `text`'s lines: same lines, different order.
pub fn rotated(text: &str, k: usize) -> String {
    let mut lines: Vec<&str> = text.lines().collect();
    lines.rotate_left(k);
    lines.join("\n")
}

pub fn challenge_as(c: &mut Contract, who: &AccountId, id: u64, variant: &str, now_ms: u64) -> u64 {
    ctx(who, now_ms, op_deposit());
    let _ = c.challenge(id, variant.to_string());
    c.get_stats().challenge_count - 1
}

pub fn resolve(c: &mut Contract, cid: u64, result: PromiseResult, now_ms: u64) {
    callback_ctx(now_ms, result);
    c.on_challenge_result(cid);
}

pub fn priced_result(variant: &str, price: u32) -> PromiseResult {
    PromiseResult::Successful(ok_output(variant, price))
}

/// Alice's data priced at `p1`, Bob funded; returns (contract, appraisal id, text, bob).
fn scene_with(p: Params, p1: u32) -> (Contract, u64, String, AccountId) {
    let mut c = setup_with(p);
    let (a, b) = (user("alice"), user("bob"));
    fund(&mut c, &a, GENESIS_MS + 1);
    fund(&mut c, &b, GENESIS_MS + 2);
    let text = data5("menu");
    let id = priced(&mut c, &a, &text, p1, GENESIS_MS + 3);
    (c, id, text, b)
}

fn scene(p1: u32) -> (Contract, u64, String, AccountId) {
    scene_with(test_params(), p1)
}

#[test]
fn caught_boundary() {
    assert!(!is_caught(100, 400, 7500));
    assert!(is_caught(100, 401, 7500));
    assert!(is_caught(401, 100, 7500));
    assert!(!is_caught(7, 7, 7500));
    assert!(is_caught(10_000, 1, 7500));
}

#[test]
#[should_panic(expected = "not_priced")]
fn challenge_rejects_pending_appraisal() {
    let mut c = setup();
    let (a, b) = (user("alice"), user("bob"));
    fund(&mut c, &a, GENESIS_MS + 1);
    fund(&mut c, &b, GENESIS_MS + 2);
    let id = appraise_as(&mut c, &a, &data5("menu"), GENESIS_MS + 3);
    challenge_as(&mut c, &b, id, &reversed(&data5("menu")), GENESIS_MS + 4);
}

#[test]
#[should_panic(expected = "window_closed")]
fn challenge_rejects_after_window() {
    let (mut c, id, text, b) = scene(100);
    challenge_as(&mut c, &b, id, &reversed(&text), GENESIS_MS + 3 + 3_600_001);
}

#[test]
fn challenge_allowed_at_window_end() {
    let (mut c, id, text, b) = scene(100);
    challenge_as(&mut c, &b, id, &reversed(&text), GENESIS_MS + 3 + 3_600_000);
}

#[test]
#[should_panic(expected = "max_challenges")]
fn fourth_pending_challenge_rejected() {
    let (mut c, id, text, b) = scene(100);
    for k in 1..=4 {
        challenge_as(&mut c, &b, id, &rotated(&text, k), GENESIS_MS + 10 + k as u64);
    }
}

#[test]
#[should_panic(expected = "not_equivalent")]
fn variant_with_other_lines_rejected() {
    let (mut c, id, _, b) = scene(100);
    challenge_as(&mut c, &b, id, &data5("other"), GENESIS_MS + 10);
}

#[test]
#[should_panic(expected = "same_order")]
fn variant_in_same_order_rejected() {
    let (mut c, id, text, b) = scene(100);
    challenge_as(&mut c, &b, id, &text.replace('\n', "\r\n"), GENESIS_MS + 10);
}

#[test]
fn challenge_holds_stake() {
    let (mut c, id, text, b) = scene(100);
    let cid = challenge_as(&mut c, &b, id, &reversed(&text), GENESIS_MS + 10);
    assert_eq!(c.ft_balance_of(b.clone()).0, 450 * ONE);
    assert_eq!(c.get_stats().escrow.0, 50 * ONE);
    let ap = c.get_appraisal(id).unwrap();
    assert_eq!((ap.active_challenges, ap.challenge_ids), (1, vec![cid]));
}

#[test]
#[should_panic(expected = "not_priced")]
fn challenge_caught() {
    let (mut c, id, text, b) = scene(100);
    let variant = reversed(&text);
    let cid = challenge_as(&mut c, &b, id, &variant, GENESIS_MS + 10);
    let treasury = c.get_stats().treasury.0;
    resolve(&mut c, cid, priced_result(&variant, 401), GENESIS_MS + 11);
    assert_eq!(c.ft_balance_of(b.clone()).0, 700 * ONE);
    let s = c.get_stats();
    assert_eq!(s.treasury.0, treasury - 200 * ONE);
    assert_eq!(s.total_supply.0, SUPPLY - 10 * ONE);
    assert_eq!((s.epoch_challenges, s.epoch_catches, s.escrow.0), (1, 1, 0));
    assert_eq!(c.get_appraisal(id).unwrap().status, AppraisalStatus::Caught);
    let ch = c.challenges.get(cid as u32).unwrap();
    assert_eq!((ch.status, ch.price, ch.reward.0), (ChallengeStatus::Caught, Some(401), 200 * ONE));
    let last = c.log.get(c.log.len() - 1).unwrap();
    assert!(matches!(last.kind, LogKind::Reward));
    assert_eq!((last.amount.0, last.ref_id), (200 * ONE, Some(cid)));
    challenge_as(&mut c, &b, id, &rotated(&text, 1), GENESIS_MS + 12);
}

#[test]
fn challenge_survived_burns_stake() {
    let (mut c, id, text, b) = scene(100);
    let variant = reversed(&text);
    let cid = challenge_as(&mut c, &b, id, &variant, GENESIS_MS + 10);
    resolve(&mut c, cid, priced_result(&variant, 400), GENESIS_MS + 11);
    assert_eq!(c.ft_balance_of(b).0, 450 * ONE);
    let s = c.get_stats();
    assert_eq!(s.total_supply.0, SUPPLY - 60 * ONE);
    assert_eq!((s.epoch_challenges, s.epoch_catches, s.escrow.0), (1, 0, 0));
    assert_eq!(c.challenges.get(cid as u32).unwrap().status, ChallengeStatus::Survived);
    assert_eq!(c.get_appraisal(id).unwrap().status, AppraisalStatus::Priced);
    let last = c.log.get(c.log.len() - 1).unwrap();
    assert!(matches!(last.kind, LogKind::BurnStake));
    assert_eq!((last.amount.0, last.ref_id), (50 * ONE, Some(cid)));
}

#[test]
fn challenge_failed_refunds_and_frees_slot() {
    let (mut c, id, text, b) = scene(100);
    let cid = challenge_as(&mut c, &b, id, &reversed(&text), GENESIS_MS + 10);
    resolve(&mut c, cid, PromiseResult::Failed, GENESIS_MS + 11);
    assert_eq!(c.ft_balance_of(b).0, 500 * ONE);
    let s = c.get_stats();
    assert_eq!((s.epoch_challenges, s.epoch_catches, s.escrow.0), (0, 0, 0));
    assert_eq!(s.total_supply.0, SUPPLY - 10 * ONE);
    assert_eq!(c.challenges.get(cid as u32).unwrap().status, ChallengeStatus::Failed);
    assert_eq!(c.get_appraisal(id).unwrap().active_challenges, 0);
}

#[test]
fn challenge_bad_output_counts_as_failed() {
    let (mut c, id, text, b) = scene(100);
    let cid = challenge_as(&mut c, &b, id, &reversed(&text), GENESIS_MS + 10);
    // Reply hashed over the original order, not the variant that was sent.
    resolve(&mut c, cid, priced_result(&text, 9000), GENESIS_MS + 11);
    assert_eq!(c.challenges.get(cid as u32).unwrap().status, ChallengeStatus::Failed);
    assert_eq!(c.ft_balance_of(b).0, 500 * ONE);
}

#[test]
fn reward_capped_by_budget() {
    // 60M treasury * 1 ppm = 60 TAKSIR budget for epoch 0.
    let (mut c, id, text, b) = scene_with(Params { budget_ppm: 1, ..test_params() }, 100);
    let v1 = reversed(&text);
    let cid = challenge_as(&mut c, &b, id, &v1, GENESIS_MS + 10);
    resolve(&mut c, cid, priced_result(&v1, 9000), GENESIS_MS + 11);
    assert_eq!(c.ft_balance_of(b.clone()).0, 560 * ONE);
    assert_eq!(c.get_stats().budget_left.0, 0);

    let a = user("alice");
    let text2 = data5("schedule");
    let id2 = priced(&mut c, &a, &text2, 100, GENESIS_MS + 12);
    let v2 = reversed(&text2);
    let logs_before = c.log.len();
    let cid2 = challenge_as(&mut c, &b, id2, &v2, GENESIS_MS + 13);
    resolve(&mut c, cid2, priced_result(&v2, 9000), GENESIS_MS + 14);
    assert_eq!(c.ft_balance_of(b).0, 560 * ONE);
    assert_eq!(c.challenges.get(cid2 as u32).unwrap().status, ChallengeStatus::Caught);
    assert_eq!(c.log.len(), logs_before, "no Reward entry for a zero reward");
}

#[test]
fn late_result_after_catch_is_voided() {
    let (mut c, id, text, b) = scene(100);
    let (v1, v2) = (rotated(&text, 1), rotated(&text, 2));
    let c1 = challenge_as(&mut c, &b, id, &v1, GENESIS_MS + 10);
    let c2 = challenge_as(&mut c, &b, id, &v2, GENESIS_MS + 11);
    resolve(&mut c, c1, priced_result(&v1, 9000), GENESIS_MS + 12);
    let treasury = c.get_stats().treasury.0;
    resolve(&mut c, c2, priced_result(&v2, 9000), GENESIS_MS + 13);
    assert_eq!(c.challenges.get(c2 as u32).unwrap().status, ChallengeStatus::Voided);
    assert_eq!(c.ft_balance_of(b).0, 700 * ONE);
    let s = c.get_stats();
    assert_eq!((s.treasury.0, s.epoch_challenges, s.epoch_catches, s.escrow.0), (treasury, 1, 1, 0));
}

#[test]
fn counted_in_epoch_of_result() {
    let (mut c, id, text, b) = scene(100);
    let variant = reversed(&text);
    let cid = challenge_as(&mut c, &b, id, &variant, GENESIS_MS + 10);
    resolve(&mut c, cid, priced_result(&variant, 400), GENESIS_MS + 600_000 + 5);
    let s = c.get_stats();
    assert_eq!((s.epoch_index, s.epoch_challenges), (1, 1));
    assert_eq!(s.clean_streak, 0, "epoch 0 had no resolved challenge: quiet");
}
