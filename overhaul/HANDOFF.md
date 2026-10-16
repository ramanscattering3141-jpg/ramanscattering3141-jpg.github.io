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
| ECG pages/UI | Not started (agent `ecg-ui`). |
| Renal content/model | **Done** — 35 corrections; see `reports/renal-model.md`. |
| Renal pages/UI | **Done** — keyboard access, readable diagrams on phones, labels off lines, theme colours, British titles, `tools/renal-smoke.mjs` (310 visits pass); see `reports/renal-ui.md`. Oxygen-target modern update (BTS 2017) added by the lead. |
| Endocrine | UI/diagram audit in progress (agent `endo-ui`); content audit (`endo-content`) next. Priorities from the user's earlier sessions: no text overlapping arrows/lines; per-diagram animation pause; more diagrams, less text; collapsible pathways; vet content. |
| Final | Full test suites, builds, smoke crawls, README updates, then ask the user before merging to the deploy branch (`claude/flight-simulator-architecture-ck2cgq` here, `main` for endo). |
