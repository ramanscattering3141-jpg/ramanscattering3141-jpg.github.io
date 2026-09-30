// The interactive-textbook layer. Each chapter of Rose & Post is rebuilt as an original,
// concept-level explanation: what the chapter argues, the causal chains it establishes, the key
// numbers it relies on, its clinical connections, what happens when the physiology fails, and
// questions to test understanding. None of this reproduces the book's text; it is a
// re-expression of its ideas that points back to the chapter as the source.

import type { Citation } from '../sources';

export interface Concept {
  heading: string;
  /** paragraphs of original explanation */
  body: string[];
  /** a causal chain, read top to bottom as "→" */
  chain?: string[];
  /** a short list of facts worth remembering */
  points?: string[];
  cite?: Citation;
  /** module that lets the learner manipulate this concept */
  route?: string;
  /** an equation id from the equation registry */
  equation?: string;
}

export interface KeyNumber {
  label: string;
  value: string;
  note?: string;
}

export interface Pathology {
  name: string;
  /** which step of the normal chain breaks */
  broken: string;
  /** what follows from that */
  consequence: string;
  route?: string;
}

export interface Question {
  q: string;
  options: string[];
  answer: number;
  explanation: string;
  route?: string;
}

export interface ModernUpdate {
  topic: string;
  text: string;
  cite: Citation;
}

export interface ChapterContent {
  n: number;
  title: string;
  /** the chapter's argument in two or three sentences */
  thesis: string;
  concepts: Concept[];
  numbers?: KeyNumber[];
  equations?: string[];
  clinical: string[];
  pathology: Pathology[];
  questions: Question[];
  updates?: ModernUpdate[];
  /** extra module routes beyond those that list this chapter */
  modules?: string[];
}
