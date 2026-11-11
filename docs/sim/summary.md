# Simulasi TAKSIR 60 hari

Dibuat oleh `python sim/simulate.py` dari model nilai harapan deterministik di `sim/model.py`.
Model ini tidak memakai angka acak; tingkat tertangkap diambil dari `docs/EXPERIMENT.md` (run 2026-11-11).

## Parameter yang disimulasikan

| Parameter | Nilai |
|---|---:|
| appraisal_fee | 50 TAKSIR |
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

Penyerang menaksir data jahil miliknya sendiri, lalu menyidaknya satu per satu sampai tertangkap (paling banyak 3 kali per data). Ia melakukannya lebih dulu dari penantang lain dalam setiap epoch, sampai budget epoch habis. Penyerang yang rasional tidak ikut kalau rata-rata ia rugi per data.

- **Rata-rata data jahil** (q 46,7%, rata-rata semua dataset jahil di EXPERIMENT): hadiah harapan 42 TAKSIR, biaya 74 TAKSIR per data.
- **Penyerang pasti** (q 100%): penyerang memakai data yang urutannya menentukan harga (kelas a02, a04-a06, tertangkap 3/3 di EXPERIMENT) dan hanya menyidak setelah harganya melonjak. Hadiahnya penuh 50 TAKSIR, biayanya hanya fee 50 TAKSIR. Jadi **fee adalah batas kedua**: kalau fee >= multiplier x stake, farming tidak pernah untung.
- Hadiah penyerang per epoch tidak pernah melebihi budget epoch (`test_farming_capped_by_budget`).
- Kas turun persis sama dengan atau tanpa penyerang. Yang berubah adalah ke mana budget itu pergi: dibayarkan ke penyerang, bukan dibakar.
- **Penantang jujur tersingkir.** Selama penyerang untung, ia menghabiskan budget lebih dulu, sehingga tangkapan jujur di epoch itu dapat hadiah 0 (`test_honest_rewards_crowded_out_by_farming`).
- Biaya NEAR per operasi (taksir atau sidak) sekitar 0,0511 NEAR. Ini rem nyata di luar TAKSIR.

### Farming dengan parameter terpilih, epoch 24 jam (arah mainnet)

| Penyerang | q | Untung TAKSIR/hari | Biaya NEAR/hari | Hadiah jujur terbayar |
|---|---:|---:|---:|---:|
| rata-rata data jahil | 0.467 | 0 | 0.0 | 100,0% |
| data jahil terbaik | 0.930 | 0 | 0.0 | 100,0% |
| penyerang pasti | 1.000 | 0 | 0.0 | 100,0% |

### Farming dengan parameter terpilih, epoch 10 menit (testnet)

| Penyerang | q | Untung TAKSIR/hari | Biaya NEAR/hari | Hadiah jujur terbayar |
|---|---:|---:|---:|---:|
| rata-rata data jahil | 0.467 | 0 | 0.0 | 100,0% |
| data jahil terbaik | 0.930 | 0 | 0.0 | 100,0% |
| penyerang pasti | 1.000 | 0 | 0.0 | 100,0% |

### Pengaruh fee (parameter lain tetap), penyerang pasti

| Fee | Untung TAKSIR/hari (24 jam) | Untung TAKSIR/hari (10 menit) | Biaya NEAR/hari (10 menit) |
|---:|---:|---:|---:|
| 10 | 240 | 33.824 | 86.4 |
| 25 | 150 | 21.140 | 86.4 |
| 50 | 0 | 0 | 0.0 |

## Skenario, epoch 24 jam (arah mainnet)

| Skenario | Supply akhir | Kas akhir | Total terbakar | Hadiah dibayar | Untung penyerang/hari |
|---|---:|---:|---:|---:|---:|
| sepi | 99.965.953 | 59.982.003 | 34.047 | 300 | 0 |
| normal | 99.779.503 | 59.982.003 | 220.497 | 15.000 | 0 |
| ai_buruk | 99.805.000 | 59.982.003 | 195.000 | 17.997 | 0 |
| farming | 99.779.503 | 59.982.003 | 220.497 | 15.000 | 0 |

## Skenario, epoch 10 menit (testnet)

| Skenario | Supply akhir | Kas akhir | Total terbakar | Hadiah dibayar | Untung penyerang/hari |
|---|---:|---:|---:|---:|---:|
| sepi | 97.447.133 | 57.463.183 | 2.552.867 | 300 | 0 |
| normal | 97.260.683 | 57.463.183 | 2.739.317 | 15.000 | 0 |
| ai_buruk | 97.328.183 | 57.463.183 | 2.671.817 | 60.000 | 0 |
| farming | 97.260.683 | 57.463.183 | 2.739.317 | 15.000 | 0 |

