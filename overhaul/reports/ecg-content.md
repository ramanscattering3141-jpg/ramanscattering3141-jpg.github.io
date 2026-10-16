# ecg-content report

## Scope and approach
This round followed the coordinator's priorities:
1. 2025 AHA ACLS and current-guideline management and doses.
2. Threshold consistency across the diagnosis records, findings, eponyms, the reference pages, cases and challenge answers.
3. The Oct 9 additions (`eponyms.ts`, `reference.ts`), which had been checked less.
4. Citations for the records I changed or added.

The diagnosis records had already been through two audits (Oct 9). I did not re-read every sentence of them. Instead I grepped every dose and threshold and read the management, criteria and definition fields of each file.

## Files changed (one line each)
- **src/ecg/content/sources.ts:** added 7 PubMed-verified primary sources: peguero2017, romhilt1968, aslanger2020, padua2020, chatterjee1969, littmann2016, chaubey2014. Added a `V2 = '2026-10-16'` verification date for them.
- **src/ecg/content/eponyms.ts:**
  - Re-pointed citations that did not support their sign. Eleven entries changed: Peguero, Romhilt–Estes, Aslanger, aVR sign, epsilon, Chatterjee, South African flag, Spodick, Josephson, Bix, Ashman and Cabrera.
  - The aVR-sign lead count is now aligned with the 2023 ESC ACS guideline (≥ 8 leads).
- **src/ecg/content/reference.ts:**
  - Heart-rate bradycardia threshold now notes the 2018 guideline's < 50/min.
  - Fixed the QRS 110 ms boundary overlap.
  - Athlete's ECG: removed "in sleep" from Mobitz I.
  - aVR/diffuse ST depression row: "≥ 8 leads (2023 ESC)".
