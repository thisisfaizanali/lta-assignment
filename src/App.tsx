import { useMemo, useState } from 'react';
import { runEngine } from './rules/engine';
import { PRUDENT_TENURE_MONTHS, type Purpose } from './rules/constants';
import type { Answers } from './rules/types';
import { NegotiationCard } from './ui/NegotiationCard';
import { OpeningScreen } from './ui/OpeningScreen';
import { QuestionFlow } from './ui/QuestionFlow';
import { SharpenScreen } from './ui/SharpenScreen';
import { StatementScreen } from './ui/StatementScreen';

type Screen = 'opening' | 'questions' | 'sharpen' | 'statement' | 'card';

export default function App() {
  const [screen, setScreen] = useState<Screen>('opening');
  const [answers, setAnswersState] = useState<Partial<Answers>>({});

  const setAnswers = (updater: (prev: Partial<Answers>) => Partial<Answers>) => setAnswersState(updater);

  // Once the must-set is complete, HARD_REQUIRED can never have been skipped
  // (QuestionFlow disables Skip on those five) — this cast is safe.
  const complete = answers as Answers;
  const outputs = useMemo(() => (screen === 'sharpen' || screen === 'statement' || screen === 'card' ? runEngine(complete) : undefined), [screen, complete]);

  if (screen === 'opening') {
    return (
      <OpeningScreen
        onStart={(purpose: Purpose) => {
          setAnswersState((prev) => ({ ...prev, purpose }));
          setScreen('questions');
        }}
      />
    );
  }

  if (screen === 'questions') {
    return <QuestionFlow answers={answers} setAnswers={setAnswers} onMustSetDone={() => setScreen('sharpen')} />;
  }

  if (screen === 'sharpen' && outputs) {
    return (
      <SharpenScreen
        answers={complete}
        onAnswer={(patch) => setAnswersState((prev) => ({ ...prev, ...patch }))}
        onFinish={() => setScreen('statement')}
      />
    );
  }

  if (screen === 'statement' && outputs) {
    return (
      <StatementScreen
        outputs={outputs}
        askAmount={complete.askAmount}
        purpose={complete.purpose}
        onOpenCard={() => setScreen('card')}
        onChangeAnswer={() => setScreen('sharpen')}
      />
    );
  }

  if (screen === 'card' && outputs) {
    return (
      <NegotiationCard
        outputs={outputs}
        askAmount={complete.askAmount}
        tenureMonths={PRUDENT_TENURE_MONTHS[complete.purpose]}
        onBack={() => setScreen('statement')}
      />
    );
  }

  return null;
}
