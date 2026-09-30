import { si } from '../units';
import { useState } from 'preact/hooks';
import { GROUPS, ROUTES, isReady, readyRoute } from '../routes';
import { href } from '../router';
import { Chain, Panel, Readout, Slider } from '../ui/kit';
import { NephronDiagram } from '../ui/NephronDiagram';
import { useAcute, makeParams } from '../sim/hooks';
import { ROSE_CHAPTERS } from '../content/sources';

const FEATURED = ['/sandbox', '/break', '/flow', '/arterioles', '/countercurrent', '/diuretics', '/hyponatremia', '/rta', '/cases'];

export default function Home() {
  const [adh, setAdh] = useState(2);
  // A live taste of the laboratory: drive ADH directly and watch the urine respond.
  const ev = useAcute(makeParams({ adhAutonomous: adh, centralDI: 1 }));
  const u = ev.kidney.urine;

  return (
    <div>
      <header class="page-head hero">
        <div class="eyebrow">An interactive renal physiology laboratory</div>
        <h1>Change a variable. Watch the kidney respond. Understand why.</h1>
        <p class="lede">
          This laboratory rebuilds the reasoning of Rose &amp; Post’s <em>Clinical Physiology of Acid-Base and Electrolyte Disorders</em> as physiology you can manipulate. Every simulator
          runs on one integrated model — glomerulus, tubule, hormones and body fluids — so a change anywhere propagates through the whole causal chain, from transporter to
          laboratory result.
        </p>
        <div class="btn-row">
          {readyRoute('/lessons') && (
            <a class="btn primary-link" href={href('/lessons')}>
              Start a guided lesson
            </a>
          )}
          <a class={readyRoute('/lessons') ? 'btn' : 'btn primary-link'} href={href('/textbook')}>
            Open the interactive textbook
          </a>
          {readyRoute('/sandbox') ? (
            <a class="btn" href={href('/sandbox')}>
              Go straight to the sandbox
            </a>
          ) : (
            <a class="btn" href={href('/nephron')}>
              Explore the nephron
            </a>
          )}
        </div>
      </header>

      <div class="grid grid-main-side">
        <Panel title="Try it: vasopressin and the urine" note="Drag ADH. The collecting duct’s water permeability, urine volume and urine osmolality all come from the same model the rest of the laboratory uses.">
          <div class="grid grid-2">
            <div>
              <Slider label="Plasma ADH" value={adh} min={0} max={10} step={0.1} unit="pmol/L" format={(v) => si.adh(v).toFixed(1)} onInput={setAdh} normal={1.5} />
              <div class="readout-grid">
                <Readout label="AQP2 insertion" value={ev.reg.hormones.aqp2 * 100} unit="%" />
                <Readout label="Urine volume" value={u.volumePerDay} digits={1} unit="L/day" tone={u.volumePerDay > 3 ? 'high' : u.volumePerDay < 0.8 ? 'low' : 'normal'} />
                <Readout label="Urine osmolality" value={u.osm} unit="mOsm/kg" tone={u.osm < 200 ? 'low' : u.osm > 700 ? 'high' : 'normal'} />
                <Readout label="Free-water clearance" value={u.exc.freeWater} digits={1} unit="L/day" />
              </div>
              <Chain
                steps={[
                  { text: 'ADH binds V2 receptors on principal cells', direction: adh > 2 ? 1 : adh < 1 ? -1 : 0 },
                  { text: 'Aquaporin-2 inserted into the apical membrane', direction: adh > 2 ? 1 : adh < 1 ? -1 : 0 },
                  { text: 'Water leaves the collecting duct toward the hypertonic medulla', direction: adh > 2 ? 1 : adh < 1 ? -1 : 0 },
                  { text: 'Urine volume', direction: adh > 2 ? -1 : adh < 1 ? 1 : 0 },
                  { text: 'Urine osmolality', direction: adh > 2 ? 1 : adh < 1 ? -1 : 0 },
                ]}
              />
            </div>
            <NephronDiagram labels={false} marks={{ CCD: 'active', OMCD: 'active', IMCD: 'active' }} medullaOsm={ev.kidney.medullaTarget} height={360} />
          </div>
        </Panel>
        <Panel title="How to use this laboratory">
          <ol class="muted" style={{ fontSize: '0.9rem' }}>
            <li>
              <strong>Predict</strong> what a change will do before you make it.
            </li>
            <li>
              <strong>Manipulate</strong> the variable and watch every downstream quantity move.
            </li>
            <li>
              <strong>Explain</strong> the result with the causal chain beside it.
            </li>
            <li>
              <strong>Break</strong> something and see which disease you have made.
            </li>
          </ol>
          <p class="muted" style={{ fontSize: '0.86rem' }}>
            Badges tell you what kind of claim you are reading: <span class="badge physiology">Fundamental physiology</span> <span class="badge experimental">Experimental physiology</span>{' '}
            <span class="badge clinical">Clinical evidence</span> <span class="badge guideline">Guideline recommendation</span> <span class="badge reasoning">Clinical reasoning</span>. Where modern
            understanding differs from the 2001 textbook, a <span class="badge update">Modern update</span> note says so.
          </p>
          <p class="muted" style={{ fontSize: '0.86rem', marginBottom: 0 }}>
            Switch between <strong>Conceptual</strong> and <strong>Quantitative</strong> mode in the sidebar to show or hide the underlying numbers.
          </p>
        </Panel>
      </div>

      <h2 style={{ marginTop: 10 }}>Flagship experiments</h2>
      <div class="grid grid-3" style={{ marginBottom: 22 }}>
        {FEATURED.map((p) => {
          const r = readyRoute(p);
          if (!r) return null;
          return (
            <a key={p} class="card-link" href={href(p)}>
              <h4>{r.title}</h4>
              <p>{r.blurb}</p>
            </a>
          );
        })}
      </div>

      <h2>The textbook, rebuilt</h2>
      <p class="muted">Each chapter becomes a sequence: core explanation → interactive diagram → simulation → clinical connection → pathology → equations → questions → sources.</p>
      <div class="chapter-strip">
        {ROSE_CHAPTERS.filter((c) => c.n <= 30).map((c) => (
          <a key={c.n} class="chapter-chip" href={href('/textbook', { ch: String(c.n) })}>
            <span class="n">{c.n}</span>
            {c.title}
          </a>
        ))}
      </div>

      <h2 style={{ marginTop: 24 }}>All modules</h2>
      <div class="grid grid-3">
        {GROUPS.filter((g) => g.id !== 'start').map((g) => (
          <Panel key={g.id} title={g.label}>
            <ul style={{ margin: 0, paddingLeft: '1em', fontSize: '0.88rem' }}>
              {ROUTES.filter((r) => r.group === g.id).map((r) => (
                <li key={r.path}>
                  {isReady(r) ? (
                    <a href={href(r.path)}>{r.title}</a>
                  ) : (
                    <span class="faint">{r.title} · in preparation</span>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>
      <p class="faint" style={{ fontSize: '0.8rem', marginTop: 20 }}>
        Educational simulation. The model is built to be internally consistent and qualitatively faithful to renal physiology; its numbers are illustrative and it is not a clinical
        decision tool.
      </p>
    </div>
  );
}
