import type { SegmentInfo } from '../content/segments';
import { Sources } from './kit';

/** Full reference panel for one nephron segment (used by the explorer and transport lab). */
export function SegmentDetail({ info, compact }: { info: SegmentInfo; compact?: boolean }) {
  const byMembrane = (m: string) => info.transporters.filter((t) => t.membrane === m);
  return (
    <div class="seg-detail">
      <p class="muted">{info.tagline}</p>
      <h4>Handles</h4>
      <ul>
        {info.handles.map((h) => (
          <li key={h}>{h}</li>
        ))}
      </ul>
      <div class="grid grid-2">
        <div>
          <h4>Water permeability</h4>
          <p>{info.waterPermeability}</p>
        </div>
        <div>
          <h4>Luminal fluid</h4>
          <p>{info.luminalComposition}</p>
        </div>
      </div>
      <h4>Driving force</h4>
      <p>{info.drivingForce}</p>
      {!compact &&
        (['apical', 'basolateral', 'paracellular'] as const).map((m) =>
          byMembrane(m).length ? (
            <div key={m}>
              <h4>{m === 'apical' ? 'Apical (luminal) membrane' : m === 'basolateral' ? 'Basolateral membrane' : 'Paracellular pathway'}</h4>
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Transporter</th>
                      <th>Moves</th>
                      <th>Driving force</th>
                      <th>Acted on by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byMembrane(m).map((t) => (
                      <tr key={t.name}>
                        <td>
                          <strong>{t.name}</strong>
                          <div class="faint" style={{ fontSize: '0.75rem' }}>
                            {t.kind}
                          </div>
                        </td>
                        <td>{t.moves}</td>
                        <td>
                          {t.driving}
                          {t.note && <div class="faint" style={{ fontSize: '0.78rem', marginTop: 3 }}>{t.note}</div>}
                        </td>
                        <td>{(t.targets ?? []).join(', ') || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null,
        )}
      <div class="grid grid-3">
        <div>
          <h4>Hormones</h4>
          <ul>{info.hormones.length ? info.hormones.map((h) => <li key={h}>{h}</li>) : <li class="faint">None of note</li>}</ul>
        </div>
        <div>
          <h4>Diuretics acting here</h4>
          <ul>{info.diuretics.length ? info.diuretics.map((h) => <li key={h}>{h}</li>) : <li class="faint">None</li>}</ul>
        </div>
        <div>
          <h4>Disorders</h4>
          <ul>{info.disorders.length ? info.disorders.map((h) => <li key={h}>{h}</li>) : <li class="faint">—</li>}</ul>
        </div>
      </div>
      <h4>Clinical relevance</h4>
      <ul>
        {info.clinical.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <Sources cite={info.cite} />
    </div>
  );
}
