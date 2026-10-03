# Handoff: where the renal lab stands and what comes next

This file lets a new session (or a person) pick up the work without the chat history. Update it with every commit that changes the plan.

Branch: `claude/renal-physiology-lab`. Everything is committed and pushed. Nothing lives only in a local checkout. The build is content-complete — see section 4.

## 1. Getting it live

GitHub Pages deploys from the repository's default branch, `claude/flight-simulator-architecture-ck2cgq` (see `.github/workflows/deploy.yml`). The default branch (with the ECG app) has been merged into this branch and the three entry-point conflicts resolved: `vite.config.ts` has `main`, `ecg` and `renal` inputs under one `rolldownOptions` key plus the `oxc` Preact JSX setting, and `package.json` lists `cesium`, `preact` and `three`. `npm test` (425 tests, all three apps) and `npm run build` pass on the merged result.

To publish, merge this branch's pull request into the default branch. The deploy workflow then tests, builds and publishes, and the lab appears at https://ramanscattering3141-jpg.github.io/renal/. Pages must be set to **Settings → Pages → Source: GitHub Actions** (one-time).

## 2. Standing rules for the content

- Built on Rose & Post, *Clinical Physiology of Acid-Base and Electrolyte Disorders*, 5th ed. (2001). Paraphrase only, with brief attributed quotations at most. Never a copy of the book.
- Don't invent references or mechanisms. Every external reference must be a real PubMed record, checked by PMID, added to `renal/src/content/pubmed.extra.ts`.
- Grade every claim (physiology / experimental / clinical / guideline / reasoning). Mark later changes to the book's picture as a modern update, with a source.
- Never present a mechanistic hypothesis as established clinical evidence. Never teach FeNa or urine Na as infallible.
- All displayed units SI (Canadian): mmol/L, µmol/L creatinine, mOsm/kg, g/L.
- The goal is a kidney you can play with (change a variable → see the consequence → understand why → connect to disease), not a mirror of the textbook.

## 3. Method that works

For each chapter: read it, then **test the engine against the chapter's figures and tables before writing any page**. Fix the engine where it disagrees and make each case a regression test in `tests/renal/physiology.test.ts`. Only then write `renal/src/content/chapters/chNN.ts` and the page in `renal/src/pages/`, and screenshot the page to catch render bugs.

`tests/renal/content.test.ts` checks that every reference id, route, equation id and cross-link resolves.

Useful engine calls (see `renal/src/engine/simulate.ts`, `renal/src/sim/hooks.ts`):
- `runToSteadyState(applyPatch(DEFAULT_PARAMS, patch), days, dt)` returns `{ state, ev }`. `ev.plasma.Na`, `ev.kidney.urine...`, `state.body` is the body state.
- `simulate(params, days, dt, startBody)` returns `{ points, state }`, a time course starting from a body state.
- In pages: `useStep(from, to, days, dt, settleDays)` returns `{ points, before, final, state, busy }`.

## 4. Status

**The build is content-complete.** Chapters 1–28 have interactive chapter content, and every module in the menu is live (60-plus pages; a page goes live the moment its file exists in `renal/src/pages/`, because `routes.ts` checks this). Chapter 30's equation summary is the equation explorer; chapter 29's worked problems seed the clinical cases and challenges. The full suite is green (`npx vitest run tests/renal`, 198 tests) and all routes pass a browser smoke test with no console errors (`smoke.tmp.mjs`, git-excluded).