- **src/ecg/content/dx_metabolic.ts:** reworded the hyperkalaemic-arrest drugs (removed an unverified class label and an unverified β₂-agonist claim). Made the LQTS β-blocker indication precise (ESC 2022).
- **src/ecg/content/dx_ventricular.ts:** the PEA record's hyperkalaemic-arrest wording now matches dx_metabolic.
- **src/ecg/content/dx_morph.ts:** fixed the 2025 ESC pericarditis diagnostic wording. Rewrote the COPD P-wave item (inbox item from ecg-engine).
- **src/ecg/content/dx_extra.ts:** de Winter aVR ST elevation now matches the original series and the definition in the same record.
- **src/ecg/content/dx_rhythm.ts:** sinus-tachycardia P-wave leads now match the NSR record. Corrected the sinus-arrhythmia mechanism.
- **src/ecg/content/challenge.ts:** the Level 1 label is now "Mobitz I (Wenckebach)" (the site's naming). The L4 orthodromic AVRT explanation no longer claims pre-excitation is required.
- **src/ecg/content/cases.ts:** posterior-STEMI QRS text and PE QRS text now match ecg-engine's preset changes.
- **src/ecg/content/index.ts:** search index now has British-spelling keys (ischaemia, hyperkalaemia and the like) and CHA₂DS₂-VA in the calculator title and keys.
- **tests/ecg/content.test.ts:** two new tests.
  - Every eponym ref, dx and preset resolves; every STEMI-equivalent/mimic dx and preset resolves; every reference-page `#/dx/` link resolves.
  - A threshold-consistency guard: aVR lead count; posterior and right-sided UDMI thresholds; no QTc 440 ms; no atropine 0.5 mg.
  - The first test would have caught the uncited eponym class. The second would have caught the "≥ 6–8 leads" inconsistency.

## Factual corrections
| Where | Old | New | Source |
|---|---|---|---|
| eponyms aVR sign | ST depression ≥ 1 mm in "≥ 6–8 leads" (reference page said "classically ≥ 8") | ≥ 8 leads, both places, citing the 2023 ESC ACS guideline | ESC 2023 ACS guideline (Byrne, PMID 37622654) |
| eponyms Peguero–Lo Presti | cited only the 2009 AHA Part V statement, which predates the criterion | cites Peguero 2017 | PMID 28359515 |
| eponyms Romhilt–Estes | cited only a secondary source | cites the original point-score paper | PMID 4231231 |
| eponyms Aslanger | cited the 2025 ACC/AHA ACS guideline, which does not describe it | cites Aslanger 2020 | PMID 32526537 |
| eponyms epsilon wave | the claim that the 2020 Padua criteria downgrade the epsilon wave had no citation | adds the Padua criteria | PMID 32561223 |
| eponyms Chatterjee | cited the AHA Part V (hypertrophy) statement | cites Chatterjee 1969 | PMID 5358161 |
| eponyms South African flag | cited the 2025 ACS guideline | cites Littmann 2016 | PMID 26527178 |
| eponyms Spodick | cited the 2015 ESC pericardial guideline | cites Chaubey 2014 | PMID 24626086 |
| eponyms Josephson | cited the 2017 VA guideline | cites LITFL (secondary) | — |
| reference QRS duration | normal "≤ 110 ms" but abnormal "110–119 ms" (110 ms counted twice) | "> 110 ms but < 120 ms" | AHA/ACCF/HRS 2009 Part III |
| reference athlete's ECG | "Mobitz I in sleep" | "Mobitz I (Wenckebach)" (2017 criteria have no sleep restriction) | Sharma 2017 (PMID 28231933) |
| reference heart rate | bradycardia < 60/min, unqualified (the sinus-bradycardia record says < 50–60) | adds that the 2018 guideline uses < 50/min | brady2018 |
| hyperK and PEA records, cardiac arrest | "may be considered (2025 AHA: Class 2b…)"; "inhaled β₂-agonists are not recommended" | "can be given … the evidence for each is limited (2025 AHA Part 10)". The class and the β₂ claim could not be verified, so they were removed. | 2025 AHA Part 10 (secondary summaries; primary text not accessible) |
| pericarditis definition | "2025 ESC grades the diagnosis (definite/possible)" | consistent presentation plus supporting findings (rub, ECG, effusion, raised CRP, CMR oedema/LGE); the unverified "possible" category removed | 2025 ESC myocarditis & pericarditis (via Rev Esp Cardiol summary) |
| COPD record (inbox) | "P pulmonale (tall P in II, III, aVF)" as a general COPD feature, though the copd preset draws 1.7 mm | vertical P axis (> +60°); true P pulmonale (≥ 2.5 mm) with pulmonary hypertension, pointing to the pulmHtn preset | ecg-engine measurement; ecgStd5 |
| LQTS long-term | β-blockers "for all with the diagnosis" | for documented QT prolongation; should be considered in genotype-positive patients with normal QTc | ESC 2022 VA guideline |
| de Winter record | aVR STE "about 0.5–1 mm" in the ECG list, but 1–2 mm in the definition | 1–2 mm in most patients of the original series | de Winter 2008 (PMID 18987380), via review summaries |
| sinus tachycardia | "upright II, III, aVF" (NSR says lead III is variable) | "upright in I, II and aVF" | ecgStd1 |
| sinus arrhythmia mechanism | "baroreflex/Bainbridge" as the cause | central respiratory gating of vagal outflow, with lung-stretch and baroreceptor inputs | standard physiology |
| challenge L4 orthodromic AVRT | "+ pre-excitation in sinus rhythm = orthodromic AVRT" | pre-excitation only if the pathway is manifest (it may be concealed) | svt2015 |
| case: posterior STEMI | "prominent R in V1–V2" | relatively prominent; a tall broad R develops as the infarct evolves (matches the preset) | ecg-engine preset text |
| case: PE | QRS text omitted the S1Q3 the preset now draws | adds "S wave in I and a small q wave in III" | ecg-engine change |

## What I verified, and how
- **All 60 existing PMIDs in sources.ts**, through PubMed metadata in four batches: title, authors, journal, year, volume, issue, pages and DOI all match.
  - The three PMIDs cited only inside notes also exist and match: 42661421 (Fifth UDMI 2026), 41738055 (J-wave consensus 2026) and 37844667 (European Task Force for arrhythmogenic cardiomyopathy, 2024).
  - The notes on de Zwaan 1982, Boehnert 1985, Liebelt 1995 and Richman 2004 match their abstracts.
- **The 7 new sources** were checked by citation lookup, then by full metadata.
- **2025 AHA ACLS** (web search; the AHA site blocks direct fetches).
  - Electrical cardioversion algorithm: AF 200 J, flutter 200 J, narrow-complex 100 J, monomorphic VT 100 J; AF ≥ 200 J is 2a and flutter 200 J is 2b.
  - Adenosine 6 mg then 12 mg. Procainamide and amiodarone doses. The 2025 algorithm prints procainamide and amiodarone only; the guideline text still lists sotalol (2b) and adenosine only for regular monomorphic WCT. The ACLS card and the VT record already said this correctly.
  - Synchronised cardioversion is Class 1 for unstable WCT or when drugs fail. Verapamil and diltiazem are Class 3: Harm in WCT.
  - Vector change and double sequential defibrillation: "not established" after ≥ 3 shocks.
  - Bradycardia: atropine 1 mg every 3–5 min to a maximum of 3 mg, then dopamine 5–20 mcg/kg/min or epinephrine 2–10 mcg/min.
  - All of these already matched acls.ts, dx_rhythm, dx_conduction, dx_ventricular, cases and challenge. No ACLS dose needed changing.
- **AF anticoagulation and cardioversion:**
  - 2023 ACC/AHA: ≥ 2%/year (CHA₂DS₂-VASc ≥ 2 men, ≥ 3 women) is Class I; 1–2% is 2a.
  - 2024 ESC CHA₂DS₂-VA: ≥ 2 is Class I, 1 is IIa. Cardioversion thresholds are 48 h (US) and 24 h (ESC).
  - The calculator logic matches all of this.
- **Criteria checked, already consistent:**
  - UDMI ST elevation, depression and Q-wave thresholds; posterior and right-sided lead thresholds.
  - Sgarbossa and Smith; Cornell; Sokolow–Lyon.
  - RBBB, LBBB, LAFB and LPFB (2009 Part III); RVH; atrial abnormality.
  - QTc 450/460, ≤ 390, ≥ 500 / Δ60; ESC 2022 LQTS ≥ 480 or score > 3; athlete QTc 470/480.
  - Athlete 2017 criteria; ARVC Task Force criteria 2010; HCM AF anticoagulation (2024); Wellens, de Winter and Aslanger criteria.
- **Tests:**
  - `npx vitest run tests/ecg/content.test.ts`: 11 passing.
  - `npx vitest run tests/ecg` (once, at the end): 12 files, 1257 passing.
  - `tsc --noEmit` shows no errors in the content or test files.

## Found but not fixed
- **Fifth UDMI (2026):** PubMed has no abstract, so I could not check whether its ECG thresholds differ from UDMI 4. The existing source note already tells readers to check them.
- **Katz–Wachtel threshold:** "> 50 mm R + S in V2–V4" varies between sources (50 vs 60 mm, V2–V4 vs V2–V5). Left as is.
- **Osborn-wave temperature:** "typically below 30 °C" vs "prominent below ~32 °C" in the hypothermia record. Sources differ, so left as is.
- **Hyperkalaemia doses:** no calcium, insulin or dextrose doses are stated in the content (only drug names), so there were no doses to check. Adding them was out of scope for this pass.
- **Pericarditis wording:** the 2025 ESC guideline was checked only through a secondary summary. The new wording is deliberately general.
- **Line-by-line re-read:** I did not re-read every sentence of the ~80 diagnosis records (already audited twice on Oct 9). I covered all doses, thresholds, definitions and management fields by grep and targeted reading.

## Inbox
Items from ecg-engine:
- **COPD "P pulmonale":** fixed (see table).
- **AV-relation wording:** no content text quotes the old "x of y P waves conducted" read-out, so nothing needed aligning.
- **Preset text changes:**
  - stemiPosterior and PE: the cases now agree with the presets.
  - Takotsubo: the record already gives V2–V6 inversion with an upright T in aVR, which agrees with the preset.
  - highGrade: the record definition ("e.g. 3:1, 4:1") is still correct.

No new items arrived later. I sent nothing to other agents' inboxes, because I found no problems in files I do not own.
