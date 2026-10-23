# endo-content report: Endocrine-and-Metabolism- (text and facts)

Repo: `/home/user/Endocrine-and-Metabolism-`. I ran no git commands that change state. `node tests/physiology.test.js` passes 470/470, before and after my edits. I changed only text: no geometry, no node x/y or via points, no CSS. I changed no logic in `js/core` either; the only edits there are four visible string literals (see Spelling).

## Inbox (`inbox/endo-content.md`)
- endo-ui's layout edits in js/data (the liver panel title, the `via` routes, node `dag`, the calcium re-layout and the rest) are all kept. My edits touch only `why`/`desc`/`info`/`clin` text and `refs` lists, never positions.
- README said "**Insulin prototype**". It now says "**Insulin signaling**". The home tile tag "Prototype" is now "Animation".

## How I checked
- **References:** I checked all 58 existing PubMed-cited refs in `js/data/refs.js` against PubMed (PMID ↔ authors, title, journal, year, volume, pages, DOI). All matched, so no PMID or DOI needed fixing. Every ref id used anywhere (`refs:[]`, `EP.sources([...])`, `{{ref:id}}`) resolves to a defined ref. I added 13 new refs, each one fetched from PubMed before use.
- **Petersen & Shulman 2018:** I checked the insulin-resistance guide's numbers against the PDF in the repo: lipolysis ED50 ~20 µU/mL vs ~60 µU/mL for glucose uptake; ~75% of muscle glucose to glycogen; portal half-maximum 20–25 µU/mL; NEFA falling ~90%; CGI-58 raising ATGL activity ~20-fold; macrophage infiltration at 12 weeks of high-fat diet; DNL ~25%, re-esterification ~60% and diet 15%; AKT2 variant in ~1% of Finns; TBC1D4 Thr649. All are supported.
- **Other numbers:** I checked these against PubMed abstracts: Rothman 1991 (64/82/96%), Petersen 2005 (8 kg, 81%), Petersen 2007 (~60% less glycogen, >2× DNL), Donnelly 2005 (59/26/15%), Lambert 2014 and Liu 2006 (67/90/100% recovery).
- **Smoke test:** I loaded 26 routes in headless Chromium, including the testing lab with tests ordered and the HHS clinical state. There were no console errors, and the new text renders. The server is stopped.

## Factual corrections (old → new, source)

