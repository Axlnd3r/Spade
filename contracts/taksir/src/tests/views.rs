use super::appraisals::*;
use super::challenges::*;
use super::*;
use near_sdk::PromiseResult;

/// I-2: every token is on a known account, and the contract's own balance is
/// exactly treasury + faucet pool + escrow.
fn assert_invariants(c: &Contract, accounts: &[AccountId]) {
    let users: u128 = accounts.iter().map(|a| c.ft_balance_of(a.clone()).0).sum();
    let mine = c.ft_balance_of(contract_id()).0;
    let s = c.get_stats();
    assert_eq!(users + mine, s.total_supply.0, "I-2: supply == sum of balances");
    assert_eq!(mine, s.treasury.0 + s.faucet_pool.0 + s.escrow.0, "I-2: contract == treasury + faucet + escrow");
}

#[test]
fn appraisals_paged() {
    let mut c = setup();
    let a = user("alice");
    fund(&mut c, &a, GENESIS_MS + 1);
    for tag in ["one", "two", "three"] {
        appraise_as(&mut c, &a, &data5(tag), GENESIS_MS + 2);
    }
    let ids = |v: Vec<Appraisal>| v.into_iter().map(|a| a.id).collect::<Vec<_>>();
    assert_eq!(ids(c.get_appraisals(1, 10)), vec![1, 2]);
    assert_eq!(ids(c.get_appraisals(0, 2)), vec![0, 1]);
    assert!(c.get_appraisals(5, 10).is_empty());
    assert!(c.get_appraisals(u64::MAX, 10).is_empty());
}

#[test]
fn log_paged_and_capped_at_100() {
    let mut c = setup();
    for i in 0..120 {
        fund(&mut c, &user(&format!("u{i}")), GENESIS_MS + 1);
    }
    assert_eq!(c.get_log(0, 1000).len(), 100);
    assert_eq!(c.get_log(118, 10).len(), 3);
    assert!(c.get_log(121, 10).is_empty());
    assert!(matches!(c.get_log(0, 1)[0].kind, LogKind::Mint));
}

#[test]
fn challenges_of_appraisal() {
    let mut c = setup();
    let (a, b) = (user("alice"), user("bob"));
    fund(&mut c, &a, GENESIS_MS + 1);
    fund(&mut c, &b, GENESIS_MS + 2);
    let text = data5("menu");
    let other = priced(&mut c, &a, &data5("other"), 100, GENESIS_MS + 3);
    let id = priced(&mut c, &a, &text, 100, GENESIS_MS + 4);
    challenge_as(&mut c, &b, other, &rotated(&data5("other"), 1), GENESIS_MS + 5);
    let c1 = challenge_as(&mut c, &b, id, &rotated(&text, 1), GENESIS_MS + 6);
    let c2 = challenge_as(&mut c, &b, id, &rotated(&text, 2), GENESIS_MS + 7);
    let got: Vec<u64> = c.get_challenges(id).into_iter().map(|ch| ch.id).collect();
    assert_eq!(got, vec![c1, c2]);
    assert!(c.get_challenges(99).is_empty());
}

#[test]
fn invariants_hold_through_flows() {
    let mut c = setup();
    let (a, b) = (user("alice"), user("bob"));
    let all = [a.clone(), b.clone()];
    let mut treasury = c.get_stats().treasury.0;
    // Steps that must not touch the treasury (I-4).
    let mut step = |c: &Contract, may_drop: bool| {
        assert_invariants(c, &all);
        let t = c.get_stats().treasury.0;
        if !may_drop {
            assert_eq!(t, treasury, "I-4: treasury moved outside reward/epoch burn");
        }
        assert!(t <= treasury);
        treasury = t;
    };
    step(&c, false);
    fund(&mut c, &a, GENESIS_MS + 1);
    step(&c, false);
    fund(&mut c, &b, GENESIS_MS + 2);
    step(&c, false);

    let t1 = data5("menu");
    let id1 = priced(&mut c, &a, &t1, 100, GENESIS_MS + 3);
    step(&c, false);
    let failed = appraise_as(&mut c, &a, &data5("lost"), GENESIS_MS + 4);
    step(&c, false);
    callback_ctx(GENESIS_MS + 5, PromiseResult::Failed);
    c.on_appraise_result(failed);
    step(&c, false);

    let v = rotated(&t1, 1);
    let caught = challenge_as(&mut c, &b, id1, &v, GENESIS_MS + 6);
    step(&c, false);
    resolve(&mut c, caught, priced_result(&v, 9000), GENESIS_MS + 7);
    step(&c, true);

    let t2 = data5("schedule");
    let id2 = priced(&mut c, &a, &t2, 100, GENESIS_MS + 8);
    let v2 = rotated(&t2, 1);
    let survived = challenge_as(&mut c, &b, id2, &v2, GENESIS_MS + 9);
    resolve(&mut c, survived, priced_result(&v2, 100), GENESIS_MS + 10);
    step(&c, false);
    let v3 = rotated(&t2, 2);
    let lost = challenge_as(&mut c, &b, id2, &v3, GENESIS_MS + 11);
    resolve(&mut c, lost, PromiseResult::Failed, GENESIS_MS + 12);
    step(&c, false);

    ctx(&a, GENESIS_MS + 3 * 600_000, NearToken::from_near(0));
    c.poke();
    step(&c, true);
    assert_eq!(c.get_stats().escrow.0, 0, "I-5: nothing left in escrow");
    assert!(c.ft_total_supply().0 < SUPPLY, "I-1");
}
