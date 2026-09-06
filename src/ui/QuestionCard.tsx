/**
 * Renders one question with the control appropriate to its input kind.
 * Transcribed from Question.dc.html / Branch.dc.html's field patterns.
 */
import { useState } from 'react';
import type { Purpose, ScoreAnswer } from '../rules/constants';
import type { Question } from '../rules/questions';
import type { Answers } from '../rules/types';
import { INCOME_TYPE_LABELS, INPUT_KIND, PURPOSE_LABELS, percentScaleFor } from './inputKinds';

interface QuestionCardProps {
  question: Question;
  answers: Partial<Answers>;
  onAnswer: (patch: Partial<Answers>) => void;
  onSkip: () => void;
  onBack?: () => void;
  /** The five fields the engine cannot run at all without — skip isn't offered on these. */
  skippable?: boolean;
}

export function QuestionCard({ question, answers, onAnswer, onSkip, onBack, skippable = true }: QuestionCardProps) {
  const kind = INPUT_KIND[question.id] ?? 'number';
  const current = answers[question.id];
  // Stored 0.2 has to read back as "20" in a field suffixed with %, or editing an
  // existing answer would divide it a second time.
  const scale = percentScaleFor(question.id);
  const [draft, setDraft] = useState<string>(
    current !== undefined && typeof current !== 'object'
      ? String(typeof current === 'number' ? current * scale : current)
      : '',
  );

  function submitNumeric() {
    const n = Number(draft);
    if (draft.trim() !== '' && !Number.isNaN(n)) {
      onAnswer({ [question.id]: n / scale } as Partial<Answers>);
    } else {
      onSkip();
    }
  }

  return (
    <div className="question-card">
      <div className="cond" style={{ fontSize: 32, maxWidth: '20ch' }}>
        {question.prompt}
      </div>
      <div style={{ fontSize: 14, color: 'var(--muted)', maxWidth: '48ch' }}>{question.why}</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420 }}>
        {kind === 'purpose' && (
          <ChoiceGrid
            options={Object.keys(PURPOSE_LABELS)}
            labels={PURPOSE_LABELS}
            value={current as string | undefined}
            onSelect={(v) => onAnswer({ purpose: v as Purpose })}
          />
        )}

        {kind === 'incomeType' && (
          <ChoiceGrid
            options={['salaried', 'self_employed', 'gig', 'informal']}
            labels={INCOME_TYPE_LABELS}
            value={current as string | undefined}
            onSelect={(v) => onAnswer({ incomeType: v as Answers['incomeType'] })}
          />
        )}

        {kind === 'collateralType' && (
          <ChoiceGrid
            options={['property', 'gold']}
            labels={{ property: 'Property', gold: 'Gold' }}
            value={current as string | undefined}
            onSelect={(v) => onAnswer({ collateralType: v as Answers['collateralType'] })}
          />
        )}

        {kind === 'boolean' && (
          <ChoiceGrid
            options={['yes', 'no']}
            labels={{ yes: 'Yes', no: 'No' }}
            value={current === undefined ? undefined : current ? 'yes' : 'no'}
            onSelect={(v) => onAnswer({ [question.id]: v === 'yes' } as Partial<Answers>)}
          />
        )}

        {kind === 'creditScore' && (
          <CreditScoreInput
            value={current as ScoreAnswer | undefined}
            onAnswer={(v) => onAnswer({ creditScore: v })}
          />
        )}

        {(kind === 'money' || kind === 'number' || kind === 'percent') && (
          <div style={{ display: 'flex', gap: 12 }}>
            <div className="field">
              {kind === 'money' && (
                <span className="mono" style={{ color: 'var(--muted)', fontSize: 15 }}>
                  ₹
                </span>
              )}
              <input
                inputMode="decimal"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitNumeric()}
                aria-label={question.prompt}
                autoFocus
              />
              {kind === 'percent' && (
                <span className="mono" style={{ color: 'var(--muted)', fontSize: 15 }}>
                  %
                </span>
              )}
            </div>
            <button type="button" className="btn-primary" onClick={() => submitNumeric()}>
              Next
            </button>
          </div>
        )}

        {question.id === 'cashMonthlyIncomeBad' && (
          <GoodMonthAside value={answers.cashMonthlyIncomeGood} onAnswer={(v) => onAnswer({ cashMonthlyIncomeGood: v })} />
        )}
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 22, paddingTop: 24 }}>
        {onBack && (
          <button type="button" className="btn-text" onClick={onBack}>
            Back
          </button>
        )}
        {skippable && (
          <button type="button" className="btn-text" onClick={onSkip}>
            Skip — widens my range
          </button>
        )}
      </div>
    </div>
  );
}

function ChoiceGrid({
  options,
  labels,
  value,
  onSelect,
}: {
  options: string[];
  labels: Record<string, string>;
  value: string | undefined;
  onSelect: (v: string) => void;
}) {
  return (
    <div className="choice-grid" style={{ gridTemplateColumns: options.length > 4 ? 'repeat(2, 1fr)' : `repeat(${options.length}, 1fr)` }}>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          className={`choice-cell${value === opt ? ' selected' : ''}`}
          onClick={() => onSelect(opt)}
          aria-pressed={value === opt}
        >
          {labels[opt]}
        </button>
      ))}
    </div>
  );
}

function CreditScoreInput({ value, onAnswer }: { value: ScoreAnswer | undefined; onAnswer: (v: ScoreAnswer) => void }) {
  const [draft, setDraft] = useState(typeof value === 'number' ? String(value) : '');
  const special = value === 'dont_know' || value === 'never_borrowed' ? value : undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <div className="field">
          <input
            inputMode="numeric"
            placeholder="e.g. 750"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Credit score"
          />
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            const n = Number(draft);
            if (draft.trim() !== '' && !Number.isNaN(n)) onAnswer(n);
          }}
        >
          Next
        </button>
      </div>
      <ChoiceGrid
        options={['dont_know', 'never_borrowed']}
        labels={{ dont_know: "I don't know it", never_borrowed: 'I have never borrowed' }}
        value={special}
        onSelect={(v) => onAnswer(v as ScoreAnswer)}
      />
    </div>
  );
}

function GoodMonthAside({ value, onAnswer }: { value: number | undefined; onAnswer: (v: number) => void }) {
  const [draft, setDraft] = useState(value !== undefined ? String(value) : '');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>On a good month?</div>
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>Context only — this doesn't change any number.</div>
      <div className="field" style={{ maxWidth: 220 }}>
        <span className="mono" style={{ color: 'var(--muted)', fontSize: 15 }}>
          ₹
        </span>
        <input
          inputMode="decimal"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            const n = Number(e.target.value);
            if (!Number.isNaN(n) && e.target.value.trim() !== '') onAnswer(n);
          }}
          aria-label="Good month income"
        />
      </div>
    </div>
  );
}
