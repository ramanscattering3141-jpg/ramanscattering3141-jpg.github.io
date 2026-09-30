import { useMemo, useState } from 'preact/hooks';
import { PageHead, Related } from '../ui/page';
import { Panel, Readout, Sources } from '../ui/kit';
import { NephronDiagram, type StructureId } from '../ui/NephronDiagram';
import { SegmentDetail } from '../ui/SegmentDetail';
import { SEGMENT_INFO, STRUCTURES } from '../content/segments';
import { SEGMENTS, type SegmentId } from '../engine/types';
import { NORMAL } from '../sim/hooks';
import { href } from '../router';

const STRUCT_MAP: Partial<Record<StructureId, string>> = {
  renalArtery: 'renalArtery',
  afferent: 'afferent',
  glomerulus: 'glomerulus',
  bowman: 'bowman',
  efferent: 'efferent',
  peritubular: 'peritubular',
  vasaRecta: 'vasaRecta',
  maculaDensa: 'maculaDensa',
  jgCells: 'jgCells',
  mesangium: 'mesangium',
  renalVein: 'renalVein',
};

export default function NephronExplorer({ query }: { query: URLSearchParams }) {
  const [sel, setSel] = useState<StructureId>((query.get('s') as StructureId) || 'PT');
  const ev = NORMAL();
  const seg = SEGMENTS.includes(sel as SegmentId) ? (sel as SegmentId) : null;
  const struct = !seg ? STRUCTURES.find((s) => s.id === STRUCT_MAP[sel]) : null;
  const filtered = ev.kidney.segments.PT.in;
  const notes = useMemo(() => {
    const o: Partial<Record<StructureId, string>> = {};
    for (const id of SEGMENTS) {
      const out = ev.kidney.segments[id].out;
      o[id] = `${((out.water / filtered.water) * 100).toFixed(out.water / filtered.water < 0.05 ? 1 : 0)}% H₂O · ${Math.round(ev.kidney.segments[id].osmOut)}`;
    }
    return o;
  }, []);

  return (
    <div>
      <PageHead path="/nephron" lede="A juxtamedullary nephron with its blood supply. Click any segment, vessel or cell group. Numbers beside each segment show the share of filtered water still in the tubule as fluid leaves it, and its osmolality (mOsm/kg), in a normally hydrated adult." />
      <div class="grid grid-main-side" style={{ '--main-side': 'minmax(0, 1.3fr) minmax(0, 1fr)' }}>
        <div class="sticky-figure">
        <Panel>
          <NephronDiagram selected={sel} onSelect={setSel} notes={notes} medullaOsm={ev.kidney.medullaTarget} height="calc(100vh - 150px)" />
          <div class="chips">
            {[...SEGMENTS, 'glomerulus', 'bowman', 'afferent', 'efferent', 'maculaDensa', 'jgCells', 'mesangium', 'peritubular', 'vasaRecta', 'renalArtery', 'renalVein'].map((id) => (
              <button key={id} class={sel === id ? 'active' : ''} style={{ fontSize: '0.75rem', padding: '2px 8px' }} onClick={() => setSel(id as StructureId)}>
                {SEGMENTS.includes(id as SegmentId) ? SEGMENT_INFO[id as SegmentId].short : STRUCTURES.find((s) => s.id === STRUCT_MAP[id as StructureId])?.name ?? id}
              </button>
            ))}
          </div>
        </Panel>
        </div>
        <div>
          {seg && (
            <Panel title={SEGMENT_INFO[seg].name} actions={<a href={href('/transport', { s: seg })}>Open in transport lab →</a>}>
              <div class="readout-grid" style={{ marginBottom: 10 }}>
                <Readout label="Na⁺ reabsorbed here" value={((ev.kidney.segments[seg].in.Na - ev.kidney.segments[seg].out.Na) / filtered.Na) * 100} digits={1} unit="% filtered" />
                <Readout label="Water reabsorbed here" value={((ev.kidney.segments[seg].in.water - ev.kidney.segments[seg].out.water) / filtered.water) * 100} digits={1} unit="% filtered" />
                <Readout label="Fluid leaving" value={ev.kidney.segments[seg].osmOut} unit="mOsm/kg" />
                <Readout label="K⁺ leaving" value={(ev.kidney.segments[seg].out.K / filtered.K) * 100} digits={0} unit="% filtered" />
              </div>
              <SegmentDetail info={SEGMENT_INFO[seg]} />
            </Panel>
          )}
          {struct && (
            <Panel title={struct.name}>
              <p class="muted">{struct.tagline}</p>
              <ul>
                {struct.detail.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
              {sel === 'glomerulus' || sel === 'bowman' ? (
                <div class="readout-grid">
                  <Readout label="GFR" value={ev.kidney.GFR} unit="mL/min" />
                  <Readout label="Pgc" value={ev.kidney.Pgc} digits={0} unit="mmHg" />
                  <Readout label="Filtration fraction" value={ev.kidney.FF * 100} digits={0} unit="%" />
                </div>
              ) : null}
              {sel === 'afferent' || sel === 'efferent' ? (
                <p>
                  <a href={href('/arterioles')}>Constrict or dilate it in the afferent/efferent lab →</a>
                </p>
              ) : null}
              {sel === 'maculaDensa' || sel === 'jgCells' ? (
                <p>
                  <a href={href('/raas')}>Follow the renin cascade →</a> · <a href={href('/autoregulation')}>Tubuloglomerular feedback →</a>
                </p>
              ) : null}
              {sel === 'vasaRecta' ? (
                <p>
                  <a href={href('/vasa-recta')}>Countercurrent exchange →</a>
                </p>
              ) : null}
              <Sources cite={struct.cite} />
            </Panel>
          )}
        </div>
      </div>
      <Related paths={['/flow', '/transport', '/gfr', '/countercurrent']} />
    </div>
  );
}
