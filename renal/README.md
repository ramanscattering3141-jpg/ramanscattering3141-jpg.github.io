# Renal Physiology Laboratory

An interactive renal physiology and pathophysiology laboratory built on the reasoning of Rose & Post, *Clinical Physiology of Acid-Base and Electrolyte Disorders* (5th ed., McGraw-Hill, 2001). The idea is to **change a variable, see what happens, understand why, and connect it to disease**. It is not a web copy of the textbook. Every simulator runs on the same model of the kidney and body fluids, so a change anywhere carries through the whole chain from transporter to lab result.

All displayed units are SI (Canadian): mmol/L for electrolytes, glucose and urea, µmol/L for creatinine, mOsm/kg, g/L for albumin. Blood-gas PCO₂ is shown in mmHg.

> Educational simulation. The model aims to be internally consistent and to match the physiology qualitatively. Its numbers are illustrative, and it is not a clinical decision tool.

## Running it

```sh
npm install
npm run dev          # then open http://localhost:5173/renal/
npm test             # engine, physiology and content-integrity tests (about 4 minutes)
npm run build        # typecheck + production build into dist/ (the lab lands in dist/renal/)
```

The lab shares this repository's Vite build with the flight simulator at the site root. It is a second entry point (`renal/index.html`) and uses Preact. On GitHub Pages it is served at `/renal/` from whichever branch the Pages workflow (`.github/workflows/deploy.yml`) deploys.

## What is finished

**Chapters 1–24** of Rose & Post have an interactive rebuild in the textbook view (`#/textbook`). Each chapter has its thesis, key concepts with causal chains, key numbers, equations, clinical connections, pathology, questions and sourced modern updates.

**42 modules are working:**

- *The nephron:* nephron explorer, nephron flow simulator, tubular transport lab, hormones
- *Filtration & clearance:* glomerular filtration, afferent/efferent lab, autoregulation, renin–angiotensin–aldosterone, clearance, fractional excretion, GFR & creatinine kinetics
- *Tubular transport:* proximal tubule, glucose & SGLT2, loop of Henle, countercurrent multiplication, vasa recta, urea recycling, distal nephron
- *Water, sodium & volume:* body water & serum sodium, sodium & effective volume, ADH & water balance, urine osmolality, free-water clearance, hyponatraemia simulator, hypernatraemia & polyuria (thirst, the water-restriction test, correction rates, water vs solute diuresis), hypovolaemic states, oedematous states
- *Potassium:* potassium balance
- *Acid–base:* acid–base engine, bicarbonate handling, ammonium excretion, titratable acid, metabolic acidosis, metabolic alkalosis, renal tubular acidosis, respiratory disorders, simple & mixed disorders
- *Drugs & clinical:* diuretic lab, pre-renal vs ATN, urine chemistries

**In preparation.** These modules appear dimmed in the menu and open to a "being written" page with links to their textbook chapters:
hyperglycaemia/DKA/HHS (ch. 25), potassium disorders (ch. 26–28), calcium/phosphate/magnesium, AKI, obstruction, CKD, glomerular, tubulointerstitial and inherited tubular disease, clinical cases, the sandbox, break-the-kidney, what-if, knowledge graph, equation explorer, lab interpreter, guided lessons, challenges and the AI tutor.

## How it is built

```
renal/src/
  engine/    the model: glomerulus (Starling forces), nephron segments, hormonal regulation,
             body compartments (Edelman sodium), and a mass-balance integrator over days
  sim/       hooks that run the engine for pages (acute response, steady state, time course)
  content/   chapter content (chapters/chNN.ts), equations, knowledge graph, hormones,
             verified references (pubmed.*.ts), search index
  ui/        shared components: sliders, readouts, charts, diagrams, citation badges, quizzes
  pages/     one file per module, lazy-loaded; routes.ts registers them
tests/renal/
  physiology.test.ts   the engine checked against the book's figures and tables
  content.test.ts      every citation, route, equation and cross-link resolves
```

**How accuracy is checked.** For each chapter the engine is tested against the book's own figures and tables *before* a page is written. Where the engine disagrees, the engine is fixed and the case becomes a regression test. Examples: the urine anion gap under acid load vs diarrhoea vs RTA (Rose Fig. 19-1), bicarbonate titration separating type 1 from type 2 RTA (Fig. 19-6), respiratory compensation of 1/10 acute and 3.5/10 chronic for hypercapnia, Table 23-9 (isotonic saline lowers the sodium in SIADH), and the water-restriction test with desmopressin separating central from nephrogenic diabetes insipidus (Fig. 24-6).

**Sources.** Every claim is tagged by evidence type (fundamental physiology, experimental, clinical evidence, guideline, clinical reasoning). Where later evidence has changed the book's picture, the change is marked as a modern update and cited. Every external reference is a PubMed record checked by PMID. The book is paraphrased, not reproduced.

**Known model limitations.** These are documented in the code and on the relevant pages rather than tuned away:

- Chloride is tracked by mass balance, so it can *cause* a chloride-depletion alkalosis. As a result the calculated anion gap runs a few mmol/L high in distal/type 4 RTA, ammonium-chloride loading and diarrhoea.
- Angiotensin-II-driven thirst is left out because it destabilised the oedematous states.
- Chronic respiratory compensation takes longer than Rose's 3–5 days, because the achieved PCO₂ keeps drifting.
