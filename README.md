# World Flight Simulator

A worldwide 3D flight simulator that runs in the browser. Fly nine aircraft (Cessna 172 to Boeing 747-400) between any of ~29,000 real airports over streamed real-world terrain, with a working autopilot, GPS navigation, weather and a real day/night cycle.

**Play:** https://ramanscattering3141-jpg.github.io/ (after the one-time setup below)

> Entertainment simulator. Not suitable for real-world flight training or navigation.

## Quick start (playing)

1. Open the site in a recent desktop Chrome, Edge, Firefox or Safari (WebGL required; a dedicated GPU is recommended).
2. In the **Free flight** tab pick an aircraft, a departure and destination (type an ICAO/IATA code, name or city), a runway and start condition, then press **START FLIGHT**. Or pick a scenario from **Missions**.
3. Press **H** in flight for all controls.

| Key | Action | Key | Action |
|---|---|---|---|
| ↑ / ↓ (W/S) | Nose down / up | ← / → (A/D) | Roll |
| Z / X | Rudder | R / F | Throttle up / down |
| Shift+R / Shift+F | Full / idle throttle | ] / [ | Flaps extend / retract |
| G | Gear | B (hold) | Brakes |
| P | Parking brake | / | Speed brake |
| E | Engine start/stop | V | Reverse thrust |
| Home / End | Trim | Q / Shift+Q | Autopilot / autothrottle |
| 1–5, C | Cockpit, chase, wing, free, tower | O / M / I | Panel / map / HUD |
| = / − | Simulation rate | Esc | Pause menu |

All keys can be remapped in **Settings → Controls**. Gamepads work out of the box; **Y** toggles a mouse yoke.

**First take-off (Cessna):** P (release brake) → Shift+R (full power) → keep straight with Z/X → at 55 kt hold ↓ gently → climb at ~75 kt.
**Autoland (jets):** on final, press **O** for the panel, click **A/P**, **A/THR** and **APP**.

## Architecture

TypeScript + [CesiumJS](https://cesium.com/platform/cesiumjs/) (globe, streaming, level of detail, culling), bundled with Vite, hosted as a static site.

```
src/
  core/         math, WGS84 geodesy (ECEF ↔ lat/lon/alt, ENU frames, great circles), settings
  aircraft/     FlightDynamics (6-DOF), Engines, Autopilot, ModelBuilder (procedural glTF), AircraftView
  environment/  Atmosphere (ISA), Weather (presets, editor, dynamic worldwide), WeatherVisuals
  world/        ElevationService, TerrainProvider, Globe/imagery, AirportDatabase, AirportRenderer, GeoOverlays (borders, cities)
  navigation/   FlightPlan, great-circle route generation, GPS guidance, synthetic ILS
  camera/       Cockpit / chase / wing / free / tower cameras
  input/        Keyboard (rebindable), mouse yoke, gamepad
  sim/          FlightSession (fixed 120 Hz loop, interpolation, crashes, landings), Scoring
  ui/           Planner, HUD, instruments (six-pack, PFD, ND, EICAS), autopilot panel, map, settings
data/aircraft   one JSON file per aircraft (add a file to add an aircraft)
data/missions   one JSON file per mission
public/data     generated airport & geography data
tools/          data build scripts, browser smoke tests
tests/          physics, autopilot and full point-to-point flight tests
```

Key technical decisions:

- **Coordinates:** the aircraft state is kept in Earth-Centred Earth-Fixed metres (64-bit). There are no map edges or pole/date-line problems and no floating-point jitter. Forces are computed in the local East-North-Up frame each step.
- **Flight model:** a rigid-body model built from stability derivatives. It covers lift with a stall break, a drag polar, ground effect, compressibility drag, a propeller/turbofan thrust lapse, spool-up, fuel burn, spring-damper landing gear with tyre friction, Dryden-style turbulence, and realism profiles (arcade / realistic / simulation).
- **Terrain:** the same elevation service feeds both the rendered terrain mesh and the physics ground contact. Runways are flattened to their published elevation, so the wheels touch what you see.
- **Aircraft data:** each JSON file separates published `spec` values (with their source, and approximate values listed) from simulation `model` estimates.

## Data sources and licences

| Data | Source | Licence |
|---|---|---|
| Airports & runways | [OurAirports](https://ourairports.com/data/) | Public domain |
| Terrain elevation | [Terrain Tiles on AWS](https://registry.opendata.aws/terrain-tiles/) (SRTM, GMTED, ETOPO1…) | Open data (see registry) |
| Satellite imagery | [Sentinel-2 cloudless 2016 by EOX](https://s2maps.eu) | CC BY 4.0 |
| Low-res & night imagery | NASA Blue Marble / VIIRS Black Marble via GIBS | Public domain |
| Offline imagery | Natural Earth II (bundled with Cesium) | Public domain |
| Borders, coastlines, cities | [Natural Earth](https://www.naturalearthdata.com/) | Public domain |
| Optional sharper imagery | Bing Maps via [Cesium ion](https://cesium.com/ion/) (your own free token, Settings → Imagery) | Cesium ion terms |

Limitations:
- Runway thresholds for about 20,000 small-airport runways are estimated, not surveyed.
- Approaches are a synthetic 3° ILS for every runway.
- Headings are true, not magnetic.
- Weather is procedural, not observed.
- City buildings are procedural impressions, not real buildings.


---

# ECG Physiology Lab (`/ecg/`)

A physiology-first ECG and cardiac electrophysiology education app, built into the same site.

**Open:** https://ramanscattering3141-jpg.github.io/ecg/ (after deployment) · locally `npm run dev` → http://localhost:5173/ecg/

> Educational simulator. ECGs are generated from a simplified physiological model, not patient recordings. Clinical content summarises the cited guidelines and is not a substitute for current official guidance or clinical judgement.

The organising loop is **change physiology → predict ECG → observe ECG → explain ECG → diagnose rhythm → choose treatment → understand why the treatment works**. No tracing is a stored picture:

1. **Rhythm engine** (`src/ecg/engine/rhythm.ts`) — an event-driven graph of excitable elements: sinus node, atria, AV node (single or dual fast/slow pathways), His bundle and bundle branches, accessory pathway, ventricles, junctional and ventricular escape foci, VT circuits and a pacemaker. Each element has a conduction time and refractory period; blocked impulses can conceal, opposing wavefronts collide. AVNRT, orthodromic/antidromic AVRT, Wenckebach, AV dissociation, capture/fusion beats, Ashman aberrancy, compensatory pauses, pre-excited AF and the responses to adenosine, vagal manoeuvres, AV-nodal blockers, atropine and shocks **emerge** from these rules.
2. **Waveform engine** (`morphology.ts`, `synth.ts`) — each beat is a set of activation/repolarisation dipole components (normal sequence after Durrer 1970) modified by bundle/fascicular block, pre-excitation, ectopic foci, pacing, chamber mass, injury currents, ions, drugs and channelopathies; each lead records the projection of the summed heart vector on its axis (plus explicit local terms, e.g. the RVOT in Brugada).
3. **Content database** (`src/ecg/content/`) — ~80 diagnosis records (definition, mechanism, ECG findings, WHY-chain, differential, clinical, management, references), WHY-chains for findings, differential-diagnosis problems, comparisons, ACLS cards, case templates and challenge items. Every clinical record cites entries in `sources.ts`, each checked against PubMed (PMID/DOI) with a verification date.

**3-D heart & slow motion** (`#/heart3d`, and in every ECG panel that shows a heart). A rotatable three.js heart, loaded only when needed. Per-vertex activation and repolarisation times are derived for each simulated beat from its real entry points: bundle-branch state, ectopic focus, accessory pathway, pacing or fusion. The view also shows the conduction system, the instantaneous heart vector, its vector loop, and its projection on a chosen lead. Playback runs down to 0.01×, with ±1 ms / ±10 ms steps, beat jumping, scrubbing and click-to-seek on the ECG. `engine/explain.ts` names the ECG segment being written and the wavefronts writing it, using the same dipoles that generate the tracing.

**Also:** posterior (V7–V9) and right-sided (V4R) leads; limb-cable reversal, dextrocardia and single-electrode artefact; clinical tools (QTc, CHA₂DS₂-VASc/CHA₂DS₂-VA, Sgarbossa/Smith, Brugada and Vereckei WCT algorithms); glossary; learning path with progress stored in the browser. `tools/ecg-smoke.mjs` crawls every ECG route in headless Chromium after `npm run build`.

Sections: A Fundamentals · B Physiology · C Simulator · D Rhythm Library (+ AVNRT, AVRT/WPW and flutter/AF labs) · E Conduction (AV-block and bundle-branch labs, pacing) · F Structural · G Ischaemia simulator · H Electrolytes & toxicology labs · I Inherited/electrical · J Management · K ACLS (2025 AHA) · L Cases · M Challenge (5 levels) · N Sandbox (change-one-variable, build-your-own-arrhythmia, adenosine demonstrator, comparisons, axis/P/QRS/ST labs, pacemaker hierarchy) · differential-diagnosis engine · search · sources.

```
src/ecg/
  engine/   params, rhythm (conduction simulator), morphology (dipole beats), synth (leads), measure, presets, variability
  content/  diagnoses, findings, differentials, comparisons, acls, cases, challenge, sources (verified citations), search
  ui/       ECG paper renderer (12-lead, strips, ladder diagram, calipers), heart animation, vector explorer, AP plot
  pages/    one module per section
ecg/index.html   second Vite entry point
tests/ecg/       engine behaviour (re-entry, block, filtering, injury currents, ions, lead reversal), calculators and content-integrity tests
tools/ecg-smoke.mjs  headless Chromium crawl of every ECG route (run after npm run build)
```

## Development

```bash
npm install
npm run dev            # http://localhost:5173
npm test               # physics / autopilot / full-flight tests + ECG engine/content tests
npx vitest run tests/ecg   # ECG tests only (fast)
npm run build          # production build in dist/
npm run data:airports  # refresh airport data from OurAirports
npm run data:geo       # refresh Natural Earth overlays
python3 tools/gen-aircraft.py   # regenerate data/aircraft/*.json
```

## Deployment (GitHub Pages)

`.github/workflows/deploy.yml` tests, builds and publishes `dist/` on every push to `main` or the development branch. One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
