import { useState } from 'preact/hooks';
import { PageHead, FiveQuestions, Related, Busy, useTabParam } from '../ui/page';
import { Panel, Readout, Sources, Predict, Tabs, Chain, toneFor } from '../ui/kit';
import { makeParams, useSteady } from '../sim/hooks';
import type { ParamPatch } from '../engine/types';

const TAB_IDS = ['explorer', 'map'] as const;
type Tab = (typeof TAB_IDS)[number];
const TABS: { id: Tab; label: string }[] = [
  { id: 'explorer', label: 'Channelopathy explorer' },
  { id: 'map', label: 'The tubule map' },
];

interface Disorder {
  id: string;
  label: string;
  gene: string;
  segment: string;
  mimics: string;
  patch: ParamPatch;
  note: string;
  ref?: string;
}

const DISORDERS: Disorder[] = [
  {
    id: 'bartter', label: "Bartter syndrome", gene: 'NKCC2 / ROMK / ClC-Kb', segment: 'Thick ascending limb', mimics: 'a loop diuretic',
    patch: { transporters: { NKCC2: 0.3 } },
    note: 'The thick limb cannot reabsorb NaCl: salt wasting, a hypokalaemic alkalosis, high renin and aldosterone, a normal blood pressure, and — because the lumen-positive voltage is lost — hypercalciuria. Presents in infancy.',
    ref: 'simon1996bartter',
  },
  {
    id: 'gitelman', label: "Gitelman syndrome", gene: 'NCC (SLC12A3)', segment: 'Distal convoluted tubule', mimics: 'a thiazide',
    patch: { transporters: { NCC: 0 } },
    note: 'A lifelong thiazide: a milder hypokalaemic alkalosis, but with the thiazide signature of a LOW urine calcium, and hypomagnesaemia as the DCT atrophies. Presents later, often incidentally.',
    ref: 'simon1996gitelman',
  },
  {
    id: 'liddle', label: "Liddle syndrome", gene: 'ENaC (gain of function)', segment: 'Collecting duct', mimics: 'primary aldosteronism, but aldosterone-independent',
    patch: { transporters: { ENaC: 3 } },
    note: 'The sodium channel cannot be switched off: sodium retention, hypertension and a hypokalaemic alkalosis, but with renin AND aldosterone both suppressed. It is corrected by amiloride, not by spironolactone — the channel, not the receptor, is the problem.',
    ref: 'shimkets1994',
  },
  {
    id: 'pha1', label: "Pseudohypoaldosteronism type 1", gene: 'ENaC / MR (loss of function)', segment: 'Collecting duct', mimics: 'aldosterone deficiency, but resistant',
    patch: { transporters: { ENaC: 0.1 } },
    note: 'The channel or receptor does not work, so aldosterone cannot act: salt wasting, hyperkalaemia and acidosis with very high renin and aldosterone — the mirror image of Liddle.',
  },
  {
    id: 'gordon', label: "Gordon syndrome (PHA2)", gene: 'WNK / KLHL3 / CUL3', segment: 'Distal convoluted tubule', mimics: 'the opposite of Gitelman',
    patch: { transporters: { NCC: 3 } },
    note: 'Over-active NCC: sodium retention, hypertension, hyperkalaemia and acidosis with a suppressed renin — and it is corrected by a thiazide, which was the clue that NCC was over-active.',
    ref: 'wilson2001',
  },
  {
    id: 'drta', label: "Distal (type 1) RTA", gene: 'H⁺-ATPase / AE1 (SLC4A1)', segment: 'Collecting duct (α-cell)', mimics: '—',
    patch: { transporters: { HATPase: 0.15 } },
    note: 'The α-intercalated cell cannot secrete H⁺, so the urine cannot be acidified below pH 5.3 however acidaemic the blood: a severe hyperchloraemic acidosis, hypokalaemia, hypercalciuria and stones.',
  },
  {
    id: 'prta', label: "Proximal (type 2) RTA", gene: 'NBCe1 (SLC4A4)', segment: 'Proximal tubule', mimics: '—',
    patch: { transporters: { NBCe1: 0.25 } },
    note: 'Bicarbonate reabsorption is reduced, so it spills until the plasma level falls far enough for the distal nephron to mop up the rest — a self-limiting acidosis that settles at a bicarbonate of 14–18.',
  },
  {
    id: 'fanconi', label: "Fanconi syndrome", gene: 'many (cystinosis, Dent, drugs)', segment: 'Proximal tubule', mimics: '—',
    patch: { transporters: { NHE3: 0.4, NaPi2: 0.3, SGLT2: 0.3, AAtransport: 0.3, NBCe1: 0.4 } },
    note: 'A generalised failure of the proximal tubule: glucose, amino acids, phosphate and bicarbonate are all wasted — glycosuria with a normal blood glucose, hypophosphataemia, and a proximal RTA.',
  },
  {
    id: 'ndi', label: "Nephrogenic diabetes insipidus", gene: 'AVPR2 / AQP2', segment: 'Collecting duct', mimics: 'lithium, hypercalcaemia',
    patch: { transporters: { AQP2: 0.1 } },
    note: 'The collecting duct cannot respond to ADH: large volumes of dilute urine that no amount of vasopressin will concentrate, and a tendency to hypernatraemia if water is not freely available.',
    ref: 'bockenhauer2015',
  },
];

