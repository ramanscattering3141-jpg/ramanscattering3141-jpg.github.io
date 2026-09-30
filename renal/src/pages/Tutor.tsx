import { useMemo, useState } from 'preact/hooks';
import { PageHead, Related } from '../ui/page';
import { Panel } from '../ui/kit';
import { search } from '../content/search';
import { href } from '../router';

// A source-aware tutor: it answers only from the knowledge base — the module content, the concept
// notes and the equations — and always shows where the answer comes from. It never invents; if the
// base has nothing, it says so. There is no external model here, so nothing can drift from Rose.

const SUGGESTED = [
  'Why does the anion gap rise in lactic acidosis?',
  'How does a loop diuretic cause hypokalaemia?',
  'What keeps the sodium normal in SIADH from getting worse?',
  'Why does phosphate rise only in advanced CKD?',
  'How does pressure natriuresis cause aldosterone escape?',
  'Why is the urine chloride low in vomiting?',
];

const KIND_LABEL: Record<string, string> = { module: 'Module', node: 'Concept', equation: 'Equation', concept: 'Concept', segment: 'Nephron segment' };

export default function Tutor({ query }: { query: URLSearchParams }) {
  const [q, setQ] = useState(query.get('q') ?? '');
  const hits = useMemo(() => (q.trim().length >= 3 ? search(q, 8) : []), [q]);
  const top = hits[0];

  return (
    <div>
      <PageHead
        path="/tutor"
        lede="Ask a question and the tutor answers from the lab's own pages — the physiology, the concepts, the equations — and shows you exactly which one, so you can read the full explanation there. It draws only on what is written here, faithfully to Rose; it does not guess, and when the answer is not in the base it tells you."
      />
      <Panel title="Ask">
        <input
          type="search"
          value={q}
          placeholder="Ask about the kidney — a mechanism, a disorder, an equation…"
          onInput={(e) => setQ((e.target as HTMLInputElement).value)}
          style={{ width: '100%', fontSize: '1rem' }}
          autofocus
        />
        {q.trim().length < 3 && (
          <div style={{ marginTop: 12 }}>
            <p class="control-hint" style={{ marginBottom: 6 }}>Try one of these:</p>
            <div class="chips">
              {SUGGESTED.map((s) => (
                <button key={s} class="tag" style={{ cursor: 'pointer' }} onClick={() => setQ(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}
      </Panel>

      {q.trim().length >= 3 && top && (
        <Panel title="The most relevant answer" note={`${KIND_LABEL[top.doc.kind] ?? 'Source'}: ${top.doc.title}`}>
          <p style={{ lineHeight: 1.7 }}>{top.doc.text.slice(0, 600)}{top.doc.text.length > 600 ? '…' : ''}</p>
          {top.doc.route && (
            <a class="tag" href={href(top.doc.route)}>Read it in full: {top.doc.title} →</a>
          )}
        </Panel>
      )}

      {q.trim().length >= 3 && hits.length > 1 && (
        <Panel title="Other places this is covered">
          <div class="grid grid-2">
            {hits.slice(1).map((h) => (
              <a key={h.doc.id} class="card-link" href={h.doc.route ? href(h.doc.route) : '#'}>
                <h4>{h.doc.title}</h4>
                <p>{h.doc.text.slice(0, 140)}{h.doc.text.length > 140 ? '…' : ''}</p>
              </a>
            ))}
          </div>
        </Panel>
      )}

      {q.trim().length >= 3 && hits.length === 0 && (
        <Panel title="Not in the knowledge base">
          <p class="muted" style={{ marginBottom: 0 }}>
            Nothing here matches “{q}”. Try naming the physiology directly — a transporter, a hormone, an ion, a disorder — or browse the <a href={href('/graph')}>knowledge map</a>. The tutor only answers from what the lab covers, and will not fill the gap with a guess.
          </p>
        </Panel>
      )}

      <Panel title="How the tutor works" id="how">
        <p class="muted" style={{ marginBottom: 0, lineHeight: 1.7 }}>
          This is a retrieval tutor, not a generative one: it ranks the lab's pages against your question and hands you the best-matching passage with a link to the whole thing. That is deliberate — every answer is traceable to a page built on Rose, so nothing is invented and nothing drifts. For an open-ended tutorial, work through the <a href={href('/lessons')}>guided lessons</a> or test yourself on the <a href={href('/challenges')}>challenges</a>.
        </p>
      </Panel>
      <Related paths={['/lessons', '/challenges', '/cases', '/textbook', '/equations']} />
    </div>
  );
}
