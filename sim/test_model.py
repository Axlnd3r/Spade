"""Tests for sim/model.py. Run: python -m unittest sim/test_model.py"""
import itertools
import os
import sys
import unittest
from dataclasses import replace

sys.path.insert(0, os.path.dirname(__file__))

from model import (CATCH, GRID, NEAR_PER_OP, SCENARIOS, Params, Scenario, breakeven_q, farm_per_data,  # noqa: E402
                   simulate, sweep)

QUIET = Scenario("quiet", appraisals_per_day=0, challenges_per_appraisal=0)


class ModelTest(unittest.TestCase):
    def test_breakeven_matches_blueprint(self):
        self.assertAlmostEqual(breakeven_q(Params()), 0.2, places=12)

    def test_catch_table_from_experiment(self):
        self.assertEqual(CATCH[7500], (0.100, 0.467))

    def test_quiet_burns_whole_budget(self):
        day = simulate(Params(), QUIET, days=1)[0]
        self.assertAlmostEqual(day.treasury, 60e6 * (1 - 20e-6), places=6)
        self.assertEqual(day.rewards_paid, 0)
        self.assertAlmostEqual(day.budget_burned, 1200, places=6)
        self.assertAlmostEqual(day.supply, 100e6 - 1200, places=6)

    def test_reward_capped_by_budget(self):
        busy = Scenario("busy", 1000, 1.0, catch_normal=1.0)
        for day in simulate(Params(), busy, days=10):
            self.assertAlmostEqual(day.rewards_paid, day.budget, places=6)
            self.assertAlmostEqual(day.budget_burned, 0, places=6)

    def test_supply_never_rises_and_never_negative(self):
        def check(p, s):
            prev_supply, prev_treasury = p.supply0, p.treasury0
            for day in simulate(p, s, days=60):
                self.assertLessEqual(day.supply, prev_supply + 1e-6, (p, s.name, day))
                self.assertLessEqual(day.treasury, prev_treasury + 1e-6, (p, s.name, day))
                self.assertGreaterEqual(day.supply, 0)
                self.assertGreaterEqual(day.treasury, 0)
                prev_supply, prev_treasury = day.supply, day.treasury

        grid = dict(GRID, budget_ppm=GRID["budget_ppm"] + [0, 1_000_000])
        for values in itertools.product(*grid.values()):
            p = Params(**dict(zip(grid.keys(), values)))
            for s in SCENARIOS.values():
                check(p, s)
        for s in SCENARIOS.values():
            check(Params(epoch_hours=1 / 6), s)

    def test_farming_capped_by_budget(self):
        for p in (Params(), Params(epoch_hours=1 / 6), Params(budget_ppm=50, reward_multiplier=2)):
            days = simulate(p, SCENARIOS["farming"], days=60)
            for day in days:
                self.assertLessEqual(day.attacker_reward, day.budget + 1e-6)
                self.assertLessEqual(day.rewards_paid, day.budget + 1e-6)
            self.assertTrue(any(d.attacker_reward > 0 for d in days))

    def test_farming_unprofitable_below_breakeven(self):
        p = Params()
        q = breakeven_q(p) - 0.05
        reward, cost, _ = farm_per_data(p, q)
        self.assertLess(reward - cost, 0)
        # A rational attacker then stays out: no reward taken, nothing lost.
        for day in simulate(p, replace(SCENARIOS["farming"], catch_adv=q), days=10):
            self.assertEqual((day.attacker_reward, day.attacker_net), (0, 0))

    def test_farming_drains_treasury_the_same_and_displaces_honest_rewards(self):
        p = Params()
        normal = simulate(p, SCENARIOS["normal"])
        farmed = simulate(p, SCENARIOS["farming"])
        self.assertAlmostEqual(normal[-1].treasury, farmed[-1].treasury, places=6)
        for day in farmed:
            self.assertAlmostEqual(day.rewards_paid, day.attacker_reward, places=6)

    def test_deterministic(self):
        for s in SCENARIOS.values():
            self.assertEqual(simulate(Params(), s), simulate(Params(), s))

    def test_sweep_covers_grid(self):
        rows = sweep(GRID)
        self.assertEqual(len(rows), 3 * 4 * 3 * 3 * 3)
        row = rows[0]
        for key in ("threshold_bps", "budget_ppm", "reward_multiplier", "challenge_stake", "appraisal_fee",
                    "supply_end", "treasury_end", "burned_total", "attacker_net_per_day", "breakeven", "q_normal",
                    "honest_paid_ratio", "attacker_net_per_day_q1", "honest_paid_ratio_farming"):
            self.assertIn(key, row)

    def test_honest_paid_ratio(self):
        rows = {(r["threshold_bps"], r["budget_ppm"], r["reward_multiplier"], r["challenge_stake"]): r
                for r in sweep(GRID) if r["appraisal_fee"] == 10}
        # normal at 7500: 50 challenges/day x 0.1 x 200 = 1000 demanded; budget 1200 (ppm 20) or 300 (ppm 5).
        self.assertAlmostEqual(rows[(7500, 20, 4, 50)]["honest_paid_ratio"], 1.0, places=3)
        self.assertAlmostEqual(rows[(7500, 5, 4, 50)]["honest_paid_ratio"], 0.3, places=2)


    # Review S4, Important 1: an attacker that only challenges its own data
    # after the injection fired is caught almost every time.
    def test_sure_attacker_takes_budget_minus_fees(self):
        p = Params()
        sure = replace(SCENARIOS["farming"], catch_adv=1.0)
        day = simulate(p, sure, days=1)[0]
        # 1200 budget / 200 reward = 6 farmed data, each costing the 10 fee.
        self.assertAlmostEqual(day.attacker_reward, 1200, places=6)
        self.assertAlmostEqual(day.attacker_net, 1200 - 6 * 10, places=6)

    def test_fee_above_reward_makes_even_a_sure_attacker_lose(self):
        p = Params(appraisal_fee=60, challenge_stake=25, reward_multiplier=2)
        reward, cost, _ = farm_per_data(p, 1.0)
        self.assertLess(reward - cost, 0)
        for day in simulate(p, replace(SCENARIOS["farming"], catch_adv=1.0), days=5):
            self.assertEqual(day.attacker_reward, 0)

    def test_near_cost_counts_every_appraise_and_challenge(self):
        reward, cost, ops = farm_per_data(Params(), 1.0)
        self.assertEqual(ops, 2)
        _, _, ops = farm_per_data(Params(), 0.5)
        self.assertAlmostEqual(ops, 1 + 1 + 0.5 + 0.25)
        day = simulate(Params(), replace(SCENARIOS["farming"], catch_adv=1.0), days=1)[0]
        self.assertAlmostEqual(day.attacker_near, 6 * 2 * NEAR_PER_OP, places=9)

    # Review S4, Important 2: a farmer crowds honest catchers out of the budget.
    def test_honest_rewards_crowded_out_by_farming(self):
        for r in sweep(GRID):
            if r["attacker_net_per_day"] > 0:
                self.assertAlmostEqual(r["honest_paid_ratio_farming"], 0.0, places=9)

if __name__ == "__main__":
    unittest.main()
