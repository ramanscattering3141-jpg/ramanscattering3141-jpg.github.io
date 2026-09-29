import { useMemo, useState } from 'preact/hooks';
import { PageHead, FiveQuestions, Related } from '../ui/page';
import { Panel, Readout, Sources, Tabs, Chain } from '../ui/kit';
import { CellDiagram, type CellCarrier } from '../ui/CellDiagram';
import { SegmentDetail } from '../ui/SegmentDetail';
import { SEGMENT_INFO } from '../content/segments';
import { SEGMENTS, DEFAULT_TRANSPORTERS, type SegmentId, type Transporters } from '../engine/types';
import { acute, makeParams, NORMAL, useSteady } from '../sim/hooks';
import { NephronDiagram } from '../ui/NephronDiagram';

const COLORS = ['#5ecfba', '#7bc47f', '#6aa9e8', '#f2b134', '#b08ee0', '#e4a26b'];

export default function TransportLab({ query }: { query: URLSearchParams }) {
  const initial = (query.get('s') as SegmentId) || 'TAL';
  const [seg, setSeg] = useState<SegmentId>(SEGMENTS.includes(initial) ? initial : 'TAL');
  const [tx, setTx] = useState<Partial<Transporters>>({});
  const info = SEGMENT_INFO[seg];
  const params = useMemo(() => makeParams({ transporters: tx }), [tx]);
  const ev = useMemo(() => acute(params), [params]);
  const steady = useSteady(params);
  const n = NORMAL();
  const toggle = (key: keyof Transporters) => setTx({ ...tx, [key]: (tx[key] ?? 1) > 0.5 ? 0 : 1 });
  const offKeys = Object.entries(tx).filter(([, v]) => (v ?? 1) < 0.5).map(([k]) => k);

  const carriers = (m: 'apical' | 'basolateral'): CellCarrier[] =>
    info.transporters
      .filter((t) => t.membrane === m)
      .slice(0, 5)
      .map((t, i) => ({
        label: (t.key ?? t.name.split(' ')[0]).replace('NaKATPase', 'NaK').slice(0, 7),
        moves: t.moves.length > 34 ? t.moves.slice(0, 33) + '…' : t.moves,
        dir: (m === 'apical' ? /(into|to|back into) the lumen|secret/i.test(t.moves) : /into the cell|from (the )?blood|uptake/i.test(t.moves)) ? 'out' : 'in',
        activity: t.key ? (tx[t.key] ?? DEFAULT_TRANSPORTERS[t.key]) : 1,
        color: COLORS[i % COLORS.length],
        onClick: t.key ? () => toggle(t.key!) : undefined,
      }));
  const para = info.transporters.filter((t) => t.membrane === 'paracellular').map((t) => ({ label: t.moves.split(' ')[0], activity: t.key ? (tx[t.key] ?? 1) : 1 }));

  const flux = (id: SegmentId, s: 'Na' | 'water' | 'K' | 'HCO3') => (ev.kidney.segments[id].in[s] - ev.kidney.segments[id].out[s]) * 1440;
  const fluxN = (id: SegmentId, s: 'Na' | 'water' | 'K' | 'HCO3') => (n.kidney.segments[id].in[s] - n.kidney.segments[id].out[s]) * 1440;
  const sev = steady.ev;

  return (
    <div>
      <PageHead path="/transport" lede="Pick a segment, see its apical and basolateral machinery and the force that drives each carrier, then click a carrier in the cell to switch it off. The whole nephron downstream — and, after days, the whole body — responds." />
      <Tabs tabs={SEGMENTS.map((id) => ({ id, label: SEGMENT_INFO[id].short }))} active={seg} onChange={setSeg} />
      <div class="grid grid-main-side">
        <div>
          <Panel title={`${info.name}: the cell`} note="Click a coloured carrier to switch it off (click again to restore). Arrow weight shows activity.">
            <CellDiagram apical={carriers('apical')} basolateral={carriers('basolateral')} paracellular={para.length ? para : undefined} />
            <div class="chips">
              {info.transporters
                .filter((t) => t.key)
                .map((t) => (
                  <button key={t.name} class={(tx[t.key!] ?? 1) < 0.5 ? '' : 'active'} onClick={() => toggle(t.key!)} style={{ fontSize: '0.78rem' }}>
                    {(tx[t.key!] ?? 1) < 0.5 ? '✕ ' : '✓ '}
                    {t.name}
                  </button>
                ))}
              {offKeys.length > 0 && (
                <button class="ghost" onClick={() => setTx({})}>
                  ↺ Restore all
                </button>
              )}
            </div>
          </Panel>
          <Panel title="Reference">
            <SegmentDetail info={info} />
          </Panel>
        </div>
        <div>
          <Panel title="Where the change lands">
            <NephronDiagram
              labels={false}
              vessels={false}
              selected={seg}
              onSelect={(id) => SEGMENTS.includes(id as SegmentId) && setSeg(id as SegmentId)}
              marks={Object.fromEntries(SEGMENTS.map((id) => [id, Math.abs(flux(id, 'Na') - fluxN(id, 'Na')) > 5 ? (flux(id, 'Na') > fluxN(id, 'Na') ? 'up' : 'down') : undefined]).filter(([, v]) => v))}
              height={320}
            />
            <p class="control-hint">Amber: segment reabsorbs more Na⁺ than normal (it is compensating). Blue: less.</p>
            <table>
              <thead>
                <tr>
                  <th>Segment</th>
                  <th class="num">Na⁺ reabsorbed</th>
                  <th class="num">Δ</th>
                </tr>
              </thead>
              <tbody>
                {SEGMENTS.map((id) => (
                  <tr key={id}>
                    <td>{SEGMENT_INFO[id].short}</td>
                    <td class="num">{flux(id, 'Na').toFixed(0)}</td>
                    <td class="num" style={{ color: flux(id, 'Na') - fluxN(id, 'Na') > 5 ? 'var(--high)' : flux(id, 'Na') - fluxN(id, 'Na') < -5 ? 'var(--low)' : undefined }}>
                      {(flux(id, 'Na') - fluxN(id, 'Na')).toFixed(0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p class="control-hint">mmol/day, first hours after the change.</p>
          </Panel>
          <Panel title="Urine now">
            <div class="readout-grid">
              <Readout label="Volume" value={ev.kidney.urine.volumePerDay} digits={2} unit="L/d" delta={ev.kidney.urine.volumePerDay - n.kidney.urine.volumePerDay} deltaDigits={2} />
              <Readout label="Na⁺" value={ev.kidney.urine.exc.Na} unit="mmol/d" delta={ev.kidney.urine.exc.Na - n.kidney.urine.exc.Na} />
              <Readout label="K⁺" value={ev.kidney.urine.exc.K} unit="mmol/d" delta={ev.kidney.urine.exc.K - n.kidney.urine.exc.K} />
              <Readout label="Osmolality" value={ev.kidney.urine.osm} unit="mOsm/kg" />
              <Readout label="pH" value={ev.kidney.urine.pH} digits={2} />
              <Readout label="Glucose" value={ev.kidney.urine.exc.glucose} digits={1} unit="g/d" />
            </div>
          </Panel>
          <Panel title="After the body re-balances" note="Steady state after weeks with the change in place.">
            {sev ? (
              <div class="readout-grid">
                <Readout label="Plasma Na⁺" value={sev.plasma.Na} unit="mmol/L" />
                <Readout label="Plasma K⁺" value={sev.plasma.K} digits={1} unit="mmol/L" tone={sev.plasma.K < 3.5 ? 'low' : sev.plasma.K > 5.2 ? 'high' : 'normal'} />
                <Readout label="HCO₃⁻" value={sev.body.hco3} unit="mmol/L" tone={sev.body.hco3 < 22 ? 'low' : sev.body.hco3 > 28 ? 'high' : 'normal'} />
                <Readout label="Renin" value={sev.reg.hormones.renin} digits={1} unit="×" />
                <Readout label="Aldosterone" value={sev.reg.hormones.aldo} digits={1} unit="×" />
                <Readout label="ECF volume" value={sev.plasma.ecf} digits={1} unit="L" />
              </div>
            ) : (
              <p class="faint">computing…</p>
            )}
          </Panel>
        </div>
      </div>
      <Panel title="How transport is powered, everywhere">
        <Chain
          steps={[
            { text: 'Basolateral Na⁺-K⁺-ATPase: the only major ATP-consuming step, 3 Na⁺ out for 2 K⁺ in' },
            { text: 'Cell Na⁺ low and cell interior negative (K⁺ leaks out through basolateral channels)' },
            { text: 'Apical carriers spend the Na⁺ gradient: SGLT, NaPi, NHE3 (PT); NKCC2 (TAL); NCC (DCT); ENaC channel (CD)' },
            { text: 'Coupled solutes move uphill (secondary active transport); exchangers move H⁺ or HCO₃⁻ the other way' },
            { text: 'Voltage from electrogenic steps drives paracellular ions: Cl⁻ in the late PT, Ca²⁺/Mg²⁺ in the TAL (lumen +), K⁺ secretion in the CD (lumen −)' },
            { text: 'Water follows solute only where aquaporins exist (PT, DTL, and CD with ADH)' },
          ]}
        />
        <Sources cite={{ rose: [1, 3, 4, 5], evidence: 'physiology' }} />
      </Panel>
      <Panel title="The five questions">
        <FiveQuestions
          normal={<p>Each segment has a characteristic apical entry step for Na⁺ and a shared basolateral exit (the pump).</p>}
          why={<p>Secondary active transport lets one pump power dozens of carriers; segment identity comes from which apical carriers, channels and aquaporins it expresses.</p>}
          change={<p>Switch off an upstream carrier and downstream segments take more of the load (their share is load-dependent) — but their capacity is limited, so the rest reaches the urine.</p>}
          abnormal={<p>Each inherited tubulopathy is one carrier switched off (or on): Fanconi, Bartter, Gitelman, Liddle, pseudohypoaldosteronism, distal RTA, nephrogenic DI.</p>}
          clinical={<p>Every diuretic class is a transporter blocker; their effects on K⁺, Ca²⁺, Mg²⁺ and acid–base follow from which carrier they block and what happens downstream.</p>}
        />
      </Panel>
      <Related paths={['/break', '/inherited', '/diuretics', '/nephron']} />
    </div>
  );
}