## Sweep, epoch 24 jam (arah mainnet): 10 kombinasi teratas

Dari 324 kombinasi, 324 memenuhi syarat q_normal < titik impas. Urutannya: hadiah penantang jujur terbayar penuh (tanpa farming) lebih dulu, lalu untung penyerang pasti per hari yang paling kecil. Kolom 'Jujur saat farming' adalah bagian hadiah jujur yang tetap terbayar saat ada penyerang.

| Ambang | ppm | Mult | Stake | Fee | Titik impas | Jujur terbayar | Jujur saat farming | Penyerang rata-rata/hari | Penyerang pasti/hari | NEAR penyerang pasti/hari |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 7000 | 10 | 2 | 25 | 50 | 33,3% | 100,0% | 100,0% | 0 | 0 | 0.0 |
| 7000 | 20 | 2 | 25 | 50 | 33,3% | 100,0% | 100,0% | 0 | 0 | 0.0 |
| 7000 | 50 | 2 | 25 | 50 | 33,3% | 100,0% | 100,0% | 0 | 0 | 0.0 |
| 7500 | 5 | 2 | 25 | 50 | 33,3% | 100,0% | 100,0% | 0 | 0 | 0.0 |
| 7500 | 10 | 2 | 25 | 50 | 33,3% | 100,0% | 100,0% | 0 | 0 | 0.0 |
| 7500 | 20 | 2 | 25 | 50 | 33,3% | 100,0% | 100,0% | 0 | 0 | 0.0 |
| 7500 | 50 | 2 | 25 | 50 | 33,3% | 100,0% | 100,0% | 0 | 0 | 0.0 |
| 8000 | 5 | 2 | 25 | 50 | 33,3% | 100,0% | 100,0% | 0 | 0 | 0.0 |
| 8000 | 10 | 2 | 25 | 50 | 33,3% | 100,0% | 100,0% | 0 | 0 | 0.0 |
| 8000 | 20 | 2 | 25 | 50 | 33,3% | 100,0% | 100,0% | 0 | 0 | 0.0 |

## Sweep, epoch 10 menit (testnet): 10 kombinasi teratas

Dari 324 kombinasi, 324 memenuhi syarat q_normal < titik impas. Urutannya: hadiah penantang jujur terbayar penuh (tanpa farming) lebih dulu, lalu untung penyerang pasti per hari yang paling kecil. Kolom 'Jujur saat farming' adalah bagian hadiah jujur yang tetap terbayar saat ada penyerang.

| Ambang | ppm | Mult | Stake | Fee | Titik impas | Jujur terbayar | Jujur saat farming | Penyerang rata-rata/hari | Penyerang pasti/hari | NEAR penyerang pasti/hari |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 7000 | 5 | 2 | 25 | 50 | 33,3% | 100,0% | 100,0% | 0 | 0 | 0.0 |
| 7000 | 10 | 2 | 25 | 50 | 33,3% | 100,0% | 100,0% | 0 | 0 | 0.0 |
| 7000 | 20 | 2 | 25 | 50 | 33,3% | 100,0% | 100,0% | 0 | 0 | 0.0 |
| 7000 | 50 | 2 | 25 | 50 | 33,3% | 100,0% | 100,0% | 0 | 0 | 0.0 |
| 7500 | 5 | 2 | 25 | 50 | 33,3% | 100,0% | 100,0% | 0 | 0 | 0.0 |
| 7500 | 10 | 2 | 25 | 50 | 33,3% | 100,0% | 100,0% | 0 | 0 | 0.0 |
| 7500 | 20 | 2 | 25 | 50 | 33,3% | 100,0% | 100,0% | 0 | 0 | 0.0 |
| 7500 | 50 | 2 | 25 | 50 | 33,3% | 100,0% | 100,0% | 0 | 0 | 0.0 |
| 8000 | 5 | 2 | 25 | 50 | 33,3% | 100,0% | 100,0% | 0 | 0 | 0.0 |
| 8000 | 10 | 2 | 25 | 50 | 33,3% | 100,0% | 100,0% | 0 | 0 | 0.0 |

## Grafik

![Supply](supply.svg)

![Terbakar](burned.svg)

![Kas](treasury.svg)
