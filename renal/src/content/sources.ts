// Source registry and the evidence-grading scheme used throughout the platform.
//
// Rose & Post is the conceptual spine; external sources supplement it, update it, or mark where
// it has been overtaken. Every externally sourced clinical claim carries a citation, and the
// grade says what kind of statement it is.

import { PUBMED_REFS, type PubmedRef } from './pubmed.generated';

/** What kind of knowledge a statement rests on. Shown as a badge next to the claim. */
export type Evidence =
  | 'physiology' // established physiological mechanism
  | 'experimental' // mechanistic finding from experimental (usually animal) studies
  | 'clinical' // demonstrated in human studies
  | 'guideline' // recommendation from a professional body
  | 'reasoning'; // mechanistic interpretation that is reasonable but not directly demonstrated

export const EVIDENCE_LABEL: Record<Evidence, string> = {
  physiology: 'Fundamental physiology',
  experimental: 'Experimental physiology',
  clinical: 'Clinical evidence',
  guideline: 'Guideline recommendation',
  reasoning: 'Clinical reasoning',
};

export const EVIDENCE_DESCRIPTION: Record<Evidence, string> = {
  physiology: 'An established physiological mechanism, reproducible and not seriously disputed.',
  experimental:
    'A mechanistic finding from experimental work, usually in animals or isolated tubules. It explains how something could work in humans without proving that it does.',
  clinical: 'Demonstrated in human studies. The effect size and the population it was shown in both matter.',
  guideline: 'A recommendation from a professional body, which weighs evidence against practicality and may change.',
  reasoning:
    'A mechanistic inference: it follows from physiology that is well established, but the specific claim has not been demonstrated directly. Treat it as a hypothesis, not a fact.',
};

export const ROSE = {
  id: 'rose',
  authors: 'Rose BD, Post TW',
  title: 'Clinical Physiology of Acid-Base and Electrolyte Disorders',
  edition: '5th edition',
  publisher: 'McGraw-Hill',
  year: 2001,
} as const;

/** A chapter of the textbook, used for "where this comes from" links. */
export interface RoseChapter {
  n: number;
  title: string;
  part: string;
  /** true when the supplied copy gave us the full chapter text */
  textAvailable: boolean;
}

export const ROSE_CHAPTERS: RoseChapter[] = [
  { n: 1, title: 'Introduction to renal function', part: 'Renal physiology', textAvailable: true },
  { n: 2, title: 'Renal circulation and glomerular filtration rate', part: 'Renal physiology', textAvailable: true },
  { n: 3, title: 'Proximal tubule', part: 'Renal physiology', textAvailable: true },
  { n: 4, title: 'Loop of Henle and the countercurrent mechanism', part: 'Renal physiology', textAvailable: false },
  { n: 5, title: 'Functions of the distal nephron', part: 'Renal physiology', textAvailable: false },
  { n: 6, title: 'Effects of hormones on renal function', part: 'Renal physiology', textAvailable: false },
  { n: 7, title: 'Total body water and the plasma sodium concentration', part: 'Regulation', textAvailable: false },
  { n: 8, title: 'Regulation of the effective circulating volume', part: 'Regulation', textAvailable: false },
  { n: 9, title: 'Regulation of plasma osmolality', part: 'Regulation', textAvailable: false },
  { n: 10, title: 'Acid-base physiology', part: 'Regulation', textAvailable: false },
  { n: 11, title: 'Regulation of acid-base balance', part: 'Regulation', textAvailable: false },
  { n: 12, title: 'Potassium homeostasis', part: 'Regulation', textAvailable: false },
  { n: 13, title: 'Meaning and application of urine chemistries', part: 'Clinical disorders', textAvailable: false },
  { n: 14, title: 'Hypovolaemic states', part: 'Clinical disorders', textAvailable: false },
  { n: 15, title: 'Clinical use of diuretics', part: 'Clinical disorders', textAvailable: true },
  { n: 16, title: 'Oedematous states', part: 'Clinical disorders', textAvailable: true },
  { n: 17, title: 'Introduction to simple and mixed acid-base disorders', part: 'Clinical disorders', textAvailable: true },
  { n: 18, title: 'Metabolic alkalosis', part: 'Clinical disorders', textAvailable: true },
  { n: 19, title: 'Metabolic acidosis', part: 'Clinical disorders', textAvailable: false },
  { n: 20, title: 'Respiratory acidosis', part: 'Clinical disorders', textAvailable: false },
  { n: 21, title: 'Respiratory alkalosis', part: 'Clinical disorders', textAvailable: false },
  { n: 22, title: 'Introduction to disorders of osmolality', part: 'Clinical disorders', textAvailable: false },
  { n: 23, title: 'Hyponatraemia', part: 'Clinical disorders', textAvailable: false },
  { n: 24, title: 'Hypernatraemia', part: 'Clinical disorders', textAvailable: false },
  { n: 25, title: 'Hyperglycaemia', part: 'Clinical disorders', textAvailable: false },
  { n: 26, title: 'Introduction to disorders of potassium balance', part: 'Clinical disorders', textAvailable: false },
  { n: 27, title: 'Hypokalaemia', part: 'Clinical disorders', textAvailable: false },
  { n: 28, title: 'Hyperkalaemia', part: 'Clinical disorders', textAvailable: false },
];

const byId = new Map<string, PubmedRef>(PUBMED_REFS.map((r) => [r.id, r]));

export function ref(id: string): PubmedRef | undefined {
  return byId.get(id);
}

export function formatRef(r: PubmedRef): string {
  const vol = r.volume ? `;${r.volume}` : '';
  const pages = r.pages ? `:${r.pages}` : '';
  return `${r.authors}. ${r.title}. ${r.journal}. ${r.year}${vol}${pages}.`;
}

export function refUrl(r: PubmedRef): string {
  return r.doi ? `https://doi.org/${r.doi}` : `https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`;
}

/** A citation attached to a piece of content. */
export interface Citation {
  /** reference ids from the verified registry */
  refs?: string[];
  /** textbook chapter numbers */
  rose?: number[];
  evidence: Evidence;
  /** set when the modern position differs from the textbook's */
  update?: string;
}

export const ALL_REFS = PUBMED_REFS;
export type { PubmedRef };
