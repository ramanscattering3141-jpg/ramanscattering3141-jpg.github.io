import { useState } from 'preact/hooks';
import { PageHead, FiveQuestions, Related, Busy, Toggle, useTabParam } from '../ui/page';
import { Panel, Readout, Slider, Sources, Predict, Tabs, Chain, Expand, toneFor } from '../ui/kit';
import { makeParams, useSteady } from '../sim/hooks';
import { si } from '../units';

const TAB_IDS = ['obstructed', 'relief'] as const;
type Tab = (typeof TAB_IDS)[number];
const TABS: { id: Tab; label: string }[] = [
  { id: 'obstructed', label: 'The obstructed kidney' },
  { id: 'relief', label: 'Relief & post-obstructive diuresis' },
];

// ---------------------------------------------------------------- obstructed

function ObstructedTab() {
  const [level, setLevel] = useState(0.7);
  const [bilateral, setBilateral] = useState(true);
  const patch = bilateral ? { obstructionL: level, obstructionR: level } : { obstructionL: level };
  const run = useSteady(makeParams(patch), 25);
  const normal = useSteady(makeParams(), 25);
  const e = run.ev;
  return (
    <>
      <div class="grid grid-sidebar">
        <div>
          <Panel title="Raise the back-pressure" note="Obstruction raises the pressure in Bowman's space, which opposes filtration. The single kidney behind a blocked ureter, or both behind a blocked bladder outlet.">
            <Busy on={run.busy || normal.busy} />
            <Slider label="Degree of obstruction" value={level} min={0} max={0.95} step={0.05} onInput={setLevel} format={(v) => `${(v * 100).toFixed(0)}%`} />
            <Toggle label="Bilateral (or a single functioning kidney)" checked={bilateral} onChange={setBilateral} hint="Unilateral obstruction is masked — the other kidney holds the blood chemistry normal." />
            {e && (
              <div class="readout-grid">
                <Readout label="Total GFR" value={e.kidney.GFR} digits={0} unit="mL/min" tone={e.kidney.GFR < 30 ? 'danger' : e.kidney.GFR < 80 ? 'high' : 'normal'} />
                <Readout label="Creatinine" value={si.creat(e.body.creat)} digits={0} unit="µmol/L" tone={e.body.creat > 1.3 ? 'high' : 'normal'} />
                <Readout label="Obstructed-side Pbs" value={e.kidney.sides[0].Pbs} digits={0} unit="mmHg" tone="high" refRange="≈ 10 normal" />
                <Readout label="Obstructed-side GFR" value={e.kidney.sides[0].GFR} digits={0} unit="mL/min" tone={e.kidney.sides[0].GFR < 30 ? 'danger' : 'normal'} />
              </div>
            )}
            <p class="note" style={{ marginBottom: 0 }}>
              {!bilateral && e ? `The unobstructed kidney (${e.kidney.sides[1].GFR.toFixed(0)} mL/min) carries the load, so the creatinine barely moves — which is why unilateral obstruction can be silent for a long time.` : 'With both kidneys obstructed, the filtration falls and the creatinine rises.'}
            </p>
          </Panel>
          <Panel title="The tubular defects it leaves">
            <Chain
              steps={[
                { text: 'Back-pressure → falling GFR (and, if bilateral, uraemia)', direction: -1 },
                { text: 'Medullary blood flow and architecture disturbed → concentrating defect (polyuria, nocturia)', direction: -1 },
                { text: 'Distal H⁺ and K⁺ secretion impaired → hyperkalaemic, hyperchloraemic acidosis (a type-4-like picture)', direction: 1 },
                { text: 'Relief may be followed by a post-obstructive diuresis', direction: 0 },
              ]}
            />
            <Sources cite={{ rose: [2], evidence: 'clinical' }} />
          </Panel>
        </div>
        <div>
          <Panel title="The picture behind the block">
            {e && normal.ev && (
              <div class="readout-grid">
                <Readout label="Urine osmolality" value={e.kidney.urine.osm} digits={0} unit="mOsm/kg" tone={e.kidney.urine.osm < normal.ev.kidney.urine.osm - 50 ? 'low' : 'normal'} refRange="concentrating defect" />
                <Readout label="Potassium" value={e.plasma.K} digits={1} unit="mmol/L" tone={toneFor(e.plasma.K, 3.5, 5.0, [3, 6])} />
                <Readout label="Bicarbonate" value={e.plasma.HCO3} digits={0} unit="mmol/L" tone={toneFor(e.plasma.HCO3, 22, 28)} />
                <Readout label="Mean BP" value={e.reg.MAP} digits={0} unit="mmHg" tone={e.reg.MAP > 100 ? 'high' : 'normal'} />
              </div>
            )}
          </Panel>
          <Panel title="Why it comes first">
            <p class="muted" style={{ fontSize: '0.9rem', marginTop: 0, lineHeight: 1.7 }}>
              Obstruction is the category of acute kidney injury to exclude first, because it is the one that is mechanically reversible — a catheter, a nephrostomy, a stent — and because a kidney left obstructed loses function permanently over weeks. A bladder scan and an ultrasound looking for a dilated collecting system take minutes and change the whole management.
            </p>
            <p class="muted" style={{ fontSize: '0.9rem', lineHeight: 1.7, marginBottom: 0 }}>
              The catch: a kidney that is volume-depleted, or obstructed only recently, or encased in retroperitoneal fibrosis, may not show dilatation — so a normal ultrasound does not fully exclude it when the suspicion is high.
            </p>
          </Panel>
        </div>
      </div>
      <Predict
        question="A man cannot pass urine and his creatinine is 400 µmol/L. The ultrasound shows both kidneys dilated. What is the single most useful next step?"
        options={['Start dialysis', 'Pass a urinary catheter — bladder outlet obstruction relieved at the bedside', 'Give furosemide', 'CT with contrast']}
        correct={1}
        explanation="Bilateral hydronephrosis with retention points to bladder outlet obstruction. A catheter relieves it immediately, the GFR recovers, and dialysis is usually avoided. Always relieve the obstruction before anything else."
      />
    </>
  );
}

