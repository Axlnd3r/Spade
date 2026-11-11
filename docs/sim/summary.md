# Simulasi TAKSIR 60 hari

Dibuat oleh `python sim/simulate.py` dari model nilai harapan deterministik di `sim/model.py`.
Model ini tidak memakai angka acak; tingkat tertangkap diambil dari `docs/EXPERIMENT.md` (run 2026-11-11).

## Parameter yang disimulasikan

| Parameter | Nilai |
|---|---:|
| appraisal_fee | 10 TAKSIR |
| challenge_stake | 25 TAKSIR |
| reward_multiplier | 2 |
| threshold_bps | 7500 |
| budget_ppm | 5 per epoch |
| Kas awal / supply awal | 60.000.000 / 100.000.000 |

## Titik impas penantang

- Titik impas: q = stake / (multiplier × stake + stake) = **33,3%**.
- Peluang tertangkap data biasa pada ambang 7500: **10,0%**. Angka ini di bawah titik impas, jadi menyidak data biasa secara asal-asalan rata-rata merugi.
- Peluang tertangkap data jahil: **46,7%**. Angka ini di atas titik impas.

## Serangan farming

Penyerang menaksir data jahil miliknya sendiri, lalu menyidaknya satu per satu sampai tertangkap (paling banyak 3 kali per data). Ia melakukannya lebih dulu dari penantang lain dalam setiap epoch, sampai budget epoch habis.

- Per data: hadiah harapan 42 TAKSIR, biaya harapan 34 TAKSIR (fee + stake yang hangus).
- Hadiah penyerang per epoch tidak pernah melebihi budget epoch (`test_farming_capped_by_budget`).
- Kas turun persis sama dengan atau tanpa penyerang. Yang berubah adalah ke mana budget itu pergi: dibayarkan ke penyerang, bukan dibakar atau dibayarkan ke penantang jujur (`test_farming_drains_treasury_the_same_and_displaces_honest_rewards`).

## Skenario, epoch 24 jam (arah mainnet)

| Skenario | Supply akhir | Kas akhir | Total terbakar | Hadiah dibayar | Untung penyerang/hari |
|---|---:|---:|---:|---:|---:|
| sepi | 99.977.953 | 59.982.003 | 22.047 | 300 | 0 |
| normal | 99.899.503 | 59.982.003 | 100.497 | 15.000 | 0 |
| ai_buruk | 99.925.000 | 59.982.003 | 75.000 | 17.997 | 0 |
| farming | 99.887.988 | 59.982.003 | 112.012 | 17.997 | 58 |

## Skenario, epoch 10 menit (testnet)

| Skenario | Supply akhir | Kas akhir | Total terbakar | Hadiah dibayar | Untung penyerang/hari |
|---|---:|---:|---:|---:|---:|
| sepi | 97.459.133 | 57.463.183 | 2.540.867 | 300 | 0 |
| normal | 97.380.683 | 57.463.183 | 2.619.317 | 15.000 | 0 |
| ai_buruk | 97.448.183 | 57.463.183 | 2.551.817 | 60.000 | 0 |
| farming | 97.856.934 | 57.463.183 | 2.143.066 | 2.536.817 | 8.188 |

## Sweep, epoch 24 jam (arah mainnet): 10 kombinasi teratas

Dari 108 kombinasi, 108 memenuhi syarat q_normal < titik impas. Urutannya: hadiah penantang jujur yang terbayar penuh lebih dulu, lalu untung penyerang per hari yang paling kecil.

| Ambang | ppm | Mult | Stake | Titik impas | Hadiah jujur terbayar | Supply akhir | Kas akhir | Untung penyerang/hari |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 7500 | 5 | 2 | 25 | 33,3% | 100,0% | 99.899.503 | 59.982.003 | 58 |
| 8000 | 5 | 2 | 25 | 33,3% | 100,0% | 99.889.603 | 59.982.003 | 58 |
| 8000 | 5 | 2 | 50 | 33,3% | 100,0% | 99.827.203 | 59.982.003 | 93 |
| 7000 | 10 | 2 | 25 | 33,3% | 100,0% | 99.894.111 | 59.964.011 | 116 |
| 7500 | 10 | 2 | 25 | 33,3% | 100,0% | 99.881.511 | 59.964.011 | 116 |
| 8000 | 10 | 2 | 25 | 33,3% | 100,0% | 99.871.611 | 59.964.011 | 116 |
| 8000 | 5 | 3 | 25 | 25,0% | 100,0% | 99.893.803 | 59.982.003 | 139 |
| 8000 | 5 | 4 | 25 | 20,0% | 100,0% | 99.898.003 | 59.982.003 | 179 |
| 7500 | 10 | 2 | 50 | 33,3% | 100,0% | 99.829.011 | 59.964.011 | 187 |
| 8000 | 10 | 2 | 50 | 33,3% | 100,0% | 99.809.211 | 59.964.011 | 187 |

## Sweep, epoch 10 menit (testnet): 10 kombinasi teratas

Dari 108 kombinasi, 108 memenuhi syarat q_normal < titik impas. Urutannya: hadiah penantang jujur yang terbayar penuh lebih dulu, lalu untung penyerang per hari yang paling kecil.

| Ambang | ppm | Mult | Stake | Titik impas | Hadiah jujur terbayar | Supply akhir | Kas akhir | Untung penyerang/hari |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 7000 | 5 | 2 | 25 | 33,3% | 100,0% | 97.393.283 | 57.463.183 | 8.188 |
| 7500 | 5 | 2 | 25 | 33,3% | 100,0% | 97.380.683 | 57.463.183 | 8.188 |
| 8000 | 5 | 2 | 25 | 33,3% | 100,0% | 97.370.783 | 57.463.183 | 8.188 |
| 7000 | 5 | 2 | 50 | 33,3% | 100,0% | 97.353.383 | 57.463.183 | 13.170 |
| 7500 | 5 | 2 | 50 | 33,3% | 100,0% | 97.328.183 | 57.463.183 | 13.170 |
| 8000 | 5 | 2 | 50 | 33,3% | 100,0% | 97.308.383 | 57.463.183 | 13.170 |
| 7000 | 5 | 2 | 100 | 33,3% | 100,0% | 97.273.583 | 57.463.183 | 15.661 |
| 7500 | 5 | 2 | 100 | 33,3% | 100,0% | 97.223.183 | 57.463.183 | 15.661 |
| 8000 | 5 | 2 | 100 | 33,3% | 100,0% | 97.183.583 | 57.463.183 | 15.661 |
| 7000 | 10 | 2 | 25 | 33,3% | 100,0% | 94.963.712 | 55.033.612 | 16.029 |

## Grafik

![Supply](supply.svg)

![Terbakar](burned.svg)

![Kas](treasury.svg)
