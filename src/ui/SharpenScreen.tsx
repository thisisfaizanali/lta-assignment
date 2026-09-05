/**
 * Transcribed from Sharpen.dc.html: ranked optional questions, each showing
 * what it actually moves for THIS borrower (computed by questions.ts's
 * applicableOptionalQuestions, never authored copy).
 *
 * One design/engine mismatch, found here: the mockup illustrates a "has a
 * lender quoted you a rate already" question as one of its four examples.
 * M4 deliberately does not implement that as a question — there is no
 * Answers field or engine consumer for it at all (RULES.md §10.2 says it
 * only affects the Card's gap line, which the M3 engine has no hook for).
 * It cannot appear here, because it provably moves nothing — exactly the
 * rule this screen exists to enforce.
 */
import { useMemo, useState } from 'react';
import { runEngine } from '../rules/engine';
import { applicableOptionalQuestions, type ImpactedOutput } from '../rules/questions';
import type { Answers } from '../rules/types';
import { QuestionCard } from './QuestionCard';
import { formatINR } from './format';

const OUTPUT_LABEL: Record<ImpactedOutput['output'], string> = {
  verdict: 'the verdict',
  product: 'the product routed',
  lenderMax: 'lender max',
  safeMax: 'safe to carry',
  rateBand: 'fair rate',
  aprBand: 'all-in APR',
  emiCeiling: 'EMI ceiling',
};

function describeImpact(a: ImpactedOutput): string {
  if (a.output === 'verdict' || a.output === 'product') return `changes ${OUTPUT_LABEL[a.output]}`;
  const isMoney = a.output === 'lenderMax' || a.output === 'safeMax' || a.output === 'emiCeiling';
  return `${OUTPUT_LABEL[a.output]} ±${isMoney ? formatINR(a.magnitude) : `${a.magnitude.toFixed(1)}pp`}`;
}

interface SharpenScreenProps {
  answers: Answers;
  onAnswer: (patch: Partial<Answers>) => void;
  onFinish: () => void;
}

export function SharpenScreen({ answers, onAnswer, onFinish }: SharpenScreenProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const outputs = useMemo(() => runEngine(answers), [answers]);
  const ranked = useMemo(() => applicableOptionalQuestions(answers), [answers]);
  const active = ranked.find((r) => r.question.id === activeId)?.question;

  if (active) {
    return (
      <div className="question-flow">
        <div className="question-flow-header">
          <div className="eyebrow">Sharpening your estimate</div>
        </div>
        <div style={{ height: 1, background: 'var(--ink)' }} />
        <div style={{ padding: '40px 24px', maxWidth: 520 }}>
          <QuestionCard
            key={active.id}
            question={active}
            answers={answers}
            onAnswer={(patch) => {
              onAnswer(patch);
              setActiveId(null);
            }}
            onSkip={() => setActiveId(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="sharpen-screen">
      <div className="sharpen-header">
        <div className="eyebrow" style={{ borderBottom: '1px solid var(--ink)', paddingBottom: 14 }}>
          Key fact statement · self-assessed
        </div>
      </div>

      <div className="sharpen-intro">
        <div className="sharpen-copy">
          <div className="cond" style={{ fontSize: 34, maxWidth: '19ch' }}>
            {ranked.length === 0 ? 'Your statement is as tight as your answers allow.' : 'Your statement is usable. It is not yet tight.'}
          </div>
          <div style={{ fontSize: 16, lineHeight: 1.5, maxWidth: '52ch' }}>
            {ranked.length === 0
              ? 'Nothing left would change a number — everything worth asking has been asked.'
              : 'Each question below states exactly what it moves, before you answer. Anything that would not change a number is not on this list.'}
          </div>
        </div>
        <div className="sharpen-current">
          <SummaryRow label="Safe to carry, today" value={`${formatINR(outputs.safeMax.value.lo)} – ${formatINR(outputs.safeMax.value.hi)}`} color="var(--green)" />
          <SummaryRow label="Fair rate, today" value={`${outputs.rateBand.value.lo.toFixed(1)}% – ${outputs.rateBand.value.hi.toFixed(1)}%`} />
        </div>
      </div>

      {ranked.length > 0 && (
        <div className="sharpen-list">
          <div style={{ height: 1, background: 'var(--ink)' }} />
          {ranked.map(({ question, impact }) => (
            <div className="sharpen-row" key={question.id}>
              <div>
                <div style={{ fontSize: 16.5, fontWeight: 600 }}>{question.prompt}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>{question.why}</div>
              </div>
              <div className="mono" style={{ fontSize: 12.5, lineHeight: 1.7, color: 'var(--ink)' }}>
                {impact.affects.map((a) => describeImpact(a)).join(' · ')}
              </div>
              <button type="button" className="btn-text sharpen-answer" onClick={() => setActiveId(question.id)}>
                Answer
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="sharpen-footer">
        <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: '56ch', lineHeight: 1.5 }}>
          Every optional question not shown here was considered and dropped: for your answers so far, none of them
          would move any of the four numbers.
        </div>
        <button type="button" className="btn-primary" onClick={onFinish}>
          See my statement
        </button>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <div style={{ fontSize: 13, color: 'var(--muted)' }}>{label}</div>
      <div className="mono" style={{ fontSize: 16, color }}>
        {value}
      </div>
    </div>
  );
}
