// References added while building the interactive textbook. Each entry was checked against its
// PubMed record (PMID, title, authors, journal, year) before being added.
import type { PubmedRef } from './pubmed.generated';

export const EXTRA_REFS: PubmedRef[] = [
  { id: 'bertram2011', pmid: '21604189', doi: '10.1007/s00467-011-1843-8', title: 'Human nephron number: implications for health and disease', authors: 'Bertram JF, Douglas-Denton RN, Diouf B, et al.', journal: 'Pediatr Nephrol', year: 2011, volume: '26', issue: '9', pages: '1529-33', types: ['Review'] },
  { id: 'hillier1999', pmid: '10225241', doi: '10.1016/s0002-9343(99)00055-8', title: 'Hyponatremia: evaluating the correction factor for hyperglycemia', authors: 'Hillier TA, Abbott RD, Barrett EJ', journal: 'Am J Med', year: 1999, volume: '106', issue: '4', pages: '399-403', types: ['Journal Article'] },
  { id: 'enomoto2002', pmid: '12024214', doi: '10.1038/nature742', title: 'Molecular identification of a renal urate anion exchanger that regulates blood urate levels', authors: 'Enomoto A, Kimura H, Chairoungdua A, et al.', journal: 'Nature', year: 2002, volume: '417', issue: '6887', pages: '447-52', types: ['Journal Article'] },
  { id: 'mcmurray2014', pmid: '25176015', doi: '10.1056/NEJMoa1409077', title: 'Angiotensin-neprilysin inhibition versus enalapril in heart failure', authors: 'McMurray JJ, Packer M, Desai AS, et al.', journal: 'N Engl J Med', year: 2014, volume: '371', issue: '11', pages: '993-1004', types: ['Randomized Controlled Trial'] },
  { id: 'bellomo2000', pmid: '11191541', doi: '10.1016/s0140-6736(00)03495-4', title: 'Low-dose dopamine in patients with early renal dysfunction: a placebo-controlled randomised trial', authors: 'Bellomo R, Chapman M, Finfer S, et al.', journal: 'Lancet', year: 2000, volume: '356', issue: '9248', pages: '2139-43', types: ['Randomized Controlled Trial'] },
  { id: 'chen2019roxa', pmid: '31340089', doi: '10.1056/NEJMoa1813599', title: 'Roxadustat for anemia in patients with kidney disease not receiving dialysis', authors: 'Chen N, Hao C, Peng X, et al.', journal: 'N Engl J Med', year: 2019, volume: '381', issue: '11', pages: '1001-1010', types: ['Randomized Controlled Trial'] },
];
