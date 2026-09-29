// Interactive textbook mode: the book's organisation, rebuilt chapter by chapter as
// explanation → diagram/simulation → clinical connection → pathology → equations → questions → sources.

import { CHAPTERS, chapterByN } from '../content/chapters';
import { ROSE_CHAPTERS, ROSE, ref, formatRef, refUrl } from '../content/sources';
import { routeByPath, routesForChapter } from '../routes';
import { href } from '../router';
import { Chain, Panel, Sources } from '../ui/kit';
import { EquationCard } from '../ui/EquationCard';
import { Quiz } from '../ui/Quiz';
import { Related } from '../ui/page';
import type { Citation } from '../content/sources';

export default function Textbook({ query }: { query: URLSearchParams }) {
  const n = parseInt(query.get('ch') ?? '', 10);
  const ch = Number.isFinite(n) ? chapterByN(n) : undefined;
  if (Number.isFinite(n) && !ch) return <Missing n={n} />;
  return ch ? <ChapterView n={n} /> : <Contents />;
}

function Contents() {
  const parts = Array.from(new Set(ROSE_CHAPTERS.map((c) => c.part)));
  return (
    <div>
      <header class="page-head">
        <div class="eyebrow">Interactive textbook</div>
        <h1>
          {ROSE.title}, {ROSE.edition}
        </h1>
        <p class="lede">
          {ROSE.authors} ({ROSE.publisher}, {ROSE.year}) is the conceptual spine of this laboratory. Each chapter here is an original re-expression of its ideas — not the book’s text — organised
          so you can move from reading to visualising, manipulating, applying and testing. Where later evidence has changed the picture, the update is marked and sourced.
        </p>
      </header>
      {parts.map((part) => (
        <Panel key={part} title={part}>
          <div class="toc">
            {ROSE_CHAPTERS.filter((c) => c.part === part).map((c) => {
              const content = chapterByN(c.n);
              const mods = routesForChapter(c.n);
              return (
                <a key={c.n} class="toc-row" href={href('/textbook', { ch: String(c.n) })}>
                  <span class="n">{c.n}</span>
                  <span class="t">
                    <strong>{c.title}</strong>
                    {content && <span class="muted">{content.thesis.split('. ')[0]}.</span>}
                  </span>
                  <span class="m">{mods.length ? `${mods.length} simulator${mods.length > 1 ? 's' : ''}` : ''}</span>
                </a>
              );
            })}
          </div>
        </Panel>
      ))}
      <p class="faint" style={{ fontSize: '0.8rem' }}>
        {CHAPTERS.length} of {ROSE_CHAPTERS.length} chapters have an interactive rebuild.
      </p>
    </div>
  );
}

function Missing({ n }: { n: number }) {
  const meta = ROSE_CHAPTERS.find((c) => c.n === n);
  return (
    <div class="page-head">
      <div class="eyebrow">Chapter {n}</div>
      <h1>{meta?.title ?? 'Unknown chapter'}</h1>
      <p class="lede">This chapter does not have an interactive rebuild. Its simulators are listed below.</p>
      <Related paths={routesForChapter(n).map((r) => r.path)} />
      <a href={href('/textbook')}>← All chapters</a>
    </div>
  );
}

