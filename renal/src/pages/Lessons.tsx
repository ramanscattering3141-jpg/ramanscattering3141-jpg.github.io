import { PageHead, Related } from '../ui/page';
import { Panel } from '../ui/kit';
import { ROUTES, isReady } from '../routes';
import { href } from '../router';

interface Step {
  path: string;
  why: string;
}
interface Lesson {
  id: string;
  title: string;
  intro: string;
  steps: Step[];
}

const LESSONS: Lesson[] = [
  {
    id: 'nephron', title: 'From blood to urine',
    intro: 'Follow the fluid through the nephron once, segment by segment, and you have the frame every disorder hangs on.',
    steps: [
      { path: '/nephron', why: 'See the whole nephron and what each segment does.' },
      { path: '/gfr', why: 'How filtration is set at the glomerulus.' },
      { path: '/arterioles', why: 'The two arterioles that tune the pressure and flow.' },
      { path: '/proximal', why: 'Where two-thirds of everything is reabsorbed.' },
      { path: '/loop', why: 'The countercurrent engine that concentrates the urine.' },
      { path: '/distal', why: 'The fine, hormone-controlled adjustments at the end.' },
    ],
  },
  {
    id: 'volume', title: 'Sodium, volume and pressure',
    intro: 'The kidney does not sense sodium or volume directly — it senses the fullness of the arterial circulation, and defends it.',
    steps: [
      { path: '/sodium', why: 'Why sodium balance is really volume balance.' },
      { path: '/raas', why: 'The cascade that retains sodium when volume falls.' },
      { path: '/edema', why: 'When the same machinery retains sodium into oedema.' },
      { path: '/hypovolemia', why: 'Reading the volume-depleted patient.' },
      { path: '/diuretics', why: 'Turning the machinery off, segment by segment.' },
    ],
  },
  {
    id: 'water', title: 'Water and the sodium concentration',
    intro: 'Sodium concentration is a water problem, set by ADH and thirst — separate from the sodium content, which is volume.',
    steps: [
      { path: '/adh', why: 'How ADH sets the collecting duct’s water permeability.' },
      { path: '/urine-osmolality', why: 'Reading the urine to find the water defect.' },
      { path: '/free-water', why: 'Free-water clearance: the balance that sets the sodium.' },
      { path: '/hyponatremia', why: 'When water is retained: the commonest electrolyte disorder.' },
      { path: '/water-disorders', why: 'The whole map of too much and too little water.' },
    ],
  },
  {
    id: 'acid', title: 'Acid–base from the ground up',
    intro: 'Two organs, one pH: the lungs set the PCO₂, the kidney sets the bicarbonate, and every disorder is read the same way.',
    steps: [
      { path: '/acid-base', why: 'Buffers, Henderson–Hasselbalch and the live model.' },
      { path: '/bicarbonate', why: 'How the kidney reclaims and regenerates bicarbonate.' },
      { path: '/ammonium', why: 'The ammonium system that excretes the daily acid.' },
      { path: '/metabolic-acidosis', why: 'The high-gap and normal-gap acidoses.' },
      { path: '/rta', why: 'When the kidney itself is the cause.' },
      { path: '/mixed', why: 'Reading any blood gas, including the mixed disorders.' },
    ],
  },
  {
    id: 'potassium', title: 'Potassium, inside and out',
    intro: 'Potassium is defended twice — by shifts across cell membranes within minutes, and by renal excretion over hours.',
    steps: [
      { path: '/potassium', why: 'Internal balance and the distal secretory machinery.' },
      { path: '/hypokalemia', why: 'Losses, shifts, and the ECG.' },
      { path: '/hyperkalemia', why: 'Failed excretion, and the emergency.' },
      { path: '/minerals', why: 'Why magnesium must be checked alongside it.' },
    ],
  },
  {
    id: 'failing', title: 'The failing kidney',
    intro: 'Acute or chronic, injury reads the same way: find the category, then follow the consequences the physiology predicts.',
    steps: [
      { path: '/aki', why: 'The acute fall in GFR, staged and categorised.' },
      { path: '/prerenal-atn', why: 'Separating hypoperfusion from tubular injury.' },
      { path: '/obstruction', why: 'The reversible cause to catch first.' },
      { path: '/ckd', why: 'The slow loss, and the order its adaptations fail.' },
      { path: '/glomerular', why: 'When the filter itself is diseased.' },
      { path: '/inherited', why: 'The single-transporter lesions that read as drugs.' },
    ],
  },
];

export default function Lessons({ query }: { query: URLSearchParams }) {
  void query;
  return (
    <div>
      <PageHead
        path="/lessons"
        lede="Ordered paths through the lab. Each lesson is a short sequence of modules that build on one another, with a line on why each comes next. Work one top to bottom and a whole area of the subject falls into place — the physiology first, then the disorders that follow from it."
      />
      {LESSONS.map((lesson) => (
        <Panel key={lesson.id} title={lesson.title} note={lesson.intro}>
          <ol class="lesson-steps" style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
            {lesson.steps.filter((s) => isReady(ROUTES.find((r) => r.path === s.path))).map((s, i) => {
              const r = ROUTES.find((x) => x.path === s.path)!;
              return (
                <li key={s.path} style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '6px 0', borderBottom: '1px solid var(--line-soft)' }}>
                  <span class="arrow" style={{ flex: '0 0 auto' }}>{i + 1}</span>
                  <span>
                    <a href={href(s.path)} style={{ fontWeight: 600 }}>{r.title}</a>
                    <span class="muted" style={{ marginLeft: 8, fontSize: '0.9rem' }}>{s.why}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </Panel>
      ))}
      <Related paths={['/challenges', '/cases', '/tutor', '/textbook', '/sandbox']} />
    </div>
  );
}
