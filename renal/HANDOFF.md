# Handoff: where the renal lab stands and what comes next

This file lets a new session (or a person) pick up the work without the chat history. Update it with every commit that changes the plan.

Branch: `claude/compassionate-mayer-vl169d`. Everything is committed and pushed. Nothing lives only in a local checkout. The build is content-complete — see section 4.

## 1. Getting it live (needs a person)

GitHub Pages deploys from the repository's default branch, `claude/flight-simulator-architecture-ck2cgq` (see `.github/workflows/deploy.yml`). That branch has since added the ECG app, so merging this branch into it conflicts in three files. Each conflict is two apps both adding themselves as a second entry point:

| File | Resolution |
|---|---|
| `vite.config.ts` | Keep **all three** inputs: `main` (index.html), `ecg` (ecg/index.html), `renal` (renal/index.html). The default branch uses `rolldownOptions` with `import.meta.dirname`, and this branch uses `rollupOptions` with `__dirname`. Use one key for all three (`rolldownOptions` + `import.meta.dirname` matches Vite 8). Keep this branch's `oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } }`. The ECG app has no JSX, so it is unaffected. |
| `package.json` | Take the union of dependencies: `cesium`, `preact`, `three`, and in devDependencies `@types/three`. |
| `package-lock.json` | Don't hand-merge. Take either side, then run `npm install` to regenerate it. |

Then run `npm test && npm run build`. Both must pass, since the deploy workflow runs them. Merge into the default branch, and the lab appears at https://ramanscattering3141-jpg.github.io/renal/.

**This merge has been performed and verified** (2026-09-30). Checking the default branch out and merging `claude/compassionate-mayer-vl169d` into it gives exactly the three conflicts above; resolving them as described, running `npm install`, then `npm run build` produces `dist/{index,ecg/index,renal/index}.html`, and `npm test` passes **425 tests across all three apps**. The resolved `vite.config.ts` uses `rolldownOptions` + `import.meta.dirname` with the three inputs and keeps the `oxc` Preact config; `package.json` lists `cesium`, `preact`, `three` in dependencies and adds `@types/three` in devDependencies. The merge result is a clean fast-forward of the default branch.

**Only the push to the default (deploy) branch remains, and it needs a person.** The session's auto-mode classifier allows pushing to this feature branch but blocks pushing to any other branch as a "shared resource", so the agent cannot publish. To finish, from a checkout: `git checkout claude/flight-simulator-architecture-ck2cgq && git merge origin/claude/compassionate-mayer-vl169d`, resolve the three files as above, `npm install && npm run build && npm test`, then `git push`. (Or grant the agent a push permission and it will complete the fast-forward.)

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

### What a next session could still do
The spec is broad; genuine polish items remain rather than missing modules:
- Liddle syndrome is only partially reproduced (the ENaC gain suppresses renin/aldosterone but does not fully produce the hypertension/hypokalaemia, because escape and other loops compensate). Same for Gordon's blood pressure.
- Nephrotic oedema is under-represented (the model lacks a primary nephrotic Na-avidity mechanism; it is discussed on `/edema` and `/glomerular` rather than simulated).
- Deeper "open in simulator" wiring: the clinical cases link to modules but do not yet pre-load their exact parameters into the target page's controls.
- More clinical cases and challenges from Rose ch. 29's problem set.

## 5. Known model limitations (keep documented, don't tune away)
- The anion gap runs a few mmol/L high in distal/type 4 RTA, NH₄Cl loading and diarrhoea. Chloride is tracked by mass balance so it can cause chloride-depletion alkalosis.
- Angiotensin-II thirst is omitted, because it destabilised oedematous states.
- Chronic respiratory compensation takes longer than 3–5 days.
- The glomerulus over-estimates the hyperfiltration of isolated hypoalbuminaemia (buffered by a half-rate oncotic term, but still present); nephrotic diseases are modelled with a matching Kf reduction.
- The emergency-hyperkalaemia treatment curves and the hyperkalaemia adaptation constants are fitted to Rose's stated effect sizes and time scales, not derived from first principles.