// ---------------------------------------------------------------- explorer

function ExplorerTab() {
  const [idx, setIdx] = useState(0);
  const [mystery, setMystery] = useState(false);
  const [guess, setGuess] = useState<number | null>(null);
  const d = DISORDERS[idx];
  const run = useSteady(makeParams(d.patch), 30);
  const normal = useSteady(makeParams(), 30);
  const e = run.ev;
  const newMystery = () => {
    let n = idx;
    while (n === idx) n = Math.floor(Math.random() * DISORDERS.length);
    setIdx(n);
    setGuess(null);
    setMystery(true);
  };
  const hidden = mystery && guess === null;
  return (
    <>
      <div class="btn-row" style={{ marginBottom: 8 }}>
        <button class={!mystery ? 'active' : ''} onClick={() => setMystery(false)}>Explore</button>
        <button class={mystery ? 'active' : ''} onClick={newMystery}>Mystery patient</button>
      </div>
      {!mystery && (
        <div class="btn-row" style={{ marginBottom: 8 }}>
          {DISORDERS.map((x, i) => (
            <button key={x.id} class={i === idx ? 'active' : ''} onClick={() => setIdx(i)}>{x.label}</button>
          ))}
        </div>
      )}
      <div class="grid grid-sidebar">
        <div>
          <Panel title={hidden ? 'An inherited tubular disorder' : `${d.label}`} note={hidden ? 'Read the chemistry and the blood pressure, decide which segment and which transporter, then name it.' : `${d.gene} · ${d.segment} · mimics ${d.mimics}`}>
            <Busy on={run.busy || normal.busy} />
            {e && (
              <div class="readout-grid">
                <Readout label="Mean BP" value={e.reg.MAP} digits={0} unit="mmHg" tone={e.reg.MAP > 100 ? 'high' : e.reg.MAP < 82 ? 'low' : 'normal'} />
                <Readout label="Potassium" value={e.plasma.K} digits={1} unit="mmol/L" tone={toneFor(e.plasma.K, 3.5, 5.0, [2.5, 6.5])} />
                <Readout label="Bicarbonate" value={e.plasma.HCO3} digits={0} unit="mmol/L" tone={toneFor(e.plasma.HCO3, 22, 28)} />
                <Readout label="Magnesium" value={e.plasma.Mg} digits={2} unit="mmol/L" tone={toneFor(e.plasma.Mg, 0.7, 1.0)} />
                <Readout label="Urine calcium" value={e.kidney.urine.exc.Ca} digits={1} unit="mmol/d" tone={e.kidney.urine.exc.Ca > 7.5 ? 'high' : e.kidney.urine.exc.Ca < 2.5 ? 'low' : 'normal'} />
                <Readout label="Urine osmolality" value={e.kidney.urine.osm} digits={0} unit="mOsm/kg" tone={e.kidney.urine.osm < 150 ? 'low' : 'normal'} />
                <Readout label="Renin" value={e.reg.hormones.renin} digits={2} unit="× normal" tone={e.reg.hormones.renin > 1.5 ? 'high' : e.reg.hormones.renin < 0.5 ? 'low' : 'normal'} />
                <Readout label="Aldosterone" value={e.reg.hormones.aldo} digits={2} unit="× normal" tone={e.reg.hormones.aldo > 1.5 ? 'high' : e.reg.hormones.aldo < 0.5 ? 'low' : 'normal'} />
              </div>
            )}
          </Panel>
          {mystery && (
            <Panel title="Your diagnosis">
              <div class="btn-row">
                {DISORDERS.map((x, i) => (
                  <button key={x.id} class={guess === null ? '' : i === idx ? 'primary' : guess === i ? '' : 'ghost'} style={guess === i && i !== idx ? { borderColor: 'var(--danger)' } : undefined} onClick={() => setGuess(i)}>
                    {x.label}
                  </button>
                ))}
              </div>
              {guess !== null && (
                <p class="note" style={{ marginBottom: 0 }}>
                  <strong>{guess === idx ? 'Right.' : `It was ${d.label}.`}</strong> {d.note}{' '}
                  <button class="ghost" onClick={newMystery}>Another patient</button>
                </p>
              )}
            </Panel>
          )}
        </div>
        <div>
          {!hidden && (
            <Panel title="What it is" note={d.note}>
              <div class="chips" style={{ marginBottom: 8 }}>
                <span class="tag">Gene: {d.gene}</span>
                <span class="tag">Segment: {d.segment}</span>
                {d.mimics !== '—' && <span class="tag">Mimics {d.mimics}</span>}
              </div>
              {d.ref && <Sources cite={{ rose: [18, 27], evidence: 'experimental', refs: [d.ref] }} />}
              {!d.ref && <Sources cite={{ rose: [18, 27], evidence: 'clinical' }} />}
            </Panel>
          )}
          <Panel title="The two questions that place it">
            <Chain
              steps={[
                { text: 'Blood pressure: LOW/normal (a salt-wasting tubulopathy) or HIGH (a salt-retaining one)?', direction: 0 },
                { text: 'Potassium and acid–base: hypokalaemic alkalosis (loop/DCT/ENaC-gain) or hyperkalaemic acidosis (ENaC-loss/NCC-gain/type 4)?', direction: 0 },
                { text: 'Then the fine print — urine calcium (Bartter high, Gitelman low), magnesium, the urine pH — names the transporter', direction: 0 },
              ]}
            />
          </Panel>
        </div>
      </div>
      <Predict
        question="A normotensive adult is found to have K⁺ 2.9, HCO₃⁻ 30, a low magnesium and a LOW urine calcium. Which is it?"
        options={['Bartter syndrome', 'Gitelman syndrome', 'Liddle syndrome', 'Gordon syndrome']}
        correct={1}
        explanation="A hypokalaemic alkalosis with a normal blood pressure, hypomagnesaemia and — the discriminator — a low urine calcium is the thiazide-like pattern of Gitelman syndrome. Bartter has a high urine calcium; Liddle and Gordon are hypertensive."
      />
    </>
  );
}

