// Lead axes. Each lead records the projection (dot product) of the instantaneous
// cardiac dipole onto its axis: a wavefront moving TOWARD the positive pole gives an
// upward deflection, AWAY gives a downward deflection, perpendicular gives little.
//
// Limb leads use the Einthoven/Goldberger hexaxial reference frame. Precordial axes are
// approximate horizontal-plane directions from the heart's electrical centre to each
// electrode (Kligfield et al., AHA/ACCF/HRS ECG standardization Part I, 2007). Because the
// precordial electrodes sit close to the heart, real recordings also contain "proximity"
// (non-dipolar) effects; the engine adds a few explicitly labelled local terms for those.

import { frontal, horizontal, type Vec3 } from './vec';

export type LeadId =
  | 'I' | 'II' | 'III' | 'aVR' | 'aVL' | 'aVF'
  | 'V1' | 'V2' | 'V3' | 'V4' | 'V5' | 'V6'
  | 'V4R';

export interface LeadDef {
  id: LeadId;
  axis: Vec3;
  /** Relative gain (precordial leads record larger voltages because they are closer to the heart). */
  gain: number;
  plane: 'frontal' | 'horizontal';
  /** Angle in its plane (hexaxial for limb leads, horizontal-plane angle from patient's left for chest leads). */
  angle: number;
  views: string;
  placement: string;
}

export const LEADS: Record<LeadId, LeadDef> = {
  I: { id: 'I', axis: frontal(0), gain: 1, plane: 'frontal', angle: 0, views: 'High lateral LV wall (with aVL, V5–V6)', placement: 'Bipolar: left arm (+) vs right arm (−)' },
  II: { id: 'II', axis: frontal(60), gain: 1, plane: 'frontal', angle: 60, views: 'Inferior wall; best lead for sinus P waves (parallel to atrial activation)', placement: 'Bipolar: left leg (+) vs right arm (−)' },
  III: { id: 'III', axis: frontal(120), gain: 1, plane: 'frontal', angle: 120, views: 'Inferior wall (rightward-inferior)', placement: 'Bipolar: left leg (+) vs left arm (−)' },
  aVR: { id: 'aVR', axis: frontal(-150), gain: 1, plane: 'frontal', angle: -150, views: 'Looks into the cavity from the right shoulder: RV outflow tract / basal septum; mirror of the lateral leads', placement: 'Augmented unipolar: right arm vs average of LA + LL' },
  aVL: { id: 'aVL', axis: frontal(-30), gain: 1, plane: 'frontal', angle: -30, views: 'High lateral wall (first diagonal / LCx territory)', placement: 'Augmented unipolar: left arm vs average of RA + LL' },
  aVF: { id: 'aVF', axis: frontal(90), gain: 1, plane: 'frontal', angle: 90, views: 'Inferior wall (diaphragmatic surface)', placement: 'Augmented unipolar: left leg vs average of RA + LA' },
  V1: { id: 'V1', axis: horizontal(118), gain: 1.55, plane: 'horizontal', angle: 118, views: 'Right ventricle, interventricular septum, right atrium; posterior wall is seen "in the mirror"', placement: '4th intercostal space, right sternal border' },
  V2: { id: 'V2', axis: horizontal(95), gain: 1.7, plane: 'horizontal', angle: 95, views: 'Septum / anterior wall', placement: '4th intercostal space, left sternal border' },
  V3: { id: 'V3', axis: horizontal(75, 0.08), gain: 1.7, plane: 'horizontal', angle: 75, views: 'Anterior wall (LAD territory)', placement: 'Midway between V2 and V4' },
  V4: { id: 'V4', axis: horizontal(55, 0.15), gain: 1.6, plane: 'horizontal', angle: 55, views: 'Anterior wall / apex', placement: '5th intercostal space, mid-clavicular line' },
  V5: { id: 'V5', axis: horizontal(28, 0.15), gain: 1.45, plane: 'horizontal', angle: 28, views: 'Low lateral wall', placement: 'Anterior axillary line, level of V4' },
  V6: { id: 'V6', axis: horizontal(0, 0.15), gain: 1.3, plane: 'horizontal', angle: 0, views: 'Low lateral wall', placement: 'Mid-axillary line, level of V4' },
  V4R: { id: 'V4R', axis: horizontal(125, 0.15), gain: 1.3, plane: 'horizontal', angle: 125, views: 'Right ventricular free wall (right-sided lead)', placement: '5th intercostal space, right mid-clavicular line' },
};

export const TWELVE: LeadId[] = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'];
export const LIMB: LeadId[] = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF'];
export const PRECORDIAL: LeadId[] = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6'];

/** Standard 3×4 print layout (columns: I-III, aVR-aVF, V1-V3, V4-V6). */
export const LAYOUT_3x4: LeadId[][] = [
  ['I', 'aVR', 'V1', 'V4'],
  ['II', 'aVL', 'V2', 'V5'],
  ['III', 'aVF', 'V3', 'V6'],
];

/** Contiguous-territory groupings used by the ischemia module. */
export const LEAD_GROUPS: Record<string, LeadId[]> = {
  inferior: ['II', 'III', 'aVF'],
  highLateral: ['I', 'aVL'],
  lowLateral: ['V5', 'V6'],
  septal: ['V1', 'V2'],
  anterior: ['V3', 'V4'],
  right: ['aVR', 'V1', 'V4R'],
};