Built since the ch24 handoff, in order:
- **ch25** hyperglycaemia / DKA / HHS → `/hyperglycemia`, with the crisis time-course simulator (`renal/src/sim/hyperglycemia.ts`).
- **ch26–27** hypokalaemia → `/hypokalemia`; **ch28** hyperkalaemia → `/hyperkalemia`. Both with the ECG (`renal/src/ui/EcgStrip.tsx`); hyperkalaemia has an emergency-treatment time course fitted to Rose's Table 28-4 effect sizes (a pharmacodynamic sketch, not the renal engine — noted on the page).
- **Minerals** → `/minerals` (Ca/Pi/Mg, PTH, calcitriol, FGF23, CKD–MBD).
- **Disease:** `/aki`, `/obstruction`, `/ckd`, `/glomerular`, `/tubulointerstitial`, `/inherited`.
- **Laboratory:** `/sandbox`, `/break`, `/whatif`, `/graph`, `/equations`, `/labs`.
- **Clinical:** `/cases`, `/lessons`, `/challenges`, `/tutor` (a retrieval tutor over the KB search index — no external model, so it never drifts from Rose).

Engine work done alongside these (all covered by the regression suite):
- Potassium adaptation of the secreting cells (`kAdapt`, slow, mineralocorticoid-gated); ammonium excretion scaled so it is preserved per nephron until GFR < 40–50; low-flow K⁺ secretion steepened and a basal aldosterone-independent ROMK conductance; ENaC loss blunts secretion.
- Escape from antidiuresis (`adhEscape`) and a milder cortisol→ADH drive, so chronic water retention stabilises instead of crashing the sodium.
- CKD minerals: realistic phosphate intake, phosphate reabsorption floored at ~20% (so Pi rises below GFR ~30), and a stronger PTH bone-calcium defence.
- Obstruction: Bowman's-space pressure scaled for a graded GFR fall; glomerulus: effective oncotic pressure falls at half rate in hypoalbuminaemia so nephrotic hyperfiltration is modest, not doubled.

### Added on 2026-09-30 (second pass)
- Light theme with a Light / Dark / Auto switch; every hard-coded colour became a theme variable.
- Nephron drawing: dark text on a halo instead of tubule-coloured labels, values in pills, marked sites glow in a colour distinct from the tubule, optional side callouts (`callouts`), `dimUnmarked`, `heat` and `tubeColor` props. The hormones page uses it full width with per-site action notes (`SITE_ACTIONS` in `content/hormones.ts`); the explorer diagram is larger and sticky.
- Flow simulator: pause, 0.1×–2× speed, particles visibly crossing out (reabsorbed) or in (secreted), and a green/red band under each segment scaled to its share.
- Charts: real axis titles everywhere; the rescaled series were split into stacked panels via `Series.axis`. The GFR Starling chart was redrawn with axis titles, % ticks and a legend.
- Body water: 100 kg / 60 L reference person (ch. 7 worked examples redone in round numbers, noting Rose’s 70 kg).
- New `/iv-fluids` (`sim/ivfluids.ts`, regression tests in `tests/renal/ivfluids.test.ts`, checked against Lobo 2001 and Hahn 2010) and `/drug-map` (`content/drugmap.ts`). 22 new PubMed references, each checked by PMID.

### Added on 2026-09-30 (third pass: equations at the bedside + review fixes)
- 11 new equations: `furst`, `unauk`, `maxuv`, `fek`, `kdeficit`, `fehco3`, `femg`, `fepo4`, `cccr`, `ureacr`, `upcr`. Four new PubMed references, each checked by PMID: `furst2000`, `lee2021unak`, `elisaf1997femg`, `christensen2011fhh`.
- Worked patient cases (`content/equationCases.ts`, attached to `EquationDef.patient`) for 29 equations; the card shows “How it works” and “Try it on a patient” even in compact mode.
- `BedsideEquations` panels added to hyponatraemia, oedema, diuretics, minerals, RTA, pre-renal vs ATN, AKI, glomerular, metabolic acidosis, hypernatraemia, urine osmolality, hyper/hypokalaemia and mixed disorders. New page `/bedside` (`pages/Bedside.tsx`). The equation explorer has a “with a worked patient” filter.
- Edelman card now displays the regression it computes (1.11 × … − 25.6).
- Review fixes: pages that set `grid-main-side` columns inline (nephron explorer, flow simulator, IV fluids, hormones) now use the `--main-side` CSS variable so they stack on phones instead of overflowing. Search inputs on tutor, graph and equations have accessible labels.
- `tests/renal/equations.test.ts`: case values fit their sliders, every equation computes, and the worked answers are reproduced.

