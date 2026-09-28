export type Category =
  | 'sinus'
  | 'premature'
  | 'atrial'
  | 'junctional'
  | 'reentrant'
  | 'ventricular'
  | 'arrest'
  | 'avblock'
  | 'ivcd'
  | 'pacing'
  | 'structural'
  | 'ischemia'
  | 'pericardial'
  | 'pulmonary'
  | 'electrolyte'
  | 'drug'
  | 'inherited';

export const CATEGORY_LABEL: Record<Category, string> = {
  sinus: 'Sinus rhythms',
  premature: 'Premature beats',
  atrial: 'Atrial tachyarrhythmias',
  junctional: 'Junctional rhythms',
  reentrant: 'AV-nodal / accessory-pathway re-entry',
  ventricular: 'Ventricular rhythms',
  arrest: 'Cardiac-arrest rhythms',
  avblock: 'AV block',
  ivcd: 'Bundle-branch & fascicular block',
  pacing: 'Pacemaker ECGs',
  structural: 'Hypertrophy & chamber enlargement',
  ischemia: 'Ischaemia & infarction',
  pericardial: 'Pericarditis / myocarditis / effusion',
  pulmonary: 'Pulmonary & right-heart conditions',
  electrolyte: 'Electrolytes',
  drug: 'Drugs & toxicology',
  inherited: 'Inherited / primary electrical syndromes',
};

export type WhyLevel = 'cell' | 'conduction' | 'vector' | 'lead' | 'waveform' | 'diagnosis' | 'clinical' | 'treatment';

export interface WhyStep {
  level: WhyLevel;
  text: string;
}

export interface Management {
  recognition: string;
  mechanism: string;
  stability: string;
  immediate: string[];
  definitive: string[];
  cautions: string[];
  whyWorks: string[];
  whyNot: string[];
  refs: string[];
}

export interface Differential {
  /** Diagnosis id (link) or free text. */
  dx: string;
  how: string;
}

export interface Dx {
  id: string;
  name: string;
  aliases?: string[];
  category: Category;
  /** 1 = core (common/high value), 2 = important, 3 = advanced/rare */
  tier: 1 | 2 | 3;
  tags: string[];
  preset?: string;
  altPresets?: string[];
  definition: string;
  epidemiology?: string;
  mechanism: string;
  ecg: string[];
  why: WhyStep[];
  /** A contrasting "normal" explanation shown alongside the abnormal causal chain. */
  normal?: string;
  differential: Differential[];
  presentation?: string;
  causes?: string[];
  complications?: string[];
  acute?: string[];
  longTerm?: string[];
  cautions?: string[];
  management?: Management;
  pearls?: string[];
  refs: string[];
}

export const LEVEL_LABEL: Record<WhyLevel, string> = {
  cell: 'Cell / ion channel',
  conduction: 'Conduction pathway',
  vector: 'Electrical vector',
  lead: 'Lead view',
  waveform: 'Waveform',
  diagnosis: 'ECG diagnosis',
  clinical: 'Clinical significance',
  treatment: 'Management logic',
};
