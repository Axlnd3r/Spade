"""TAKSIR supply over time: a deterministic expected-value model (S4 Task 2).

Every epoch the contract sets a budget of `treasury * budget_ppm / 1e6`. It pays
rewards for caught challenges out of that budget and burns the rest when the
epoch closes. So the treasury drops by exactly one budget per epoch, whatever
happens in the epoch. Activity only decides how much of that budget is burned
and how much is paid out. Fees and lost stakes are burned on top of it.

Units are whole TAKSIR. The model uses expected values, not random draws, so
it gives the same numbers on every run.
"""
from dataclasses import dataclass, replace

# P(caught) per challenge, as (normal data, adversarial data), measured with a
# reordered variant in docs/EXPERIMENT.md (run 2026-11-11). Change these only
# after a new experiment.
CATCH = {
    7000: (0.156, 0.467),
    7500: (0.100, 0.467),
    8000: (0.056, 0.467),
    8500: (0.022, 0.467),
}

# Per appraisal (contract `max_challenges`).
MAX_CHALLENGES = 3

# NEAR a user pays net per appraise or challenge: storage_fee 0.05 plus the
# ~0.0011 OutLayer keeps (docs/TESTNET.md, e2e on v1). Gas not included.
NEAR_PER_OP = 0.0511

GRID = {
    "threshold_bps": [7000, 7500, 8000],
    "budget_ppm": [5, 10, 20, 50],
    "reward_multiplier": [2, 3, 4],
    "challenge_stake": [25, 50, 100],
    "appraisal_fee": [10, 25, 50],
}


@dataclass(frozen=True)
class Params:
    appraisal_fee: float = 10
    challenge_stake: float = 50
    reward_multiplier: int = 4
    threshold_bps: int = 7500
    budget_ppm: int = 20
    epoch_hours: float = 24.0
    treasury0: float = 60_000_000
    supply0: float = 100_000_000
    faucet0: float = 40_000_000


@dataclass(frozen=True)
class Scenario:
    name: str
    appraisals_per_day: float
    challenges_per_appraisal: float
    # None: read from CATCH at the threshold.
    catch_normal: float | None = None
    farming: bool = False
    catch_adv: float | None = None


@dataclass(frozen=True)
class Day:
    day: int
    supply: float
    treasury: float
    burned_total: float
    budget: float
    rewards_paid: float
    budget_burned: float
    attacker_reward: float
    attacker_net: float
    attacker_near: float


SCENARIOS = {
    "sepi": Scenario("sepi", 5, 0.2),
    "normal": Scenario("normal", 50, 1.0),
    "ai_buruk": Scenario("ai_buruk", 50, 1.0, catch_normal=0.40),
    "farming": Scenario("farming", 50, 1.0, farming=True),
}


def breakeven_q(p: Params) -> float:
    """P(caught) at which a challenge's expected value is zero (blueprint 2.4)."""
    return p.challenge_stake / (p.reward_multiplier * p.challenge_stake + p.challenge_stake)


def catch_rates(p: Params, s: Scenario) -> tuple[float, float]:
    q_normal, q_adv = CATCH[p.threshold_bps]
    return (q_normal if s.catch_normal is None else s.catch_normal,
            q_adv if s.catch_adv is None else s.catch_adv)


def farm_per_data(p: Params, q: float) -> tuple[float, float, float]:
    """(expected reward, expected TAKSIR cost, expected operations) for one adversarial appraisal.

    The attacker appraises its own data, then challenges it one at a time
    until a challenge is caught or `MAX_CHALLENGES` is reached. A caught
    challenge gets its stake back; a survived one burns it. Each challenge is
    assumed independent with the same q. q near 1 is the attacker who uses
    order-dependent data and only challenges once the injection fired (S4 review).
    Operations are the appraisal plus the challenges made, each paying NEAR_PER_OP.
    """
    reward = p.reward_multiplier * p.challenge_stake
    p_caught = 1 - (1 - q) ** MAX_CHALLENGES
    lost_stakes = sum((1 - q) ** k for k in range(1, MAX_CHALLENGES + 1))
    tries = sum((1 - q) ** k for k in range(MAX_CHALLENGES))
    return p_caught * reward, p.appraisal_fee + lost_stakes * p.challenge_stake, 1 + tries


