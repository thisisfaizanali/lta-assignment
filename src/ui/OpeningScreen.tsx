/** Transcribed from Main.dc.html — the opening screen. */
import { useState } from 'react';
import type { Purpose } from '../rules/constants';
import { PURPOSE_LABELS } from './inputKinds';

const PURPOSES: Purpose[] = ['wedding', 'business', 'vehicle', 'medical', 'home', 'refinance', 'travel', 'consumption'];

const KFS_ROWS = [
  'Loan type',
  'Estimated lender-side maximum',
  'Amount you can safely carry',
  'Fair interest rate for you',
  'All-in APR, fees included',
  'Monthly EMI ceiling',
  'Total interest over the term',
  'Should you borrow at all',
];

interface OpeningScreenProps {
  onStart: (purpose: Purpose) => void;
}

export function OpeningScreen({ onStart }: OpeningScreenProps) {
  const [purpose, setPurpose] = useState<Purpose | undefined>(undefined);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          padding: '22px 24px 14px',
          borderBottom: '1px solid var(--ink)',
        }}
      >
        <div className="eyebrow">Borrower Copilot</div>
        <div className="eyebrow mono">Nothing you type is saved or sent</div>
      </div>

      <div className="opening-grid">
        <div className="opening-hero">
          <div className="cond" style={{ fontSize: 'clamp(34px, 5vw, 54px)', maxWidth: '11ch' }}>
            A lender will fill this in about you.
          </div>
          <div style={{ fontSize: 18, lineHeight: 1.45, maxWidth: '34ch' }}>
            Fill it in first. Answer a few questions and walk in knowing the amount, the rate and the EMI you should
            agree to — and the ones you should refuse.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 6 }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>What is the loan for?</div>
            <div className="choice-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              {PURPOSES.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`choice-cell${purpose === p ? ' selected' : ''}`}
                  onClick={() => setPurpose(p)}
                  aria-pressed={purpose === p}
                >
                  {PURPOSE_LABELS[p]}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: '44ch' }}>
              Purpose decides the product, and the product decides the rate band. A wedding is a personal loan; a
              shop you own is collateral.
            </div>
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 18, paddingTop: 32 }}>
            <button type="button" className="btn-primary" disabled={!purpose} onClick={() => purpose && onStart(purpose)}>
              Start
            </button>
            <div className="mono" style={{ fontSize: 13, color: 'var(--muted)' }}>
              about 4 minutes
            </div>
          </div>
        </div>

        <div className="opening-kfs">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 10 }}>
            <div className="cond" style={{ fontSize: 20, letterSpacing: '0.04em' }}>
              KEY FACT STATEMENT
            </div>
            <div className="eyebrow mono">Self-assessed</div>
          </div>
          <div style={{ height: 1, background: 'var(--ink)' }} />

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {KFS_ROWS.map((row) => (
              <div
                key={row}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '17px 0',
                  borderBottom: '1px solid var(--rule)',
                }}
              >
                <div style={{ color: 'var(--muted)', fontSize: 14 }}>{row}</div>
                <div className="mono" style={{ color: 'var(--muted)', fontSize: 14 }}>
                  — not yet known
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 'auto', paddingTop: 22, fontSize: 13, lineHeight: 1.5, color: 'var(--muted)', maxWidth: '42ch' }}>
            Lenders must hand you a Key Fact Statement under RBI rules — after they have already decided. This is the
            same document, written by you, first.
          </div>
        </div>
      </div>
    </div>
  );
}
