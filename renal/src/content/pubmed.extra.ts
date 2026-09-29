// References added while building the interactive textbook. Each entry was checked against its
// PubMed record (PMID, title, authors, journal, year) before being added.
import type { PubmedRef } from './pubmed.generated';

export const EXTRA_REFS: PubmedRef[] = [
  { id: 'bertram2011', pmid: '21604189', doi: '10.1007/s00467-011-1843-8', title: 'Human nephron number: implications for health and disease', authors: 'Bertram JF, Douglas-Denton RN, Diouf B, et al.', journal: 'Pediatr Nephrol', year: 2011, volume: '26', issue: '9', pages: '1529-33', types: ['Review'] },
  { id: 'hillier1999', pmid: '10225241', doi: '10.1016/s0002-9343(99)00055-8', title: 'Hyponatremia: evaluating the correction factor for hyperglycemia', authors: 'Hillier TA, Abbott RD, Barrett EJ', journal: 'Am J Med', year: 1999, volume: '106', issue: '4', pages: '399-403', types: ['Journal Article'] },
];
