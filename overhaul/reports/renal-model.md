# renal-model report

Scope: `renal/src/content/**`, `renal/src/engine/**`, `renal/src/sim/**`, `tests/renal/**`. No git state changes. No builds were written to `dist/` and no servers were started.

## Factual corrections (old → new, source)

| # | Where | Old | New | Source / reasoning |
|---|---|---|---|---|
| 1 | equations.ts `alkComp` | Computed with 0.6; claimed "the textbook uses 0.6, later summaries 0.7" | Computes 40 + **0.7** × ΔHCO₃⁻; claim removed | Rose Table 17-3 (as already used in ch17, ch18 and engine/body.ts); Adrogué & Madias 2010 (adrogue2010rules) |
| 2 | equations.ts `deltaratio` | Read thresholds were 0.8 and 2, but the text said "<1" and "1–2" | Thresholds of 1 and 2; notes ketoanion loss (<1) and compensated chronic respiratory acidosis (>2) | Rose ch17/19; Rastegar 2007 |
| 3 | equations.ts `ureacr` | ">100 (≈ BUN:creatinine above 20)" | ">80 (≈ BUN:Cr 20; some laboratories use 100)", plus an explanation of the conversion | Arithmetic: SI ratio = 4.04 × BUN:Cr (0.357 mmol/L per mg/dL BUN, 88.4 µmol/L per mg/dL creatinine) |
| 4 | equations.ts `hplus` | nEq/L | **nmol/L** (book's nEq/L noted) | SI units |
| 5 | equations.ts `starling` | Default σ 0.95 gave +1.3 mmHg, read as "filtration raised", while the text said "+0.3" | σ default 1 (classic Guyton muscle-capillary values give +0.3); "raised" threshold now > 1 mmHg | Rose ch16 / Guyton mean values |
| 6 | equations.ts `posm` | Read said "Normal (≈275–290)" for values up to 295 | "≈275–295" | Internal consistency |
| 7 | equations.ts `ag` | "Raised" above 14, with no reference range stated | Says it is above/within the textbook 12 ± 2 and to compare with the laboratory's own (lower) range | Kraut & Madias 2007 |
| 8 | equations.ts `cccr` | Grey zone: "CASR testing is reasonable" | Two-step approach: test CASR in everyone ≤ 0.020 | Christensen 2011 (abstract checked) |
| 9 | equations.ts `respComp` | No mention of the range of published coefficients | Notes that later series give 4–5 mmol/L per 10 mmHg for chronic respiratory alkalosis | Rose chs 20–21 |
| 10 | equations.ts `units` | Mg and phosphate factors missing | Mg mg/dL × 0.41; phosphate mg/dL × 0.323 | Molar masses |
| 11 | equations.ts `nacorr` | Katz factor not cited | Cites katz1973 (new, PMID 4763428) | PubMed |
| 12 | equationCases `nacorr` | Corrected Na⁺ of 145 described as "really hypernatraemic" | Glucose 50 → corrected Na⁺ 147; adds the Katz value (≈141) to show the factor matters | Arithmetic |
| 13 | equationCases `alkComp` | 0.6–0.7 | 0.7 × 16 → 51 mmHg | Rose Table 17-3 |
| 14 | equationCases `osmgap` | Ethanol adds "about 1 mOsm/kg per mmol/L" | "about 1–1.25" | Empirical contribution of ethanol |
| 15 | equationCases `nadeficit` | "Rise above 10 risks ODS, and she is high risk (older…)" | The high-risk limit is 8 mmol/L in any 24 h (10 for others); age removed as a risk factor | Verbalis 2013; Spasovski 2014 |
| 16 | equationCases `ureacr` | "well above 100" | "well above 80–100 (BUN:Cr ≈ 43)" | Arithmetic |
| 17 | ch03 | Calcium: "~5% excreted" | "~1–2% of the filtered load" | Standard renal physiology (98–99% reabsorbed) |
| 18 | ch08 | FENa on 180 mmol at a filtered load of 24,000 = 0.67% | **0.75%** | Arithmetic |
| 19 | ch13 | 1% of a tenth of the filtered load "≈14 mmol/day" (concept and Q2) | ≈27 and ≈26 mmol/day | Arithmetic (27,000 × 0.1 × 1%) |
| 20 | ch17 Q4 | HCO₃⁻ 26 vs **45** at PCO₂ 60, with the answer "duration". 45 actually means an added metabolic alkalosis | 26 vs **31**; explanation shows 24 + 2 × 1 and 24 + 2 × 3.5, with the pH values | Rose Table 17-3 |
| 21 | ch11 | Chronic respiratory alkalosis "−5 per 10 mmHg" (ch17, ch21 and the equation use 4) | "−4 to −5" | Rose chs 17, 21 |
| 22 | ch19 | Albumin correction "per 1 g/dL", "subtract" | Per 10 g/L below 40, "add back"; reworded "the normal value of the gap falls" | SI; Figge 1998 |
| 23 | ch19 | Ammonium excretion per nephron in CKD "normal" | "maintained, even increased" | Rose ch19 |
| 24 | ch19 / ch10 updates | "correcting HCO₃⁻ < 22 is now standard" / "KDIGO suggests < 18–20" | KDIGO 2024: consider drug treatment when persistently < 18 mmol/L (the earlier guideline used 22) | KDIGO 2024 (kdigo2024ckd) |
| 25 | ch23 update | Limits "10–12/day are now formal guidance" | European: 10 in the first 24 h, then 8 per 24 h; US: 8 in any 24 h for high-risk patients; 150 mL 3% bolus aiming at +5 mmol/L in the first hour; "proactive desmopressin" softened to "some clinicians" | Spasovski 2014; Verbalis 2013 (added to the cite) |
| 26 | ch25 | 55 mmol/L glucose → Na⁺ "≈118" and "osmolality 290 + 23" (two different factors mixed) | ≈126 by the ideal osmometer (≈119 with the steeper factor); effective osmolality rises ≈20 | Katz 1973; Hillier 1999 |
| 27 | ch25 | Dextrose at 16.7 mmol/L only | Adds the 2024 consensus threshold of 13.9 mmol/L (point and key number) | Umpierrez 2024 |
| 28 | ch25 update | Raw reference id "(umpierrez2024)" in visible text | "The 2024 international consensus" | Copy fix |
| 29 | ch27 | "Adenoma ≈65%" of primary aldosteronism, as current | Marked as the book's figure; now about 30–40% adenoma and about 60% bilateral hyperplasia; update text extended | Funder 2016 |
| 30 | ch15 | "Thiazides ineffective below GFR ~20", no update | Note, plus a new modern update: in stage 4 CKD (CLICK) chlorthalidone lowered 24-h systolic BP by 10.5 mmHg vs placebo | Agarwal 2021 (new, PMID 34739197, abstract checked) |
| 31 | ch01 | Filtered HCO₃⁻ "≈4,800" (ch11 says 4,300) | "≈4,300–4,800" | 180 L × 24–27 mmol/L |
| 32 | segments.ts (thin ascending limb) | "~40% of nephrons have short loops" (contradicts ch04: long loops are 30–40%) | "the short-looped majority (roughly 60–70%)" | Rose ch4 |
| 33 | ch22, ch23 | Osmolality in "mmol/kg" and "mosmol" | mOsm/kg and mOsm (the site convention) | README units |
| 34 | ch10–12 | "sulphate/sulphur" mixed with "sulfate" | "sulfate/sulfur" throughout | Consistency |
| 35 | ch26, ch28 | "albuterol" | "salbutamol (albuterol)" | Canadian/British usage |

## References
- I checked all 249 entries in `pubmed.generated.ts` and `pubmed.extra.ts` (239 unique PMIDs) against PubMed esummary: PMID, title, first author, year, journal, DOI, volume and first page. **All matched.** The only differences were collaborative-group suffixes on 3 titles and 2 group first authors, which are cosmetic.
- Removed 6 entries from `pubmed.extra.ts` whose ids were already in `pubmed.generated.ts` (adrogue2000hyper, batlle1988, edelman1958, mullens2022advor, sterns1986, spasovski2014). `ref('spasovski2014')` now resolves to the Eur J Endocrinol printing (PMID 24569125) instead of the NDT printing (24569496) of the same guideline.
- Added 2 references, each checked by PMID: katz1973 (4763428) and agarwal2021click (34739197).
- Spot-checked these claims against their abstracts: Elisaf 1997 (FEMg > 4%), Lee 2021 (Na/K > 1: sensitivity 90.9%, specificity 56%), Christensen 2011 (CCCR ≤ 0.020) and Furst 2000.
- Left as is: 6 pairs of alias ids that point to the same PMID (fenske2018/fenske2018copeptin, pitt1999/pitt1999rales, trullas2023/trullas2023clorotic, schrier2006/schrier2006salt, debrito2009/britoashurst2009, arima2022/arima2022rename). Pages in `renal/src/pages` (renal-ui) cite some of them, so removing one would break a page. They are harmless because each id resolves.

## Equations
I checked every formula and coefficient against the standard forms:
- Fractional excretions (FENa, FEUrea, FEK, FEHCO₃, FEMg with 0.7, FEPO₄) with the µmol/L ÷ mmol/L × 1000 factor.
- Cockcroft–Gault in µmol/L (1.23/1.04) and CKD-EPI 2021 (142; κ 0.7/0.9 → 62/80 µmol/L; α −0.241/−0.302; −1.200; 0.9938; ×1.012).
- Edelman, Adrogué–Madias, water and sodium deficits, EFWC and Furst.
- Anion gap with the 0.25 per g/L correction, Winter's formula, osmolal gaps, UAG, UOG, TTKG (with its retirement), UK/Ucr and UPCR (mg/mmol; KDIGO A1–A3 cut-offs 15/50).
- Unit conversions in `units.ts` and `unitPref`: 88.4, 1/2.8, 1/18, 0.25, 0.411, 0.323, ×10.

I recomputed all 29 worked cases. Apart from the fixes above, all reproduce their stated answers.

## Tests
- `tests/renal/equations.test.ts`:
  - Compensation coefficients (alkComp 0.7, Winter, acute/chronic respiratory).
  - Delta-ratio reading thresholds.
  - Corrected Na⁺ (both factors), the albumin-corrected AG case, the Starling default of +0.3, urea:creatinine 20 ≈ 80, the HCO₃⁻ deficit, CKD-EPI and Cockcroft–Gault.
  - New check: no equation result or variable is in US units (mEq, nEq, mg/dL, …).
- `tests/renal/content.test.ts`:
  - New: every reference id is registered once and has a numeric PMID.
  - New: no reference id leaks into visible prose. This class of error is real: "(umpierrez2024)" was on the page.
- Runs:
  - `tests/renal/physiology.test.ts`: 188/188 pass. The engine regression suite already covers every scenario in the brief: SIADH and Table 23-9, the DI restriction/desmopressin patterns, diuretics, RTA types 1/2/4, DKA/HHS, K⁺ shifts, metabolic alkalosis (Cl⁻-responsive vs mineralocorticoid), CKD, AKI and obstruction. No engine errors were found, so no engine code was changed. The documented model limitations are untouched.
  - `npx tsc --noEmit`: no renal errors.
  - Full renal suite (`npx vitest run tests/renal`): 5 files, **372/372 pass** (265 s).

## Content review coverage
- Read in full and checked: ch02, ch12, ch13, ch19, ch23, ch24, ch25, ch27, ch28; hormones.ts.
- Every chapter's key numbers (ch01–ch28) and all ~150 quiz questions and answers were recomputed.
- Spelling, unit and placeholder scans across all content (no TODO/WIP found).
- Not read line by line (numbers, questions and updates only): the concept prose of ch01, ch03–11, ch14–18, ch20–22 and ch26, plus graph.ts, drugmap.ts and diureticMap.ts.

## Found but not fixed (uncertain, or not mine)
- ch27 says the concentrating defect starts at a K⁺ deficit of ~200 mmol; ch12 and ch24 say ~300–400. Rose's figure could not be verified, so I left it.
- ch12 gives an adapted K⁺ intake of 500 mmol/day; ch26 and ch28 give ≈400. Both may be Rose's (different studies). Left.
- ch07 gives the nephrotic underfill threshold as albumin < ~10 g/L. Not verifiable without the book. Left.

## Sent to other inboxes
`scratchpad/inbox/renal-ui.md`:
- Hyperkalemia.tsx should use "salbutamol".
- Osmolality units on pages (Hyponatremia.tsx `unit="mmol/kg"`, "mosmol/kg", and others) should be mOsm/kg.
- Pages should be aligned with the changed equation outputs (alkComp 0.7, hplus nmol/L, ureacr > 80).
