//! M-13..M-15: lazy epochs, per-epoch budget, burning the unused budget, streak.

use near_sdk::near;

/// M-14: at most this many epochs are closed per call; later calls resume.
pub const MAX_EPOCH_STEPS: u64 = 1000;

#[near(serializers = [borsh])]
#[derive(Clone, Debug, PartialEq)]
pub struct EpochState {
    pub index: u64,
    pub budget: u128,
    pub budget_left: u128,
    /// Challenges resolved (Caught or Survived) in this epoch.
    pub challenges: u32,
    pub catches: u32,
}

#[near(serializers = [borsh])]
#[derive(Clone, Debug, PartialEq)]
pub struct Streak {
    pub clean: u32,
    pub best: u32,
}

pub fn epoch_at(now_ms: u64, genesis_ms: u64, epoch_ms: u64) -> u64 {
    now_ms.saturating_sub(genesis_ms) / epoch_ms
}

pub fn budget_for(treasury: u128, budget_ppm: u32) -> u128 {
    treasury * budget_ppm as u128 / 1_000_000
}

/// Closes epochs one by one until `e.index == target` or `MAX_EPOCH_STEPS`
/// were closed. Each close applies M-15 to the streak, burns the unused budget
/// from `treasury`, and opens the next epoch with a fresh budget (M-14).
/// Returns `(first_closed, last_closed, total_burned)`, or `None` if nothing closed.
pub fn advance(
    e: &mut EpochState,
    s: &mut Streak,
    treasury: &mut u128,
    target: u64,
    budget_ppm: u32,
) -> Option<(u64, u64, u128)> {
    let first = e.index;
    let mut burned = 0;
    let mut steps = 0;
    while e.index < target && steps < MAX_EPOCH_STEPS {
        if e.catches > 0 {
            s.clean = 0;
        } else if e.challenges > 0 {
            s.clean += 1;
            s.best = s.best.max(s.clean);
        }
        *treasury -= e.budget_left;
        burned += e.budget_left;
        e.index += 1;
        e.budget = budget_for(*treasury, budget_ppm);
        e.budget_left = e.budget;
        e.challenges = 0;
        e.catches = 0;
        steps += 1;
    }
    (steps > 0).then(|| (first, e.index - 1, burned))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn epoch_index() {
        assert_eq!(epoch_at(1_000 + 1_199_999, 1_000, 600_000), 1);
        assert_eq!(epoch_at(1_000, 1_000, 600_000), 0);
    }

    fn closing(challenges: u32, catches: u32) -> (EpochState, Streak, u128) {
        let e = EpochState { index: 0, budget: 10, budget_left: 10, challenges, catches };
        (e, Streak { clean: 2, best: 5 }, 1_000_000)
    }

    #[test]
    fn clean_epoch_raises_streak() {
        let (mut e, mut s, mut t) = closing(2, 0);
        advance(&mut e, &mut s, &mut t, 1, 20);
        assert_eq!((s.clean, s.best), (3, 5));
    }

    #[test]
    fn quiet_epoch_keeps_streak() {
        let (mut e, mut s, mut t) = closing(0, 0);
        advance(&mut e, &mut s, &mut t, 1, 20);
        assert_eq!((s.clean, s.best), (2, 5));
    }

    #[test]
    fn caught_epoch_resets_streak() {
        let (mut e, mut s, mut t) = closing(3, 1);
        advance(&mut e, &mut s, &mut t, 1, 20);
        assert_eq!((s.clean, s.best), (0, 5));
    }

    #[test]
    fn best_streak_follows_clean() {
        let mut e = EpochState { index: 0, budget: 0, budget_left: 0, challenges: 1, catches: 0 };
        let mut s = Streak { clean: 5, best: 5 };
        let mut t = 0;
        advance(&mut e, &mut s, &mut t, 1, 20);
        assert_eq!((s.clean, s.best), (6, 6));
    }

    #[test]
    fn advance_burns_and_resets() {
        let (mut e, mut s, mut t) = closing(2, 0);
        let r = advance(&mut e, &mut s, &mut t, 3, 20);
        // epoch 0 burns its 10 left; epochs 1 and 2 burn their fresh budgets.
        let b1 = budget_for(1_000_000 - 10, 20);
        let b2 = budget_for(1_000_000 - 10 - b1, 20);
        assert_eq!(r, Some((0, 2, 10 + b1 + b2)));
        assert_eq!(t, 1_000_000 - 10 - b1 - b2);
        assert_eq!((e.index, e.challenges, e.catches), (3, 0, 0));
        assert_eq!(e.budget, budget_for(t, 20));
        assert_eq!(e.budget_left, e.budget);
    }

    #[test]
    fn advance_noop_at_target() {
        let (mut e, mut s, mut t) = closing(2, 0);
        assert_eq!(advance(&mut e, &mut s, &mut t, 0, 20), None);
        assert_eq!(e.index, 0);
    }

    #[test]
    fn advance_caps_at_1000_steps() {
        let mut e = EpochState { index: 0, budget: 0, budget_left: 0, challenges: 0, catches: 0 };
        let mut s = Streak { clean: 0, best: 0 };
        let mut t = 0;
        advance(&mut e, &mut s, &mut t, 2500, 20);
        assert_eq!(e.index, MAX_EPOCH_STEPS);
    }
}