// ---------------------------------------------------------------- map

function MapTab() {
  return (
    <>
      <div class="grid grid-2">
        <Panel title="Salt-wasting (low or normal blood pressure)">
          <ul class="muted" style={{ fontSize: '0.9rem', marginTop: 0, lineHeight: 1.8 }}>
            <li><strong>Bartter</strong> (thick limb, NKCC2/ROMK/ClC-Kb) — a loop diuretic: hypokalaemic alkalosis, high urine calcium.</li>
            <li><strong>Gitelman</strong> (DCT, NCC) — a thiazide: hypokalaemic alkalosis, low urine calcium, low magnesium.</li>
            <li><strong>PHA type 1</strong> (ENaC/MR loss) — aldosterone resistance: hyperkalaemic acidosis, high aldosterone.</li>
          </ul>
        </Panel>
        <Panel title="Salt-retaining (hypertension)">
          <ul class="muted" style={{ fontSize: '0.9rem', marginTop: 0, lineHeight: 1.8 }}>
            <li><strong>Liddle</strong> (ENaC gain) — hypokalaemic alkalosis, renin and aldosterone both suppressed; treat with amiloride.</li>
            <li><strong>Gordon / PHA2</strong> (WNK/NCC gain) — hyperkalaemic acidosis, low renin; treat with a thiazide.</li>
            <li><strong>AME, GRA</strong> — mineralocorticoid excess of other kinds (see the potassium and RAAS pages).</li>
          </ul>
        </Panel>
        <Panel title="Acidification defects">
          <ul class="muted" style={{ fontSize: '0.9rem', marginTop: 0, lineHeight: 1.8 }}>
            <li><strong>Distal (type 1) RTA</strong> (H⁺-ATPase, AE1) — cannot acidify the urine; severe acidosis, hypokalaemia, stones.</li>
            <li><strong>Proximal (type 2) RTA</strong> (NBCe1) — bicarbonate wasting; self-limiting acidosis.</li>
            <li><strong>Type 4</strong> — aldosterone deficiency or resistance; hyperkalaemic acidosis (see hyperkalaemia).</li>
          </ul>
        </Panel>
        <Panel title="Proximal & water defects">
          <ul class="muted" style={{ fontSize: '0.9rem', marginTop: 0, lineHeight: 1.8 }}>
            <li><strong>Fanconi</strong> (cystinosis, Dent, drugs) — global proximal failure: glycosuria, aminoaciduria, phosphaturia, proximal RTA.</li>
            <li><strong>Nephrogenic DI</strong> (AVPR2, AQP2) — cannot respond to ADH: dilute polyuria, hypernatraemia.</li>
            <li><strong>Familial hypomagnesaemia</strong> (claudin-16) — thick-limb pore loss: hypomagnesaemia, hypercalciuria, nephrocalcinosis.</li>
          </ul>
        </Panel>
      </div>
      <Panel title="The unifying idea" id="idea">
        <p class="muted" style={{ fontSize: '0.95rem', lineHeight: 1.7 }}>
          Each inherited tubular disorder knocks out one transporter, and its phenotype is exactly what that transporter's job was — which is why several of them are the living equivalent of a drug that blocks the same protein. Gitelman is a lifelong thiazide; Bartter a lifelong loop diuretic; Liddle a sodium channel stuck open; Gordon the same channel's upstream regulator stuck on. Learn the transporters along the nephron and the diseases fall out of them, and so do their treatments.
        </p>
        <Sources cite={{ rose: [18, 27], evidence: 'experimental', refs: ['simon1996bartter', 'simon1996gitelman', 'shimkets1994', 'wilson2001', 'konrad2021'] }} />
      </Panel>
    </>
  );
}