function ChapterView({ n }: { n: number }) {
  const ch = chapterByN(n)!;
  const meta = ROSE_CHAPTERS.find((c) => c.n === n);
  const prev = ROSE_CHAPTERS.find((c) => c.n === n - 1);
  const next = ROSE_CHAPTERS.find((c) => c.n === n + 1);
  const modules = Array.from(new Set([...routesForChapter(n).map((r) => r.path), ...(ch.modules ?? []), ...ch.concepts.map((c) => c.route).filter(Boolean)])) as string[];

  // Gather every external reference cited anywhere in the chapter.
  const cites: Citation[] = [...ch.concepts.map((c) => c.cite), ...(ch.updates ?? []).map((u) => u.cite)].filter(Boolean) as Citation[];
  const refIds = Array.from(new Set(cites.flatMap((c) => c.refs ?? [])));

  return (
    <div class="chapter">
      <header class="page-head">
        <div class="eyebrow">
          <a href={href('/textbook')}>Interactive textbook</a> · {meta?.part} · Chapter {n}
        </div>
        <h1>{ch.title}</h1>
        <p class="lede">{ch.thesis}</p>
        <nav class="chapter-steps" aria-label="Sections">
          <a href="#explain">1 Explain</a>
          <a href="#simulate">2 Simulate</a>
          <a href="#clinical">3 Clinical</a>
          <a href="#pathology">4 Pathology</a>
          {ch.equations?.length ? <a href="#equations">5 Equations</a> : null}
          <a href="#questions">6 Questions</a>
          <a href="#sources">7 Sources</a>
        </nav>
      </header>

      <section id="explain">
        {ch.concepts.map((c, i) => (
          <Panel key={i} title={c.heading}>
            <div class={c.chain ? 'grid grid-main-side' : ''}>
              <div>
                {c.body.map((p, j) => (
                  <p key={j}>{p}</p>
                ))}
                {c.points && (
                  <ul class="points">
                    {c.points.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                )}
              </div>
              {c.chain && (
                <div class="chain-box">
                  <h4>Causal chain</h4>
                  <Chain steps={c.chain.map((t) => ({ text: t }))} />
                </div>
              )}
            </div>
            {c.equation && <EquationCard eq={c.equation} compact />}
            <div class="concept-foot">
              <Sources cite={c.cite ?? { rose: [n], evidence: 'physiology' }} />
              {c.route && routeByPath.get(c.route) && (
                <a class="btn primary-link" href={href(c.route)}>
                  Manipulate this: {routeByPath.get(c.route)!.title} →
                </a>
              )}
            </div>
          </Panel>
        ))}
      </section>

      {ch.numbers?.length ? (
        <Panel title="Numbers worth knowing">
          <div class="table-wrap">
            <table>
              <tbody>
                {ch.numbers.map((k) => (
                  <tr key={k.label}>
                    <td>{k.label}</td>
                    <td class="mono">{k.value}</td>
                    <td class="muted">{k.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      <section id="simulate">
        <Related title="Simulate it" paths={modules} />
      </section>

      <div class="grid grid-2" style={{ marginTop: 16 }}>
        <section id="clinical">
          <Panel title="Clinical connection">
            <ul>
              {ch.clinical.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </Panel>
        </section>
        <section id="pathology">
          <Panel title="When the physiology fails">
            {ch.pathology.map((p) => (
              <div key={p.name} class="patho">
                <strong>{p.name}</strong>
                <div class="patho-row">
                  <span class="badge reasoning">broken</span> {p.broken}
                </div>
                <div class="patho-row">
                  <span class="badge physiology">so</span> {p.consequence}
                </div>
                {p.route && (
                  <a href={href(p.route)} style={{ fontSize: '0.82rem' }}>
                    Model it →
                  </a>
                )}
              </div>
            ))}
          </Panel>
        </section>
      </div>

      {ch.equations?.length ? (
        <section id="equations">
          <h2>Key equations</h2>
          <div class="grid grid-2">
            {ch.equations.map((id) => (
              <EquationCard key={id} eq={id} />
            ))}
          </div>
        </section>
      ) : null}

      {ch.updates?.length ? (
        <Panel title="Since this edition">
          {ch.updates.map((u) => (
            <div key={u.topic} class="note update">
              <strong>{u.topic}.</strong> {u.text}
              <Sources cite={u.cite} inline />
            </div>
          ))}
        </Panel>
      ) : null}

      <section id="questions">
        <Panel title="Test your understanding" note="Answer first; the explanation appears after you commit.">
          <Quiz questions={ch.questions} />
        </Panel>
      </section>

      <section id="sources">
        <Panel title="Sources">
          <p>
            <strong>Primary conceptual source:</strong> {ROSE.authors}. <em>{ROSE.title}</em>, {ROSE.edition}. {ROSE.publisher}; {ROSE.year}. Chapter {n}: {meta?.title}. The explanations on
            this page are original summaries of the chapter’s concepts.
          </p>
          {refIds.length > 0 && (
            <>
              <h4>External references cited on this page</h4>
              <ol style={{ fontSize: '0.85rem' }}>
                {refIds.map((id) => {
                  const r = ref(id);
                  return r ? (
                    <li key={id}>
                      {formatRef(r)}{' '}
                      <a href={refUrl(r)} target="_blank" rel="noreferrer noopener">
                        {r.doi ? 'DOI' : 'PubMed'}
                      </a>
                    </li>
                  ) : null;
                })}
              </ol>
            </>
          )}
        </Panel>
      </section>

      <div class="btn-row" style={{ justifyContent: 'space-between' }}>
        {prev ? <a class="btn" href={href('/textbook', { ch: String(prev.n) })}>← Ch. {prev.n}: {prev.title}</a> : <span />}
        {next && next.n <= 30 ? <a class="btn" href={href('/textbook', { ch: String(next.n) })}>Ch. {next.n}: {next.title} →</a> : <span />}
      </div>
    </div>
  );
}
