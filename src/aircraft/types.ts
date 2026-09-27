// Data schema for aircraft definitions (data/aircraft/*.json).
//
// Each definition has two clearly separated parts:
//   spec  – real-world figures taken from manufacturer publications. Values we
//           could not source precisely are listed in `spec.approximate`.
//   model – simulation parameters (aerodynamic coefficients, inertia, gear
//           geometry…). These are ESTIMATES tuned so the aircraft reproduces its
//           published performance plausibly; they are not manufacturer data.
// Adding an aircraft = adding a JSON file; no code changes are required.

export type EngineKind = 'piston' | 'turboprop' | 'turbofan';
export type CockpitKind = 'ga' | 'glass';

export interface AircraftSpec {
  source: string;
  approximate?: string[];
  mtowKg: number;
  emptyKg: number;
  wingspanM: number;
  lengthM: number;
  wingAreaM2: number;
  fuelCapacityL: number;
  engineCount: number;
  engineModel: string;
  /** Per-engine rated thrust for jets (kN) */
  thrustKN?: number;
  /** Per-engine rated power for propeller aircraft (kW) */
  powerKW?: number;
  /** Maximum operating/never-exceed indicated airspeed (kt) */
  vmoKt: number;
  mmo?: number;
  /** Published stall speed (kt, landing configuration) if the manufacturer publishes one */
  stallKt?: number;
  cruiseKtas: number;
  ceilingFt: number;
  climbFpm?: number;
  rangeNm?: number;
}

export interface FlapDetent {
  label: string;
  /** Fraction of full-flap aerodynamic effect */
  frac: number;
  /** Maximum speed with this detent extended (kt IAS), 0 = no limit */
  maxKt: number;
}

export interface AeroModel {
  cl0: number;
  clAlpha: number; // per rad
  clMaxClean: number;
  dClMaxFlaps: number; // added at full flaps
  dCl0Flaps: number;
  cd0: number;
  dCd0Flaps: number;
  dCdGear: number;
  dCdSpoilers: number;
  oswald: number;
  /** Drag-divergence Mach (jets); drag rises steeply above it */
  mdd?: number;
  cyBeta: number;
  clBeta: number; // roll due to sideslip (dihedral effect)
  clP: number;
  clR: number;
  clDa: number;
  clDr: number;
  cm0: number;
  cmAlpha: number;
  cmQ: number;
  cmDe: number;
  cmFlaps: number;
  cnBeta: number;
  cnR: number;
  cnP: number;
  cnDa: number;
  cnDr: number;
  cyDr: number;
  /** Max deflections (deg) */
  elevatorMaxDeg: number;
  aileronMaxDeg: number;
  rudderMaxDeg: number;
}

export interface EngineModel {
  kind: EngineKind;
  /** Lateral position of each engine (m, +right), length = spec.engineCount */
  positionsY: number[];
  /** Propeller efficiency (prop aircraft) */
  propEfficiency?: number;
  /** Static thrust cap per engine (kN) for prop aircraft */
  staticThrustKN?: number;
  /** Idle thrust as a fraction of max */
  idleFraction: number;
  /** Spool-up time constant (s) */
  spoolTime: number;
  /** Fuel: brake-specific (kg/kWh) for props, thrust-specific (kg/(N·h)) at sea-level static for jets */
  sfc: number;
  /** Reverse thrust fraction available (0 = none) */
  reverseFraction: number;
  /** Seconds for the start sequence */
  startTime: number;
}

export interface GearModel {
  retractable: boolean;
  noseX: number; // m ahead of CG
  mainX: number; // m (negative = behind CG)
  mainHalfTrack: number;
  /** Vertical distance from CG to the bottom of the wheels, gear extended (m) */
  heightM: number;
  /** Static compression at MTOW (m) */
  compressionM: number;
  maxSteerDeg: number;
  /** Touchdown sink rate the gear survives (m/s) */
  limitSinkMs: number;
  transitTime: number;
}

export interface GeometryModel {
  wingPosition: 'high' | 'low';
  /** Leading-edge sweep (deg) */
  sweepDeg: number;
  taper: number;
  dihedralDeg: number;
  fuselageDiameterM: number;
  tail: 'conventional' | 't-tail';
  engineMount: 'nose' | 'wing' | 'tail';
  /** Pitch angle (deg) at which the tail touches with the gear on the ground */
  tailStrikeDeg: number;
  /** Pilot eye position relative to CG (m, body axes x fwd, y right, z down) */
  eye: [number, number, number];
  colors: { body: string; accent: string; tail: string };
  /** Upper deck hump (747) */
  hump?: boolean;
  winglets?: boolean;
}

export interface AutopilotTuning {
  maxBankDeg: number;
  maxVsFpm: number;
  vrKt: number;
  v2Kt: number;
  vrefKt: number;
  climbKt: number;
  cruiseMach?: number;
  cruiseAltFt: number;
  approachKt: number;
  /** Pitch the pilot should hold at rotation (deg) */
  rotatePitchDeg: number;
}

export interface AircraftDefinition {
  id: string;
  name: string;
  manufacturer: string;
  category: 'general aviation' | 'turboprop' | 'business jet' | 'narrowbody' | 'widebody';
  cockpit: CockpitKind;
  spec: AircraftSpec;
  flaps: FlapDetent[];
  /** Radii of gyration, non-dimensional (Roskam convention) */
  gyration: [number, number, number];
  aero: AeroModel;
  engine: EngineModel;
  gear: GearModel;
  geometry: GeometryModel;
  perf: AutopilotTuning;
  /** Fuel density kg/L */
  fuelDensity: number;
  /** Default payload for a typical flight (kg) */
  defaultPayloadKg: number;
}