| Where | Old | New | Source |
|---|---|---|---|
| testlab.js 24-h UFC | "the preferred way to confirm hypercortisolism" | One of the recommended first-line tests (with late-night salivary cortisol and the 1 mg dexamethasone test); collect at least two | Nieman 2008 (Endocrine Society) |
| testlab.js low-dose DST | No cut-off | 8 a.m. cortisol >50 nmol/L (1.8 µg/dL) after 1 mg at 11 p.m. is abnormal | Nieman 2008 |
| testlab.js high-dose DST | "Used only to localize…" | Adds that MRI and inferior petrosal sinus sampling now do most of this | Current practice (wording only) |
| testlab.js CRH test, Cushing disease | "Exaggerated ACTH & cortisol rise (~2-fold)" (unsourced number) | "ACTH & cortisol rise" | Number removed: no source |
| testlab.js cosyntropin | No cut-off | Peak <500 nmol/L (18 µg/dL) at 30/60 min after 250 µg = adrenal insufficiency; with newer specific immunoassays or LC-MS/MS the cut-off is ~14–15 µg/dL (≈390–415 nmol/L) | Bornstein 2016; Javorsky 2021 (new ref) |
| testlab.js renin/aldosterone (Conn) | — | High ARR is the screening test; screen everyone with hypertension | Adler 2025 Endocrine Society PA guideline (new ref) |
| testlab.js salt loading | "aldosterone-producing tumors keep secreting" | Autonomous production (adenoma or bilateral hyperplasia) continues; suppression testing when it changes management | Adler 2025 |
| testlab.js GH on OGTT | No cut-off | GH nadir ≥1 µg/L after 75 g glucose with high IGF-1 confirms acromegaly; cut-offs are assay-dependent | Katznelson 2014 (new ref) |
| testlab.js water deprivation (CDI) | Plasma ADH only | Adds copeptin: after hypertonic saline, copeptin >4.9 pmol/L points to primary polydipsia rather than central DI | Fenske 2018 NEJM (new ref) |
| pathways-extra.js hypoglycemia | "~50 mg/dL" neuroglycopenia; "about 54 mg/dL" autonomic symptoms; GH/cortisol "follow, acting over hours"; no glucagon/epinephrine threshold | Glucagon/epinephrine at 3.6–3.8 mmol/L (65–69 mg/dL); autonomic symptoms at 3.0–3.2 mmol/L (53–58); neuroglycopenia and cognitive dysfunction near 2.8 mmol/L (~50); GH ~3.7 mmol/L (66) and cortisol ~3.2 mmol/L (58), released at similar thresholds but acting over hours; insulin falls while glucose is still normal | Schwartz 1987; Mitrakou 1991 (new refs) |
| pathways-extra.js DKA/HHS osmolality | "Lethargy… past ~300 mOsm/L; coma above ~330" (wrong unit, unsourced numbers) | Confusion → stupor → coma track effective osmolality (2 × Na⁺ + glucose) | Umpierrez 2024 consensus (new ref); Molina Ch7 |
| pathways-extra.js DKA state | "absolute insulin deficiency, type 1"; no criteria | Also occurs in T2D, including euglycemic DKA on SGLT2 inhibitors. Criteria: glucose ≥11.1 mmol/L (200 mg/dL) or known diabetes; β-OHB ≥3.0 mmol/L (or urine ketones ≥2+); pH <7.3 and/or HCO₃⁻ <18 mmol/L | Umpierrez 2024 (ADA/EASD/JBDS/AACE/DTS) |
| pathways-extra.js HHS state | "nonketotic"; no criteria | Glucose ≥33.3 mmol/L (600 mg/dL); effective osmolality >300 mOsm/kg (or total >320); β-OHB <3.0 mmol/L; pH ≥7.3 and HCO₃⁻ ≥15 mmol/L; mixed DKA–HHS occurs | Umpierrez 2024 |
| pathways-extra.js PCOS | "Oligo-/amenorrhea, high androgens and multiple ovarian cysts" (implied all three, "cysts") | Rotterdam criteria: 2 of 3 after excluding other causes (ovulatory dysfunction; clinical/biochemical hyperandrogenism; PCOM on ultrasound or raised AMH in adults). "Cysts" explained as arrested antral follicles | Teede 2023 international guideline (new ref) |
| pathways-extra.js PCOS | "Chronic anovulation causes >80% of amenorrhea" | "a leading cause of oligo-/amenorrhea and infertility" | Unverifiable figure removed |
| entities.js insulin | — | Added diabetes/prediabetes diagnostic thresholds: FPG ≥7.0 mmol/L (126 mg/dL); 2-h 75 g OGTT ≥11.1 (200); HbA1c ≥6.5% (48 mmol/mol); random ≥11.1 with symptoms; prediabetes 5.6–6.9 / 7.8–11.0 / 5.7–6.4% | ADA Standards of Care 2026, section 2 (new ref) |
| entities.js epinephrine | "β1/β3: lipolysis" | "adipocyte β-receptors (Gs): lipolysis" (β3 is minor in human fat) | Standard physiology |
| entities.js insulin receptor | "serine phosphorylation of IRS (PKCε/θ…)" | PKCε → INSR Thr1160 (liver); PKCθ → IRS-1 serine (muscle) | Petersen & Shulman 2018 |
| entities.js COMT/MAO | "Plasma free metanephrines are the preferred screening test" | "Plasma free **or urinary fractionated** metanephrines are the recommended first tests" | Lenders 2014 (new ref) |
| entities.js GLP-1 | "GLP-1 RAs and DPP-4 inhibitors treat T2D/obesity" | GLP-1 RAs treat T2D and obesity; DPP-4 inhibitors (prolong GLP-1/GIP) treat T2D | Standard pharmacology |
| entities.js / pathways-pancreas.js / cascades.js TBC1D4 | Greenlandic TBC1D4 variant credited to "(Petersen & Shulman)", but it is not in that review | p.Arg684Ter, allele frequency 17%; ↓ muscle GLUT4 and uptake → postprandial hyperglycemia and T2D | Moltke 2014 Nature (new ref) |
| cascades.js NPR-A loss | "salt-sensitive hypertension in animal models" | NPR-A knockout mice have hypertension that does **not** change with salt intake | Lopez 1995 Nature (new ref) |
| metabolic-model.js CREB/CRTC2 | "PKA … dephosphorylates/activates CRTC2" | PKA inhibits salt-inducible kinases, so CRTC2 becomes dephosphorylated | Koo 2005 |
| metabolic-model.js AMPK | "ACC (Ser79/Ser221)" (mixed-species numbering) | "ACC1 (Ser79) and ACC2" | P&S 2018 uses ACC2 Ser212 (mouse), so the species-specific number was removed |
| networks.js phosphate | "fractional excretion (the inverse of TmP/GFR)" | "the higher it is, the lower TmP/GFR" | Definition |
| networks.js vitamin D deficiency | "Low calcitriol substrate" | "Low 25-OH-D (the substrate for calcitriol)" | Clarity |
| anim.js dexamethasone | "not bound by CBG… not a substrate for 11β-HSD2" (incorrect: 11β-HSD2 does oxidize dexamethasone) | Binds CBG poorly; potent GR agonist with little MR activity; barely cross-reacts in cortisol assays, so ACTH can be suppressed while endogenous cortisol is measured | Pharmacology |
| thyroidx.js Hashimoto | "antibodies impair the Na⁺/I⁻ symporter" | T-cell-mediated thyrocyte destruction, with anti-TPO/Tg antibodies as markers; most common cause of hypothyroidism **where iodine intake is adequate** (iodine deficiency is the global leading cause, as stated elsewhere on the site) | Standard pathophysiology |
| irguide1.js DNL (4 places) | "~10% of liver TG output in **healthy** people (Lambert 2014)"; bar row "Healthy" | "with low liver fat", "~10% of fasting VLDL-TG in people with low liver fat"; bar row "Control" (Lambert's controls were metabolically matched, not healthy). DNL is still described as a minor route that rises with carbohydrate/fructose and in NAFLD (~25%) | Lambert 2014 abstract; Donnelly 2005 |
| refs.js Lambert note | ">3-fold higher DNL (23% vs 10%)" | >3-fold higher absolute DNL, **2×** its share of VLDL-TG palmitate (23% vs 10%) vs matched low-liver-fat subjects; not suppressed by fasting | Lambert 2014 abstract |
| irguide1.js AS160 | "Thr649" | "Thr649 in mice, Thr642 in humans" (the site uses Thr642 elsewhere) | P&S 2018; Sano 2003 |
| glut4.js | "muscle glucose uptake rises ~3–4×" (stated as fact) | "in the model, … rises about 3–4× while insulin falls slightly" (model output: 3.6×, insulin 0.91×) | Model output |
| common.js home tile | "Six organs" | "Eight organs" (flux map has 8; README already said 8) | Code |
| explore.js cases | Glucose 28 mmol/L, 2.1 mmol/L | Adds mg/dL in parentheses: 504 and 38 mg/dL | Unit convention |

## Wording and dev-speak
- I removed "uploaded"/"requested but not among the uploaded files" wording from refs.js (header, Molina, Williams, Petersen notes), the Sources page in common.js, and README. Williams is now "authoritative further reading; nothing attributed to a specific chapter". README no longer claims the textbooks are in the repo (only the P&S PDF is).

## Spelling: the site is American, now consistently
Fixed in js/data and js/views: favour(s), Oxidised/oxidise, stabilises, normalised, organised, summarising, hydrolyse/-es/-ed/-ing, catalyses, lipolysed, colour(ed/s), labelled, modelled, travelling, remodelling, programme, defence, neighbour(ing), channelled, centre, behaviour, fibre(s), litres, kilometre. "müllerian/wolffian" are now capitalized "Müllerian/Wolffian" everywhere. Paper titles in refs.js keep their original spelling ("signalling", "glycaemic").

Four visible strings in js/core also said "colour". They are now "color": "Color key" (pathway.js:304), "Box color = kind of molecule" (pathway.js:749), "Box color = kind of signal" and "Line colors:" (network.js:142, 206), and "Click a colored band" (cascade.js:242). These are string literals only, with no logic or geometry change. I touched core only to stop the color key widgets mixing spellings; revert if you want core untouched.

## New references (all PubMed-verified)
- umpierrez2024 39052901
- schwartz1987 3546378
- mitrakou1991 1987794
- javorsky2021 33768189
- adler2025 40658480
- katznelson2014 25356808
- fenske2018 30067922
- lenders2014 24893135
- teede2023 37589624
- lopez1995 7477288
- moltke2014 25043022
- ada2026 41358893 (Diabetes Care 2026;49 Suppl 1:S27–S49)

They are wired into the testing lab sources, counterregulation, DKA/HHS, PCOS, ANP cascade, insulin pathway and insulin cascade ref lists, so they show in each page's Sources list and on the Sources page.

## Checked and left as is
Hormone sources and receptors, second messengers, binding proteins and half-lives, all steroidogenic enzyme names and deficiency phenotypes, deiodinases, thyroid synthesis, the Ca/PTH/calcitriol/FGF23/Klotho relationships, RAAS and K⁺, the insulin/glucagon nodes, GLUTs, sexual differentiation, menstrual-cycle curve shapes, pregnancy, the exogenous androgen section, and the flux presets. The test expectations for fed, fasting, exercise, T1D and T2D are physiologic. I fixed no model direction, so I added no test.

## Not fixed (could not verify; left attributed to the textbook)
- thyroidx.js: the Wolff–Chaikoff iodide range "~15–20 µg/dL (Kovacs Ch12)".
- thyroidx.js: "acute thyroiditis: reverse T3 increased (Molina Ch4)".
- PC "obligate allosteric activator" wording.

The textbook PDFs are not in the repo, so none of these could be checked.

## Inboxes
I sent nothing to other agents. `previous-instructions.md` does not exist yet. From `notes.md`, the Endo standing asks are: overlap-free text, exogenous androgens, vetting for content errors, the DNL contribution, and simulation accuracy. All are addressed for text.