def simulate(p: Params, s: Scenario, days: int = 60) -> list[Day]:
    epochs_per_day = round(24 / p.epoch_hours)
    q_normal, q_adv = catch_rates(p, s)
    adv_reward, adv_cost, adv_ops = farm_per_data(p, q_adv)
    appraisals = s.appraisals_per_day / epochs_per_day
    challenges = appraisals * s.challenges_per_appraisal

    supply, treasury, burned_total = p.supply0, p.treasury0, 0.0
    out = []
    for d in range(1, days + 1):
        t = dict(budget=0.0, rewards=0.0, burned=0.0, adv_reward=0.0, adv_net=0.0, adv_near=0.0)
        for _ in range(epochs_per_day):
            budget = treasury * p.budget_ppm / 1_000_000
            left = budget
            burn = appraisals * p.appraisal_fee

            if s.farming and adv_reward > adv_cost:
                # A profitable attacker challenges first in the epoch and keeps going until the budget
                # is gone; one that would lose per data stays out.
                taken = left
                n_data = taken / adv_reward
                left -= taken
                cost = n_data * adv_cost
                burn += cost
                t["adv_reward"] += taken
                t["adv_net"] += taken - cost
                t["adv_near"] += n_data * adv_ops * NEAR_PER_OP

            caught = q_normal * challenges
            paid = min(caught * p.reward_multiplier * p.challenge_stake, left)
            left -= paid
            burn += (1 - q_normal) * challenges * p.challenge_stake

            # Rewards leave the treasury for users; the unspent budget is burned.
            treasury -= budget
            burn += left
            supply -= burn
            burned_total += burn
            t["budget"] += budget
            t["rewards"] += budget - left
            t["burned"] += left
        out.append(Day(d, supply, treasury, burned_total, t["budget"], t["rewards"], t["burned"],
                       t["adv_reward"], t["adv_net"], t["adv_near"]))
    return out


def honest_paid_ratio(p: Params, s: Scenario, days: list[Day]) -> float:
    """Share of the rewards honest challengers earn that the budget actually pays (1.0 = all)."""
    q_normal, _ = catch_rates(p, s)
    demand = q_normal * s.challenges_per_appraisal * s.appraisals_per_day * p.reward_multiplier * p.challenge_stake
    paid = sum(d.rewards_paid - d.attacker_reward for d in days)
    return 1.0 if demand == 0 else paid / (demand * len(days))


def sweep(grid: dict[str, list], days: int = 60, epoch_hours: float = 24.0) -> list[dict]:
    """One row per combination: the normal scenario's end state, the farming attacker's daily net
    at the measured q and at q = 1 (the sure attacker), and what honest catchers get under farming."""
    import itertools

    rows = []
    for values in itertools.product(*grid.values()):
        p = Params(epoch_hours=epoch_hours, **dict(zip(grid.keys(), values)))
        normal_days = simulate(p, SCENARIOS["normal"], days)
        normal = normal_days[-1]
        farmed = simulate(p, SCENARIOS["farming"], days)
        sure = simulate(p, replace(SCENARIOS["farming"], catch_adv=1.0), days)
        rows.append(dict(
            zip(grid.keys(), values),
            supply_end=normal.supply,
            treasury_end=normal.treasury,
            burned_total=normal.burned_total,
            attacker_net_per_day=sum(d.attacker_net for d in farmed) / days,
            breakeven=breakeven_q(p),
            q_normal=CATCH[p.threshold_bps][0],
            honest_paid_ratio=honest_paid_ratio(p, SCENARIOS["normal"], normal_days),
            attacker_net_per_day_q1=sum(d.attacker_net for d in sure) / days,
            attacker_near_per_day_q1=sum(d.attacker_near for d in sure) / days,
            honest_paid_ratio_farming=honest_paid_ratio(p, SCENARIOS["farming"], farmed),
        ))
    return rows
