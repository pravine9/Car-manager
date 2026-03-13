# UK Vehicle Tax (VED) Rates – Lookup Reference

Current rates for **cars** in Great Britain. Rates are typically updated each April; always confirm with [GOV.UK vehicle tax rate tables](https://www.gov.uk/vehicle-tax-rate-tables) and [V149](https://www.gov.uk/government/publications/rates-of-vehicle-tax-v149).

**Source:** Vehicle Excise Duty rates from 1 April 2025 (V149). Use `co2Emissions` and `monthOfFirstRegistration` from the DVLA VES API to pick the correct table and band.

---

## 1. Cars registered **before 1 March 2001**

Tax is by **engine size** (not CO₂). Use `engineCapacity` from the VES response.

| Engine size | 12 months | 6 months |
|-------------|-----------|----------|
| Not over 1549 cc | £220 | £121 |
| Over 1549 cc | £360 | £198 |

*Direct Debit instalment totals may differ slightly.*

---

## 2. Cars registered **1 March 2001 – 31 March 2017**

Tax is by **CO₂ emissions band**. Use `co2Emissions` from the VES response.

| Band | CO₂ (g/km) | 12 months | 6 months |
|------|------------|-----------|----------|
| A | Up to 100 | £20 | £11 |
| B | 101–110 | £20 | £11 |
| C | 111–120 | £35 | £19.25 |
| D | 121–130 | £165 | £90.75 |
| E | 131–140 | £195 | £107.25 |
| F | 141–150 | £215 | £118.25 |
| G | 151–165 | £265 | £145.75 |
| H | 166–175 | £315 | £173.25 |
| I | 176–185 | £345 | £189.75 |
| J | 186–200 | £395 | £217.25 |
| K | 201–225 | £430 | £236.50 |
| L | 226–255 | £735 | £404.25 |
| M | Over 255 | £760 | £418 |

*Rates may be uprated annually; check V149 for the current year.*

---

## 3. Cars registered **on or after 1 April 2017**

### Standard rate (second licence onwards)

From the second tax year, a **flat rate** applies (plus expensive-car supplement if applicable).

| Type | 12 months | 6 months |
|------|-----------|----------|
| Petrol / diesel / alternative fuel / zero emission | £195 | £107.25 |
| **+ Expensive car supplement** (list price over £40,000 when new, for 5 years from 2nd licence) | **£620** total | **£341** total |

*Direct Debit: 12 months = £204.75; 6 months = £107.25 (standard).*

### First licence (first year) – cars registered from 1 April 2017

First-year rate depends on **CO₂** and **fuel type**. Below: standard petrol/diesel/alternative/zero. Diesel cars not meeting RDE2 standards pay higher first-year rates (see GOV.UK).

| CO₂ (g/km) | First year (12 months) |
|------------|------------------------|
| 0 | £10 |
| 1–50 | £110 |
| 51–75 | £130 |
| 76–90 | £270 |
| 91–100 | £350 |
| 101–110 | £390 |
| 111–130 | £440 |
| 131–150 | £540 |
| 151–170 | £1,360 |
| 171–190 | £2,190 |
| 191–225 | £3,300 |
| 226–255 | £4,680 |
| Over 255 | £5,490 |

---

## 4. How to use with DVLA VES data

| VES field | Use |
|-----------|-----|
| `monthOfFirstRegistration` | Choose table: before 2001 → §1; 2001–March 2017 → §2; April 2017+ → §3. |
| `co2Emissions` | Find band in §2, or first-year band in §3. |
| `engineCapacity` | For pre-2001 only: compare to 1549 cc. |
| `fuelType` | For April 2017+ first year: diesel (non-RDE2) has different first-year rates on GOV.UK. |

**Example:** HJ15CDO – first registration March 2015, 149 g/km petrol → Table §2, Band F → **£215** (12 months) or **£118.25** (6 months).

---

## 5. Official links

- [Vehicle tax rate tables (GOV.UK)](https://www.gov.uk/vehicle-tax-rate-tables)
- [Rates of vehicle tax – V149 (GOV.UK)](https://www.gov.uk/government/publications/rates-of-vehicle-tax-v149)
- [Vehicle Excise Duty rates from 1 April 2025](https://www.gov.uk/government/publications/vehicle-excise-duty-rates-for-cars-vans-and-motorcycles-from-1-april-2025)
- [Calculate vehicle tax (new cars)](https://www.gov.uk/calculate-vehicle-tax-rates)
