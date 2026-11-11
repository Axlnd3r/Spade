"""Writes docs/sim/*.svg and docs/sim/summary.md. Run: python sim/simulate.py"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from charts import line_chart  # noqa: E402
from dataclasses import replace  # noqa: E402

from model import (CATCH, GRID, SCENARIOS, Params, breakeven_q, farm_per_data, honest_paid_ratio,  # noqa: E402
                   simulate, sweep)

OUT = os.path.join(os.path.dirname(__file__), "..", "docs", "sim")
DAYS = 60
# The parameters Task 3 picks (D-15). Testnet runs 10-minute epochs; mainnet would run 24-hour ones.
CHOSEN = Params(challenge_stake=25, reward_multiplier=2, budget_ppm=5)
EPOCHS = {"24 jam (arah mainnet)": 24.0, "10 menit (testnet)": 1 / 6}
# P(caught) for the farming attacker: the experiment's average over all adversarial data, the
# a02/a04-a06 class it can pick, and the sure attacker who only challenges after the injection fired.
ATTACKER_Q = {"rata-rata data jahil": None, "data jahil terbaik": 0.93, "penyerang pasti": 1.0}
FEES = [10, 25, 50]


def n(v: float) -> str:
    return f"{v:,.0f}".replace(",", ".")


def pct(v: float) -> str:
    return f"{v * 100:.1f}%".replace(".", ",")


def scenario_table(p: Params) -> list[str]:
    rows = ["| Skenario | Supply akhir | Kas akhir | Total terbakar | Hadiah dibayar | Untung penyerang/hari |",
            "|---|---:|---:|---:|---:|---:|"]
    for s in SCENARIOS.values():
        days = simulate(p, s, DAYS)
        last = days[-1]
        rows.append(f"| {s.name} | {n(last.supply)} | {n(last.treasury)} | {n(last.burned_total)} | "
                    f"{n(sum(d.rewards_paid for d in days))} | {n(sum(d.attacker_net for d in days) / DAYS)} |")
    return rows


def farming_table(p: Params) -> list[str]:
    rows = ["| Penyerang | q | Untung TAKSIR/hari | Biaya NEAR/hari | Hadiah jujur terbayar |",
            "|---|---:|---:|---:|---:|"]
    for label, q in ATTACKER_Q.items():
        s = replace(SCENARIOS["farming"], catch_adv=q)
        days = simulate(p, s, DAYS)
        q_used = CATCH[p.threshold_bps][1] if q is None else q
        rows.append(f"| {label} | {q_used:.3f} | {n(sum(d.attacker_net for d in days) / DAYS)} | "
                    f"{sum(d.attacker_near for d in days) / DAYS:,.1f} | {pct(honest_paid_ratio(p, s, days))} |")
    return rows


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    runs = {name: simulate(CHOSEN, s, DAYS) for name, s in SCENARIOS.items()}
    line_chart({k: [d.supply for d in v] for k, v in runs.items()},
               "Supply TAKSIR, 60 hari", "TAKSIR beredar per akhir hari, epoch 24 jam", os.path.join(OUT, "supply.svg"))
    line_chart({k: [d.burned_total for d in v] for k, v in runs.items()},
               "Total TAKSIR terbakar, 60 hari", "kumulatif, epoch 24 jam", os.path.join(OUT, "burned.svg"))
    # The treasury drops by one budget per epoch whatever the activity (test_model), so its chart
    # compares epoch lengths instead of scenarios.
    line_chart({k: [d.treasury for d in simulate(Params(epoch_hours=h), SCENARIOS["normal"], DAYS)]
                for k, h in EPOCHS.items()},
               "Kas TAKSIR, 60 hari", "saldo kas per akhir hari; sama untuk semua skenario",
               os.path.join(OUT, "treasury.svg"))

    p = CHOSEN
    q_normal, q_adv = CATCH[p.threshold_bps]
    reward, cost, _ = farm_per_data(p, q_adv)
    sure_reward, sure_cost, _ = farm_per_data(p, 1.0)
    lines = [
        "# Simulasi TAKSIR 60 hari",
        "",
        "Dibuat oleh `python sim/simulate.py` dari model nilai harapan deterministik di `sim/model.py`.",
        "Model ini tidak memakai angka acak; tingkat tertangkap diambil dari `docs/EXPERIMENT.md` (run 2026-11-11).",
        "",
        "## Parameter yang disimulasikan",
        "",
        "| Parameter | Nilai |",
        "|---|---:|",
        f"| appraisal_fee | {n(p.appraisal_fee)} TAKSIR |",
        f"| challenge_stake | {n(p.challenge_stake)} TAKSIR |",
        f"| reward_multiplier | {p.reward_multiplier} |",
        f"| threshold_bps | {p.threshold_bps} |",
        f"| budget_ppm | {p.budget_ppm} per epoch |",
        f"| Kas awal / supply awal | {n(p.treasury0)} / {n(p.supply0)} |",
        "",
        "## Titik impas penantang",
        "",
        f"- Titik impas: q = stake / (multiplier × stake + stake) = **{pct(breakeven_q(p))}**.",
        f"- Peluang tertangkap data biasa pada ambang {p.threshold_bps}: **{pct(q_normal)}**. Angka ini di bawah titik impas,"
        " jadi menyidak data biasa secara asal-asalan rata-rata merugi.",
        f"- Peluang tertangkap data jahil: **{pct(q_adv)}**. Angka ini di atas titik impas.",
        "",
        "## Serangan farming",
        "",
        "Penyerang menaksir data jahil miliknya sendiri, lalu menyidaknya satu per satu sampai tertangkap"
        " (paling banyak 3 kali per data). Ia melakukannya lebih dulu dari penantang lain dalam setiap epoch,"
        " sampai budget epoch habis. Penyerang yang rasional tidak ikut kalau rata-rata ia rugi per data.",
        "",
        f"- **Rata-rata data jahil** (q {pct(q_adv)}, rata-rata semua dataset jahil di EXPERIMENT): hadiah harapan"
        f" {n(reward)} TAKSIR, biaya {n(cost)} TAKSIR per data.",
        "- **Penyerang pasti** (q 100%): penyerang memakai data yang urutannya menentukan harga (kelas a02, a04-a06,"
        " tertangkap 3/3 di EXPERIMENT) dan hanya menyidak setelah harganya melonjak. Hadiahnya penuh"
        f" {n(sure_reward)} TAKSIR, biayanya hanya fee {n(sure_cost)} TAKSIR. Jadi **fee adalah batas kedua**:"
        " kalau fee >= multiplier x stake, farming tidak pernah untung.",
        "- Hadiah penyerang per epoch tidak pernah melebihi budget epoch (`test_farming_capped_by_budget`).",
        "- Kas turun persis sama dengan atau tanpa penyerang. Yang berubah adalah ke mana budget itu pergi: dibayarkan"
        " ke penyerang, bukan dibakar.",
        "- **Penantang jujur tersingkir.** Selama penyerang untung, ia menghabiskan budget lebih dulu, sehingga tangkapan"
        " jujur di epoch itu dapat hadiah 0 (`test_honest_rewards_crowded_out_by_farming`).",
        "- Biaya NEAR per operasi (taksir atau sidak) sekitar 0,0511 NEAR. Ini rem nyata di luar TAKSIR.",
        "",
    ]
    for label, hours in EPOCHS.items():
        lines += [f"### Farming dengan parameter terpilih, epoch {label}", ""] + farming_table(
            replace(p, epoch_hours=hours)) + [""]
    lines += ["### Pengaruh fee (parameter lain tetap), penyerang pasti", "",
              "| Fee | Untung TAKSIR/hari (24 jam) | Untung TAKSIR/hari (10 menit) | Biaya NEAR/hari (10 menit) |",
              "|---:|---:|---:|---:|"]
    for fee in FEES:
        cells = []
        for hours in EPOCHS.values():
            days = simulate(replace(p, appraisal_fee=fee, epoch_hours=hours),
                            replace(SCENARIOS["farming"], catch_adv=1.0), DAYS)
            cells.append((sum(d.attacker_net for d in days) / DAYS, sum(d.attacker_near for d in days) / DAYS))
        lines.append(f"| {fee} | {n(cells[0][0])} | {n(cells[1][0])} | {cells[1][1]:,.1f} |")
    lines.append("")
    for label, hours in EPOCHS.items():
        lines += [f"## Skenario, epoch {label}", ""] + scenario_table(Params(
            **{**p.__dict__, "epoch_hours": hours})) + [""]

    for label, hours in EPOCHS.items():
        rows = sweep(GRID, DAYS, hours)
        good = [r for r in rows if r["q_normal"] < r["breakeven"]]
        good.sort(key=lambda r: (-round(r["honest_paid_ratio"], 3), r["attacker_net_per_day_q1"],
                                 r["attacker_net_per_day"]))
        lines += [
            f"## Sweep, epoch {label}: 10 kombinasi teratas",
            "",
            f"Dari {len(rows)} kombinasi, {len(good)} memenuhi syarat q_normal < titik impas. Urutannya: hadiah penantang"
            " jujur terbayar penuh (tanpa farming) lebih dulu, lalu untung penyerang pasti per hari yang paling kecil."
            " Kolom 'Jujur saat farming' adalah bagian hadiah jujur yang tetap terbayar saat ada penyerang.",
            "",
            "| Ambang | ppm | Mult | Stake | Fee | Titik impas | Jujur terbayar | Jujur saat farming"
            " | Penyerang rata-rata/hari | Penyerang pasti/hari | NEAR penyerang pasti/hari |",
            "|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
        ]
        for r in good[:10]:
            lines.append(f"| {r['threshold_bps']} | {r['budget_ppm']} | {r['reward_multiplier']} | "
                         f"{r['challenge_stake']} | {r['appraisal_fee']} | {pct(r['breakeven'])} | "
                         f"{pct(r['honest_paid_ratio'])} | {pct(r['honest_paid_ratio_farming'])} | "
                         f"{n(r['attacker_net_per_day'])} | {n(r['attacker_net_per_day_q1'])} | "
                         f"{r['attacker_near_per_day_q1']:,.1f} |")
        lines.append("")

    lines += ["## Grafik", "", "![Supply](supply.svg)", "", "![Terbakar](burned.svg)", "", "![Kas](treasury.svg)", ""]
    with open(os.path.join(OUT, "summary.md"), "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines))
    print(f"wrote 3 charts and summary.md to {os.path.normpath(OUT)}")


if __name__ == "__main__":
    main()
