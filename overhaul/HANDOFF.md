# Publication overhaul — handoff

Everything for the overhaul of the ECG lab (`/ecg/`), the renal lab (`/renal/`) and the endocrine lab
(separate repo `Endocrine-and-Metabolism-`) lives on branch **`claude/publication-overhaul`** in both
repositories. It is pushed after every milestone, so a new session can pick it up from GitHub alone.

The user's request: *"Take the ecg site, the Endo and renal phys sites, pore through any mistake using sub
agents as needed, and fix everything. Make this publication worthy as a site, take all my previous
instructions and make sure it is perfect. Especially that heart simulator I want you to rebuild it and make it
fantastic easy to read easy to see look online for inspiration if necessary."* Also: when a usage limit is
reached, everything must already be on GitHub so work can resume easily.

## How to resume
1. Check out `claude/publication-overhaul` in both repos; `npm ci` in this one.
2. Read this file, `overhaul/AGENT-RULES.md` (rules every helper agent follows: file ownership, no git state
   changes by helpers, build into scratch dirs, PubMed-verify references, keep tests green),
   `overhaul/reports/*` (finished audits) and `overhaul/inbox/*` (open items per area).
3. Previous sessions' instructions: `overhaul/previous-instructions-*.md` (the ECG master spec, renal/endo
   standing rules) plus `renal/HANDOFF.md` and the endocrine repo's README.
4. Usage is limited: run at most two helper agents at a time; commit and push after each finished piece.

## Status (update with every push)

| Area | State |
|---|---|
| Unmerged earlier branches | Merged: `claude/ecg-lab-overhaul`, `claude/nephron-flow-simulator-wcjm43` (this repo); `claude/endo-anim-controls-androgens` (endo). Not merged on purpose: `claude/insulin-physiology-chapter` (text-first chapter, superseded by the user's later request for the diagram-first guide). |
| ECG engine | **Done** — all ECG tests green (criteria, fidelity, fuzz); see `reports/ecg-engine.md`. |
| Heart simulator | **Rebuilt and verified** (`src/ecg/ui/heart/`, tests in `tests/ecg/heart.test.ts`): anatomical SDF heart meshed in a Web Worker, per-beat geodesic activation in 3-D textures, four-chamber/short-axis cuts, six colour modes, conduction-system animation, contraction, valves, vector, inspector; narration with a live conduction-pathway tracker; new playback bar; heart page with rhythm groups; phone layout and label decluttering; Wiggers diagram labels/legend. Checked visually: normal, LBBB, WPW, VT, flutter, AF, complete block, VVI, anterior STEMI, dextrocardia, embedded panels in dark theme. Old `ui/heart3d.ts`/`ui/explainer.ts` removed. |
| ECG content | **Done** — 22 corrections; see `reports/ecg-content.md`. |
| ECG pages/UI | **Done** — crisp ECG paper (pixel-snapped grid, annotation lane, phone 6×2 12-lead), navigation (404 page, section highlighting, skip link, focus), home page that links everything, accessible cases/challenge, British-spelling search, 243-route smoke test passes; see `reports/ecg-ui.md`. |
| Renal content/model | **Done** — 35 corrections; see `reports/renal-model.md`. |
| Renal pages/UI | **Done** — keyboard access, readable diagrams on phones, labels off lines, theme colours, British titles, `tools/renal-smoke.mjs` (310 visits pass); see `reports/renal-ui.md`. Oxygen-target modern update (BTS 2017) added by the lead. |
| Endocrine | **UI/diagrams done and live** (crawl of 48 pages on desktop and phone: text-over-line 199→0, text-over-text 10→0, tiny text 1337→28 desktop / 2579→0 phone, 0 console errors; per-diagram animation pause). **Content audit done and live** (~30 corrections, 12 PubMed-verified references added, all 58 existing verified, consistent American spelling); see `reports/endo-content.md`. Priorities from the user's earlier sessions: no text overlapping arrows/lines; per-diagram animation pause; more diagrams, less text; collapsible pathways; vet content. |
| Live | The user asked to make it active (2026-10-23). Verified (1675 tests, ECG smoke 243 routes, renal smoke 310 visits, endo crawl 48 pages) and fast-forwarded: endo `main` → content audit (live); github.io deploy branch `claude/flight-simulator-architecture-ck2cgq` → 17b8f45 (Actions deploy). Keep working on `claude/publication-overhaul` and fast-forward the live branches after each verified piece. |

## Open items (small, documented in the reports)
- Endocrine: 23 small (~8 px) labels in the metabolic-flux diagram on desktop; three textbook-only claims unverified (Wolff–Chaikoff iodide range, reverse T3 in acute thyroiditis, acetyl-CoA as obligate pyruvate-carboxylase activator).
- Renal: one dashed drug-map line passes behind the ROMK/BK glyph; a few 9 px labels in dense diagrams; an unreachable "in preparation" screen in `renal/src/App.tsx`.
- ECG: search ranking matches short queries inside words (e.g. "AF" → bifascicular); the #/ischemia ST highlight uses simplified V2–V3 thresholds (it has no age/sex input).
