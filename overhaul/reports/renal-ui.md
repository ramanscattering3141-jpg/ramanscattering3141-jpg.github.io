# renal-ui report

Scope: renal/src/pages/**, renal/src/ui/**, app.css, App.tsx, routes.ts, renal/index.html, plus the new tools/renal-smoke.mjs. I made no git state changes. The lead checkpointed part of this work in commit cfd704a. Builds went only to scratchpad/renal-ui/dist. My preview server (port 4185) is stopped.

## Result
- **Audit crawl:** `scratchpad/renal-ui/crawl.mjs` covers 155 states:
  - every route in routes.ts and every `?tab=` a page declares;
  - textbook chapters 1–30;
  - three clinical cases opened in `/sandbox?s=…`.
- **Crawl results:** at 390 px (light) and 1400 px (dark) there are 0 console or page errors, 0 missing h1, 0 phone overflow, 0 camelCase SVG attributes, 0 dead internal links, 0 unlabelled inputs, 0 duplicate ids and 0 main-thread long tasks over 300 ms. 0 text–text overlaps remain.
- **Remaining crawl flags, all checked by eye and accepted:**
  - A few SVG labels render at 9.0–9.4 px. My threshold was 9.5.
  - The "line through label" detector still counts acid–base-map labels over the faint HCO₃⁻ isopleths, and drug-map lines passing behind labels. In both cases the label is drawn on top with a halo, so the line visibly stops at the text.
- **`tools/renal-smoke.mjs`** (new; mirrors ecg-smoke and defaults to `dist/`, or takes a dist path):
  - It reads routes.ts and TAB_IDS, so new pages are covered automatically.
  - It fails on console or page errors, a missing h1, phone overflow, camelCase SVG attributes and dead links.
  - Result: **All 310 page visits OK.**
- `npx tsc --noEmit`: 0 errors. `vitest tests/renal/content.test.ts tests/renal/equations.test.ts`: 31/31 pass. I did not change any engine or sim code; renal-model ran the full suite at 372/372.

## Most visible fixes (before → after)
1. **Keyboard access in SVG maps.** `tabIndex` was written literally on SVG elements (Preact without compat), so the nephron explorer, diuretic map and drug map could not be reached by keyboard. Now `tabindex` (NephronDiagram, DiureticMap, DrugMap). The CellDiagram carriers that can be toggled also gained tabindex and Enter/Space handling.
2. **ECG strip trace.** `strokeWidth`/`strokeLinejoin` on the ECG strip polyline were ignored, so the trace drew at 1 px. Now `stroke-width`/`stroke-linejoin` (EcgStrip, used on the hyper/hypokalaemia and DKA tabs).
3. **Unreadable diagrams on phones (4–6 px text).** These diagrams now sit in `.svg-scroll` at a readable minimum width:
   - nephron diagram (explorer, flow, diuretic classes, hormones);
   - transport, loop and distal cell diagrams;
   - glomerular filtration animation, afferent/efferent schematic, IV-fluids compartments and principal cell.

   New `.xwide` and `.nephron-scroll` rules support this, and the desktop height cap is lifted on phones. The nephron thumbnail on the home and transport pages now draws its zone labels larger (6 → ~9–10 px).
4. **Labels over lines in the nephron drawing.** "Afferent", "JG cells", "macula densa" and "Efferent" sat on vessels and on the tubule. They now sit in clear space, with short leader lines for the JG cells and macula densa. "Glomerulus" no longer covers the JG-cell dot.
5. **RAAS map.**
   - "mediate release" sat on its arrow. It is now beside the arrow, haloed, and larger (9.5 → 11).
   - The blocking-drug labels collided with neighbouring nodes or were clipped (NSAID, β-blocker, loop diuretic, MRA). They now go above the node where there is no room to the right.
6. **Transporter/drug map.**
   - Drug lines ran through the ion labels (Na⁺ ↓, CO₂ ↓, Cl⁻ ↓). The labels now move to the side the line does not come from.
   - Cell names, loads and the lumen/blood captions are drawn above the lines with halos.
   - The paracellular line is limited to the epithelium.
   - Phone minimum width is 1120 px, so text stays above 7.7 px.
7. **Diuretic map** was 6–7 px on desktop. The map column is now 2fr with the side panel at ≥ 320 px, zone/osmolality/drug fonts are larger, and the phone minimum width is 780 px.
8. **Acid–base map** (respiratory, mixed, alkalosis, acidosis pages).
   - Before: HCO₃⁻ isopleth numbers were clipped at the right edge, at 9 px and 21 % opacity, with no key. Case labels were 10 px with lines running through them.
   - After: there is right padding, the isopleth labels are legible and haloed, a key reads "dashed lines: plasma HCO₃⁻ (mmol/L)", and the case labels are 11.5 px and haloed.
9. **Body-water bars.**
   - The 60 L reference person overflowed the 600-unit drawing (scale assumed 50 L), which clipped "plasma".
   - The dashed "starting volume" outlines used the undefined `var(--muted)` and were invisible.
   - The bars used raw rgb() colours.

   Now the scale fits the volumes, the outlines use `--ink-faint`, and the bars use theme colours.
10. **Cell diagrams.**
    - Before: carrier names were white on faded circles, which was illegible in the light theme, and the text was 7.5–10 px. Long captions ("senses Ca²⁺/Mg²⁺ → inhibits ROMK") ran over the circles.
    - After: the circles are tinted with the panel colour and the text uses `--ink` at 8.5–11.5 px. Captions wrap between the margin and the carrier.
11. **Afferent/efferent glomerulus fill** was raw rgb(). It is now a theme mix, so the pressure value stays legible in both themes.

## Text and shell
- **Page eyebrows** showed raw group ids ("Acidbase", "Tubule", "Lab", "Start"). They now show the group labels ("Acid–base", "Tubular transport", …).
- **British spelling in titles, sidebar and search.** Seven route titles changed: Hyponatraemia simulator, Hypernatraemia & polyuria, Hyperglycaemia/DKA/HHS, Hypovolaemic states, Oedematous states, Hyperkalaemia and Hypokalaemia. US spellings were added as search keywords, and the search examples now say "hypokalaemia". Rose's own chapter titles keep the book's spelling, because they are citations.
- **Inbox items from renal-model:**
  - "Salbutamol (albuterol)" on the hyperkalaemia treatment tab and its text.
  - Osmolality is now mOsm/kg, and amounts mOsm, throughout Hyponatremia.tsx (19 places).
  - Urea:creatinine is aligned to the new > 80 threshold (≈ BUN:Cr 20) in Bedside (the "borderline at 94" wording) and the Hypovolemia readout (threshold 90 → 80, with the range stated).
  - The alkalosis coefficient 0.7 was already consistent on the pages, and no page quoted nEq/L.
- **Wording corrections:**
  - Dev-speak "engine" in visible text → "model" (Cases, Sandbox, AKI, hyperkalaemia, hyperglycaemia).
  - Respiratory: "CO₂ is the strongest stimulus to breathing there is" → "the main chemical drive to breathe".
  - Respiratory: "PO₂ > 55 improves survival and quality of life in chronic lung disease" → "long-term oxygen for severe resting hypoxaemia (PO₂ ≤ 55 mmHg) prolongs survival in COPD". The quality-of-life claim was an overclaim.
  - Minerals calcium slider read "2.05 (8.2 mg/dL) mmol/L" → "2.05 mmol/L (8.2 mg/dL)".
- **Textbook chapters 29 and 30** said "Its simulators are listed below" and then listed nothing for ch. 29. Ch. 29 now explains and links cases, challenges and lessons; ch. 30 explains the equation explorer. The chapter index footer says the same.
- **Home page:** "All modules" now also lists the learn/practise modules (textbook, lessons, challenges, tutor), which were not linked from the home page before.
- **index.html:**
  - `lang="en-CA"`;
  - a richer meta description;
  - colour-scheme and light/dark theme-color;
  - Open Graph tags (type, site_name, title, description, url) and twitter:card.

  The favicon was already present.
- **Accessibility:**
  - Visible `:focus-visible` outline for links, `.btn`, `[tabindex]` (including SVG elements) and toggles.
  - Buttons are ≥ 32 px high and nav items taller on coarse pointers.
  - aria-pressed on the Conceptual/Quantitative switch, and a clearer sidebar search label.
  - The unlabelled severity range on /tubulointerstitial?tab=chronic is now a labelled Slider.
  - Reduced motion: the CSS global rule, FlowSimulator and FiltrationAnimation already respect it. Countercurrent and IV fluids animate only after Play.

## Files changed (one line each)
- ui/NephronDiagram.tsx: tabindex; svg-scroll wrapper (nephron-scroll / xwide); larger zone and papilla labels in thumbnail mode; labels repositioned with leaders.
- ui/CellDiagram.tsx: svg-scroll; theme-tinted carriers; larger text; wrapped captions; keyboard toggle.
- ui/ArterioleSchematic.tsx: svg-scroll; theme-aware glomerulus fill.
- ui/FiltrationAnimation.tsx: svg-scroll.
- ui/EcgStrip.tsx: kebab-case stroke attributes.
- ui/DiureticMap.tsx: tabindex; wider map column.
- ui/AcidBaseMap.tsx: padding, isopleth labels and key, haloed case labels.
- ui/page.tsx: eyebrow shows the group label.
- pages/DrugMap.tsx: tabindex; ion-label placement; labels drawn above lines; paracellular line; CSS class for min-width.
- pages/Raas.tsx: arrow-label placement; blocked-drug label placement; viewBox.
- pages/BodyWater.tsx: scale, outline colour, theme colours, plasma label clamp.
- pages/IvFluids.tsx: svg-scroll xwide; larger labels.
- pages/Potassium.tsx, pages/Glucose.tsx: svg-scroll (Glucose: wide).
- pages/Diuretics.tsx: nephron height 420 → 640.
- pages/TransportLab.tsx: thumbnail height 320 → 360.
- pages/Hyponatremia.tsx: mOsm/kg.
- pages/Hyperkalemia.tsx: salbutamol; "whole-kidney model".
- pages/Bedside.tsx, pages/Hypovolemia.tsx: urea:creatinine 80.
- pages/Respiratory.tsx: two claims softened.
- pages/Minerals.tsx: calcium unit order; band colour as a theme variable.
- pages/FreeWater.tsx: undefined `--muted` replaced.
- pages/Tubulointerstitial.tsx: labelled Slider.
- pages/Search.tsx: British spelling.
- pages/Home.tsx: all modules listed.
- pages/Textbook.tsx: ch. 29/30 text and links.
- pages/Cases.tsx, Sandbox.tsx, Aki.tsx, Hyperglycemia.tsx: "engine" → "model".
- routes.ts: British titles and US keywords.
- App.tsx: aria-pressed; search label.
- app.css: svg-scroll xwide/nephron rules, dmap fonts, drugmap and ivf classes, focus-visible, coarse-pointer targets.
- index.html: meta, Open Graph, theme-color, lang.
- tools/renal-smoke.mjs: new.

## How I verified
- Numeric crawl of all states at 390 px and 1400 px after every round, with the metrics listed above.
- Element screenshots of every flagged diagram, before and after.
- A representative viewport sample: one page per section, desktop and phone, light and dark (home, nephron, GFR, loop, hyponatraemia, hyperkalaemia ECG, RTA, minerals, diuretics, AKI, cases, sandbox, equations, textbook ch. 23, tutor). I looked at each one.
- I grepped the rendered page text (`scratchpad/renal-ui/text/`) for US spellings, osmolality units, placeholders and dev-speak.

## Found but not fixed
- **Oxygen target (Respiratory.tsx, chronic tab):** the page still gives Rose's target of PO₂ 60–65 mmHg / saturation > 90 %. Modern guidance for patients at risk of hypercapnia targets SpO₂ 88–92 % (BTS 2017). Adding that as a modern update needs a PMID-checked reference in pubmed.extra.ts, which renal-model owns; nobody is assigned to it now.
- **Drug map:** the NSAID → MR dashed line still runs from the top band through the ROMK/BK glyph area. It is drawn under the glyph, so it reads as passing behind, but a routed connector would be cleaner.
- **Dense-diagram text:** a handful of labels in the cell diagrams, ammonium diagram, IV fluids and nephron thumbnail render at 9.0–9.4 px. They are readable; I left them rather than risk new collisions.
- **Dead code:** `InPreparation` and the "pending" nav state in App.tsx can no longer be reached (every page exists). I left them in the code; they are never shown.
- I did not read every page's prose line by line. I covered it with targeted greps for overclaims ("always / never / proves / means") and fixed the two that overclaimed.

## Sent to other inboxes
None. The renal-model inbox items above were all actioned on the page side.
