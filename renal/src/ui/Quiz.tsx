import { useState } from 'preact/hooks';
import type { Question } from '../content/chapters/types';
import { href } from '../router';

export function QuestionCard({ q, n }: { q: Question; n?: number }) {
  const [picked, setPicked] = useState<number | null>(null);
  const right = picked === q.answer;
  return (
    <div class="question">
      <p>
        {n !== undefined && <span class="q-n">Q{n}</span>} {q.q}
      </p>
      <div class="q-options">
        {q.options.map((o, i) => (
          <button
            key={i}
            class={`q-opt ${picked === null ? '' : i === q.answer ? 'correct' : picked === i ? 'wrong' : 'faded'}`}
            onClick={() => picked === null && setPicked(i)}
            disabled={picked !== null && i !== q.answer && picked !== i}
          >
            <span class="q-letter">{String.fromCharCode(65 + i)}</span> {o}
          </button>
        ))}
      </div>
      {picked !== null && (
        <div class={`note ${right ? '' : 'caution'}`} style={{ marginTop: 8 }}>
          <strong>{right ? 'Correct.' : `Not quite — the answer is ${String.fromCharCode(65 + q.answer)}.`}</strong> {q.explanation}
          {q.route && (
            <>
              {' '}
              <a href={href(q.route)}>Test it in the simulator →</a>
            </>
          )}
          <div>
            <button class="ghost" style={{ marginTop: 6, fontSize: '0.78rem' }} onClick={() => setPicked(null)}>
              Try again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Quiz({ questions }: { questions: Question[] }) {
  return (
    <div>
      {questions.map((q, i) => (
        <QuestionCard key={q.q} q={q} n={i + 1} />
      ))}
    </div>
  );
}
