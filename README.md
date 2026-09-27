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

## Development

```bash
npm install
npm run dev            # http://localhost:5173
npm test               # physics / autopilot / full-flight tests
npm run build          # production build in dist/
npm run data:airports  # refresh airport data from OurAirports
npm run data:geo       # refresh Natural Earth overlays
python3 tools/gen-aircraft.py   # regenerate data/aircraft/*.json
```

## Deployment (GitHub Pages)

`.github/workflows/deploy.yml` tests, builds and publishes `dist/` on every push to `main` or the development branch. One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