// ----------------------------------------------------------------

export default function Inherited({ query }: { query: URLSearchParams }) {
  const [tab, setTab] = useTabParam('/inherited', TAB_IDS, 'explorer', query);
  return (
    <div>
      <PageHead
        path="/inherited"
        lede="The inherited tubular disorders are single-transporter lesions, and each reads as the job that transporter did. Two questions place almost all of them: is the blood pressure low or high, and is the picture a hypokalaemic alkalosis or a hyperkalaemic acidosis? The fine print — urine calcium, magnesium, urine pH — names the gene."
      />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'explorer' && <ExplorerTab />}
      {tab === 'map' && <MapTab />}
      <Panel title="The five questions">
        <FiveQuestions
          normal={<p>Each nephron segment reabsorbs its share through named transporters — NKCC2 in the loop, NCC in the DCT, ENaC in the collecting duct — under hormonal control.</p>}
          why={<p>A loss- or gain-of-function mutation in one transporter removes or exaggerates that segment's job, and the plasma and urine change in exactly the predictable way.</p>}
          change={<p>Blood pressure separates the salt-wasting from the salt-retaining disorders; potassium and acid–base separate the collecting-duct lesions; urine calcium and magnesium separate the loop from the DCT.</p>}
          abnormal={<p>Hypokalaemic alkalosis (Bartter, Gitelman, Liddle), hyperkalaemic acidosis (PHA1, Gordon, type 4), the renal tubular acidoses, Fanconi syndrome and nephrogenic diabetes insipidus.</p>}
          clinical={<p>Match the treatment to the lesion: amiloride for Liddle, a thiazide for Gordon, potassium and magnesium for Bartter and Gitelman, alkali for the RTAs, and free water access for nephrogenic DI.</p>}
        />
        <Sources cite={{ rose: [18, 27], evidence: 'experimental', refs: ['simon1996bartter', 'simon1996gitelman', 'shimkets1994', 'wilson2001', 'lifton1992', 'konrad2021'] }} />
      </Panel>
      <Related paths={['/distal', '/loop', '/rta', '/hypokalemia', '/hyperkalemia', '/minerals']} />
    </div>
  );
}