// ---------------------------------------------------------------- relief

function ReliefTab() {
  return (
    <>
      <div class="grid grid-sidebar">
        <div>
          <Panel title="Post-obstructive diuresis" note="After bilateral obstruction is relieved, some patients pass litres of urine. Most of it is appropriate; a minority is a genuine tubular defect that needs replacing.">
            <Chain
              steps={[
                { text: 'While obstructed: urea, sodium and water are retained; the tubule is damaged', direction: 1 },
                { text: 'Obstruction relieved → filtration returns', direction: 1 },
                { text: 'Retained urea and salt drive an osmotic diuresis — appropriate, clearing the excess', direction: 0 },
                { text: 'Plus a real, transient defect in concentrating and reabsorption — inappropriate, and the part that can cause harm', direction: -1 },
                { text: 'Usually settles in days as the tubules recover', direction: 1 },
              ]}
            />
            <Sources cite={{ rose: [2], evidence: 'clinical' }} />
          </Panel>
        </div>
        <div>
          <Panel title="Appropriate versus inappropriate">
            <p class="muted" style={{ fontSize: '0.9rem', marginTop: 0, lineHeight: 1.7 }}>
              Most post-obstructive diuresis is the kidney doing the right thing — offloading the sodium and water that accumulated while it could not, and clearing the retained urea as an osmotic diuresis. Replacing all of it with fluid would only perpetuate the diuresis.
            </p>
            <p class="muted" style={{ fontSize: '0.9rem', lineHeight: 1.7 }}>
              A smaller part is a true defect: the obstructed tubule loses its ability to concentrate and to reabsorb sodium, so it wastes water and salt inappropriately. The way to tell them apart is to watch the volume status and the electrolytes: if the patient stays euvolaemic and the losses track the excess, replace conservatively; if they become volume-depleted or hyponatraemic or hypokalaemic, replace the measured losses.
            </p>
            <p class="muted" style={{ fontSize: '0.9rem', lineHeight: 1.7, marginBottom: 0 }}>
              The practical rule Rose gives: do not match urine output litre for litre — that drives the diuresis on. Replace a fraction, and let the appropriate component resolve itself.
            </p>
          </Panel>
        </div>
      </div>
      <Predict
        question="After relieving bilateral obstruction a patient passes 6 L of urine in 12 hours. His blood pressure and sodium are normal. How should the fluid be replaced?"
        options={['Match the output litre for litre', 'Replace conservatively (a fraction of the output) and watch volume and electrolytes — most of this is appropriate offloading', 'Give no fluid at all', 'Stop all fluids and dialyse']}
        correct={1}
        explanation="Matching the output perpetuates the osmotic diuresis. Replace a fraction, monitor volume status and electrolytes, and let the appropriate component clear the retained salt, water and urea. Escalate replacement only if the patient becomes depleted."
      />
      <Expand summary="What the model captures">
        <p class="muted" style={{ fontSize: '0.88rem' }}>
          The obstructed-kidney tab is a steady state the engine holds — the raised Bowman's pressure, the fall in GFR, and the concentrating and potassium defects behind the block. The diuresis after relief is a time-dependent, tubular-recovery phenomenon the model does not run, so it is set out here as physiology rather than simulated.
        </p>
      </Expand>
    </>
  );
}

// ----------------------------------------------------------------

export default function Obstruction({ query }: { query: URLSearchParams }) {
  const [tab, setTab] = useTabParam('/obstruction', TAB_IDS, 'obstructed', query);
  return (
    <div>
      <PageHead
        path="/obstruction"
        lede="Urinary obstruction is the mechanically reversible kidney injury — the one to find first. It raises the pressure in Bowman's space against filtration, and behind the block it leaves a kidney that cannot concentrate the urine, secrete acid or secrete potassium. Relieved in time, it recovers; left in place, it is lost."
      />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'obstructed' && <ObstructedTab />}
      {tab === 'relief' && <ReliefTab />}
      <Panel title="The five questions">
        <FiveQuestions
          normal={<p>Filtration depends on the pressure gradient across the glomerulus: the capillary pressure pushing out, minus the oncotic pressure and the pressure in Bowman's space pushing back.</p>}
          why={<p>Obstruction raises the downstream (pelvic and tubular) pressure, which is transmitted back to Bowman's space and opposes filtration; sustained, it damages the tubule and loses nephrons.</p>}
          change={<p>Unilateral obstruction is compensated by the other kidney and can be silent; bilateral obstruction (or a single kidney) raises the creatinine and produces uraemia.</p>}
          abnormal={<p>Falling GFR, a concentrating defect, and a hyperkalaemic hyperchloraemic acidosis; after relief, a post-obstructive diuresis.</p>}
          clinical={<p>Exclude it early with a bladder scan and ultrasound; relieve it (catheter, stent, nephrostomy); replace post-obstructive losses conservatively and watch the electrolytes.</p>}
        />
        <Sources cite={{ rose: [2], evidence: 'clinical' }} />
      </Panel>
      <Related paths={['/aki', '/prerenal-atn', '/gfr', '/rta', '/creatinine']} />
    </div>
  );
}
