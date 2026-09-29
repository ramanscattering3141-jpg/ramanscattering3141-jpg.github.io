# Handoff: where the renal lab stands and what comes next

This file lets a new session (or a person) pick up the work without the chat history. Update it with every commit that changes the plan.

Branch: `claude/compassionate-mayer-vl169d`. Everything is committed and pushed. Nothing lives only in a local checkout.

## 1. Getting it live (needs a person)

GitHub Pages deploys from the repository's default branch, `claude/flight-simulator-architecture-ck2cgq` (see `.github/workflows/deploy.yml`). That branch has since added the ECG app, so merging this branch into it conflicts in three files. Each conflict is two apps both adding themselves as a second entry point:

| File | Resolution |
|---|---|
| `vite.config.ts` | Keep **all three** inputs: `main` (index.html), `ecg` (ecg/index.html), `renal` (renal/index.html). The default branch uses `rolldownOptions` with `import.meta.dirname`, and this branch uses `rollupOptions` with `__dirname`. Use one key for all three (`rolldownOptions` + `import.meta.dirname` matches Vite 8). Keep this branch's `oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } }`. The ECG app has no JSX, so it is unaffected. |
| `package.json` | Take the union of dependencies: `cesium`, `preact`, `three`, and in devDependencies `@types/three`. |
| `package-lock.json` | Don't hand-merge. Take either side, then run `npm install` to regenerate it. |

Then run `npm test && npm run build`. Both must pass, since the deploy workflow runs them. Merge into the default branch, and the lab appears at https://ramanscattering3141-jpg.github.io/renal/.

The agent tried to merge the default branch into this branch, and the session's permission system blocked it. A person needs to do the merge, or allow it.

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

**Done:** chapters 1–23 of content, and 41 working modules (listed in `renal/README.md`). Unwritten modules are marked "in preparation" automatically. A page becomes live the moment its file exists in `renal/src/pages/`, because `routes.ts` checks this.

**In progress: chapter 24, hypernatraemia and the diabetes insipidus states.** The route is already registered: `/water-disorders` → `renal/src/pages/WaterDisorders.tsx` (not written yet), chapters [24].

The engine already reproduces the water-deprivation test (Rose Fig. 24-6 / Table 24-4). Start the patient in the state shown, deprive them of water, then give desmopressin:

```
                     start Na / uOsm / uVol      deprived Posm / uOsm   + desmopressin uOsm (rise)
normal               139.1 / 556 / 1.5 L/d      295 / 1179             1180 (0%)
complete central DI  184.8 / 37 / 17.8 L/d      380 / 37               411 (1021%)
partial central DI   142.4 / 390 / 2.1 L/d      304 / 799              1148 (44%)
nephrogenic (lithium)156.0 / 80 / 10.3 L/d      372 / 81               83 (3%)
partial nephrogenic  143.6 / 292 / 2.8 L/d      310 / 347              359 (4%)
primary polydipsia   137.5 / 56 / 15.2 L/d      294 / 1226             1232 (1%)
```

Rose's criteria: a 100–800% rise in complete central DI, 15–50% in partial central DI, little or none in nephrogenic DI, none in normals. The patches used for these states are in the regression tests (see step 1 below).

**Correcting hypernatraemia.** A run starting from Na 185 (central DI, no thirst, 1.2 L/day intake; TBW 32 L; Rose water deficit = TBW × (Na/140 − 1) ≈ 10 L) now works, after commit 4f8209c fixed the survivability guard. With desmopressin + quarter-isotonic saline 4 L/day, the sodium fell 15 mmol/L/day. That is faster than Rose's maximum safe rate of 0.5 mmol/L/h (12 mmol/L/day). The page should let the reader choose a regimen and see whether it breaches that limit.

### Next steps for chapter 24
1. ~~Regression tests for the water-restriction test~~ Done: `tests/renal/physiology.test.ts`, "the water-restriction test (Fig. 24-6, Table 24-4)". The protocol lives in `renal/src/sim/deprivation.ts` (`waterDeprivationTest`, `DEPRIVATION_PATIENTS`) and runs in the worker through `useDeprivation(patch)` in `sim/hooks.ts`.
2. ~~Thirst~~ Fixed: the engine's thirst gain was too shallow, so untreated central DI *with thirst* reached Na 185. It is now about 3 L/day per mOsm/kg above threshold (`thirstDrive` in `engine/simulate.ts`, mirrored in `sim/osmoregulation.ts`). DI now sits at Na 142–144 and primary polydipsia at 137.5, as Rose says.
3. ~~`ch24.ts`~~ Done, with three verified modern updates (copeptin, `fenske2018copeptin`; the AVP-D/AVP-R renaming, `arima2022rename`; the correction rate in adults, `chauhan2019hypernat`).
4. **Next: build `renal/src/pages/WaterDisorders.tsx`** with tabs `thirst`, `deprivation`, `correct`, `polyuria`.
   - `deprivation`: `useDeprivation(DEPRIVATION_PATIENTS[i].patch)` gives hourly samples (Posm, Uosm, flow, Na, weight loss), the stop reason and the % rise with desmopressin.
   - `correct`: complete central DI with no thirst has **no steady state**, so it cannot be the start. Build the start by withholding water (`thirstIntact: false, waterIntake: 0`) from a settled patient until Na ≈ 165, then treat for 72 h. Fluids available as params: `ivD5W`, `ivNS` (L/day); quarter-isotonic saline = 0.75 D5W + 0.25 NS. Show the Na trajectory against the 12 mmol/L/day line, and Rose's deficit estimate.
   - `polyuria`: water vs solute diuresis from steady states of `{centralDI: 1}`, `{waterIntake: 12}`, `{ivNS: 6}`, `{proteinIntake: 260}`, `{glucose: 30}`.

### After chapter 24
- ch25 hyperglycaemia / DKA / HHS → `/hyperglycemia`
- ch26–28 potassium → `/hypokalemia`, `/hyperkalemia` (with ECG)
- ch29–30 → `/minerals`
- Disease modules: AKI, obstruction, CKD, glomerular, tubulointerstitial, inherited
- Laboratory: sandbox, break-the-kidney, what-if, knowledge graph, equation explorer, lab interpreter, cases, lessons, challenges, tutor
- Final: `npm run build`, a browser smoke test across all routes, merge.

## 5. Known model limitations (keep documented, don't tune away)
- The anion gap runs a few mmol/L high in distal/type 4 RTA, NH₄Cl loading and diarrhoea. Chloride is tracked by mass balance so it can cause chloride-depletion alkalosis.
- Angiotensin-II thirst is omitted, because it destabilised oedematous states.
- Chronic respiratory compensation takes longer than 3–5 days.
