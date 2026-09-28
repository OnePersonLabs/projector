# Steady Helm V3.2 — Adversarial Follow-Up

## Verdict

**No new P1 architecture blocker found in the supplied V3.2 spec, closure, and validation report.**

The previous four findings are now addressed at specification/model level in a coherent way:

- USB suspend and enumeration permission are attachment-scoped instead of relying on a sleep-held raw GPIO.
- Thermal inhibition uses the BQ24074 `TS` pause path rather than `CE`, avoiding the previous automatic fault-reset contradiction.
- Brownout/recovery enters `CHARGE_ONLY`; voltage recovery alone is no longer permission to launch the full instrument.
- Thermal response now has explicit timing origins and pass/fail deadlines.

The validation report is also cryptographically tied to the supplied canonical spec: the uploaded `V3_BUILD_SPEC.md` SHA-256 is:

`3568579075495d9379cb2fe9875ab5d8fea06cc0eab1cbf524523c95e8130ec8`

which exactly matches the hash stated in `V3_2_VALIDATION_REPORT.md`.

I would proceed with EDA/firmware work.

## P2 — Add a design-time standby-current budget before fabrication

The spec has a hard **100 µA battery-side unattended-off limit** and an **80 µA optimization target**, but the current document still treats the full budget primarily as a physical G6 measurement.

That is not wrong, but several always-on contributors are already known well enough to create a useful analytical budget before PCB release.

Known or directly implied loads already include approximately:

| Contributor | Approximate current |
|---|---:|
| Independent 100 kΩ / 100 kΩ NTC divider at 25°C | 16.5 µA |
| Retained-high P6 through 330 kΩ | 10 µA |
| Thermal release-gate 330 kΩ pull-down when asserted | ~10 µA |
| TS-shunt gate 1 MΩ bias | ~3–4.4 µA |
| TPS63802 operating quiescent current | ~11 µA typical |
| ESP32-S3-WROOM-1 deep sleep | ~7–8 µA typical |
| Two AUP DFFs + associated AUP logic | small but non-zero |
| TLV7042, TLV840, TCA9534A, divider/reference network, GPIO leakage, pull-ups | additional non-zero current |

The first six items alone are already roughly **58–60 µA typical** before the comparator ladder, expander, supervisor, logic leakage, feedback dividers, powered sensors that fail to shut down completely, PCB leakage, or unfavorable component conditions are counted.

This does **not** show that the 100 µA requirement will fail. It shows that the 80 µA target has limited margin and that a design-time budget can catch an avoidable respin before fabrication.

### Required change

Add a small `OFF_CURRENT_BUDGET` table before G1/G6 containing:

- nominal/typical current;
- relevant maximum or conservative engineering allowance where available;
- whether the current is present in normal unattended off, fault inhibit, USB attached, solar attached, or all states;
- total typical;
- total conservative design estimate;
- remaining margin to 80 µA and 100 µA.

Do **not** relax the 100 µA requirement based on the spreadsheet. Physical battery-side measurement remains authoritative.

### Decision rule

If the conservative pre-fab budget clearly exceeds 100 µA, correct the design before ordering.

If it lands between 80 and 100 µA, keep the circuit but identify the dominant optimization candidates before layout.

If it remains comfortably below 80 µA, proceed and verify at G6.

## Evidence-package limitation

The supplied validation report states that the full package contains the executable tests, Python power model, generated traces, manifests, archived V3.1 baseline, and hash manifest. Those files were **not included in the three uploaded artifacts reviewed here**.

Therefore:

- I verified that the supplied canonical spec's SHA-256 matches the validation report.
- I reviewed the described test scope and exclusions.
- I did **not** independently execute the reported 77 tests or inspect the claimed 164-state / 20,992-transition exploration.

That is an evidence-availability limitation, not a finding against the design.

Before treating the analytical validation as independently reproduced, hand the next reviewer the complete package referenced by the closure report, not only the three Markdown summaries.

## What I would not reopen

Do not replace the charger, add another processor, add an always-on fault logger, or redesign the sensor/display stack based on this review.

The V3.2 power-state corrections are substantially better than V3.1 and are now explicit enough to implement and physically falsify.

The highest-leverage next move is exactly what the spec already says: **capture the real circuit, run G1, then exercise the power-state sequences on hardware.**
