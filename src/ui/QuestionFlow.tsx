/**
 * Steps through the must-set, then hands off to the caller once complete.
 * Transcribed from Question.dc.html / Branch.dc.html: progress dots, section
 * label, question + input on the left, the live rail on the right once
 * hasBaseline() is true.
 *
 * One honest deviation from the original design note ("live from question
 * 3"): the M3 engine needs five specific fields before it can compute
 * anything (purpose, askAmount, netMonthlyIncome, incomeType, rent) — those
 * don't finish landing until question 6 in RULES.md's own §10.1 order
 * (existingEmiMonthly, must-question 5, comes before rent, must-question 6).
 * The rail activates as soon as the engine genuinely can run, which is a
 * question later than the original illustrative mockup — not sooner, since
 * doing so would mean showing numbers computed from an incomplete Answers
 * object the engine was never designed to accept.
 */
import { useMemo, useState } from 'react';
import { runEngine } from '../rules/engine';
import { HARD_REQUIRED, MUST_QUESTIONS, hasBaseline, nextMustQuestions } from '../rules/questions';
import type { Answers } from '../rules/types';
import { LiveRail } from './LiveRail';
import { QuestionCard } from './QuestionCard';

const SECTION: Record<string, string> = {
  askAmount: '01 · The ask',
  netMonthlyIncome: '02 · Income',
  incomeType: '02 · Income',
  existingEmiMonthly: '03 · Obligations',
  rent: '03 · Obligations',
  householdExpenses: '03 · Obligations',
  age: '04 · Profile',
  creditScore: '04 · Profile',
  dependents: '04 · Profile',
};

interface QuestionFlowProps {
  answers: Partial<Answers>;
  setAnswers: (updater: (prev: Partial<Answers>) => Partial<Answers>) => void;
  onMustSetDone: () => void;
}

export function QuestionFlow({ answers, setAnswers, onMustSetDone }: QuestionFlowProps) {
  const [prevUnresolvedCount, setPrevUnresolvedCount] = useState<number | undefined>(undefined);
  // Skipped is tracked here, NOT in answers — a skip must leave the field
  // genuinely undefined so the engine's own UNKNOWNS resolution applies,
  // never a fake stand-in value. This only tracks "don't show it again."
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());

  const remaining = nextMustQuestions(answers).filter((q) => !skipped.has(q.id));
  const current = remaining[0];
  const answeredCount = MUST_QUESTIONS.length - remaining.length;

  const outputs = useMemo(() => (hasBaseline(answers) ? runEngine(answers) : undefined), [answers]);

  if (!current) {
    onMustSetDone();
    return null;
  }

  function advance(patch: Partial<Answers>) {
    setAnswers((prev) => {
      const next = { ...prev, ...patch };
      if (hasBaseline(prev)) setPrevUnresolvedCount(runEngine(prev).unresolvedInputs.length);
      return next;
    });
  }

  return (
    <div className="question-flow">
      <div className="question-flow-header">
        <div className="eyebrow">Key fact statement · self-assessed</div>
        <div className="eyebrow mono">
          Question {answeredCount + 1} of {MUST_QUESTIONS.length}
        </div>
      </div>
      <div className="progress-dots" style={{ gridTemplateColumns: `repeat(${MUST_QUESTIONS.length}, minmax(0, 1fr))` }}>
        {MUST_QUESTIONS.map((q, i) => (
          <div key={q.id} style={{ height: 2, background: i <= answeredCount ? 'var(--ink)' : 'var(--rule)' }} />
        ))}
      </div>
      <div style={{ height: 1, background: 'var(--ink)' }} />

      <div className="question-flow-body">
        <div className="question-flow-left">
          <div className="eyebrow mono" style={{ color: 'var(--ink)' }}>
            {SECTION[current.id] ?? ''}
          </div>
          <QuestionCard
            key={current.id}
            question={current}
            answers={answers}
            onAnswer={advance}
            skippable={!HARD_REQUIRED.includes(current.id)}
            onSkip={() => {
              if (hasBaseline(answers)) setPrevUnresolvedCount(runEngine(answers).unresolvedInputs.length);
              setSkipped((prev) => new Set(prev).add(current.id));
            }}
          />
        </div>

        <div className="question-flow-right">
          {outputs ? (
            <LiveRail
              outputs={outputs}
              askAmount={answers.askAmount ?? 0}
              answeredCount={answeredCount}
              totalCount={MUST_QUESTIONS.length}
              previousUnresolvedCount={prevUnresolvedCount}
            />
          ) : (
            <div style={{ color: 'var(--muted)', fontSize: 13, paddingTop: 26 }}>
              Your estimate appears once the ask, income, income type and rent are answered.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