### Added on 2026-09-30 (fourth pass)
- **Diuretic map** (`ui/DiureticMap.tsx`, content in `content/diureticMap.ts`): the first tab of `/diuretics`. Every class drawn at its site with an inhibition bar; hover/tap/keyboard selects a segment or drug; the side panel shows the transporter cell, drug cards (effects on Na⁺, K⁺, Ca²⁺, Mg²⁺, acid–base, water), and a comparison table below.
- **Units switch** (`ui/unitPref.ts`, sidebar “SI units / mg/dL”): equation cards and the laboratory interpreter accept and show conventional units (mg/dL, BUN, g/dL) and convert to SI before calculating. Simulator readouts stay SI. Equation cards also take typed values beside each slider.
- **Cases open in the sandbox**: each clinical case links to `/sandbox?s=…` (encodeState of its parameter patch); the sandbox reads it and shows where it came from. The sandbox gained glucose and ketoacid dials so the DKA case loads fully.
- The tutor is titled “Ask the tutor” and described as retrieval, not AI.

### Added on 2026-10-01 (charts pass)
- **Chart attribute bug fixed:** the lab uses Preact without `preact/compat`, so camelCase SVG attributes (`textAnchor`, `strokeWidth`, `strokeDasharray`, `strokeLinejoin`) were written literally and ignored by the browser. In `LineChart` this made every y-tick label start-anchored (running into the axis), axis titles off-centre, all lines 1 px and dashed series solid. Always write SVG attributes in kebab-case (`text-anchor`, `stroke-width`) in this codebase; style objects may stay camelCase.
- `LineChart`: the left margin now fits the widest tick label, and the y-axis title is wrapped onto its own line(s) above the plot (`wrapText` in `ui/kit.tsx`).
- GFR page: the Starling profile is now two stacked panels. The top one shows each force on its own (titled so it is clear it is not the net), and the bottom one shows the net filtration pressure = Pgc − (Pbs + π), with its value at the afferent end, its mean, and where it reaches zero. It measures its width so text stays the same size on phones.
- Glucose, ammonium, body-water and countercurrent diagrams re-laid out so no text is clipped or drawn over arrows. Fixed-size diagrams (those plus free water, RAAS and the acid–base map) sit in `.svg-scroll`, which keeps a minimum width on phones and scrolls sideways instead of shrinking text to 4–6 px.

### What a next session could still do
The spec is broad; genuine polish items remain rather than missing modules:
- Liddle syndrome is only partially reproduced (the ENaC gain suppresses renin/aldosterone but does not fully produce the hypertension/hypokalaemia, because escape and other loops compensate). Same for Gordon's blood pressure.
- Nephrotic oedema is under-represented (the model lacks a primary nephrotic Na-avidity mechanism; it is discussed on `/edema` and `/glomerular` rather than simulated).
- Cases now open the sandbox pre-set; the topic modules they also link to still open at their defaults.
- More clinical cases and challenges from Rose ch. 29's problem set.
- Extend the mg/dL switch to simulator readouts (currently SI only).

## 5. Known model limitations (keep documented, don't tune away)
- The anion gap runs a few mmol/L high in distal/type 4 RTA, NH₄Cl loading and diarrhoea. Chloride is tracked by mass balance so it can cause chloride-depletion alkalosis.
- Angiotensin-II thirst is omitted, because it destabilised oedematous states.
- Chronic respiratory compensation takes longer than 3–5 days.
- The glomerulus over-estimates the hyperfiltration of isolated hypoalbuminaemia (buffered by a half-rate oncotic term, but still present); nephrotic diseases are modelled with a matching Kf reduction.
- The emergency-hyperkalaemia treatment curves and the hyperkalaemia adaptation constants are fitted to Rose's stated effect sizes and time scales, not derived from first principles.
