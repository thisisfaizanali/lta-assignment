/**
 * Transcribed from Card.dc.html — the one-screen Negotiation Card, designed
 * phone-first (it's meant to be held up or screenshotted at a branch).
 * "Because" reasons are built from the same Explained `why` strings the
 * engine already produced — never freshly authored copy that could drift
 * from what the numbers actually mean.
 */
import { useState } from 'react';
import { PRODUCTS } from '../rules/constants';
import { emi } from '../rules/money';
import type { Outputs } from '../rules/types';
import { formatINR, formatPercentBand } from './format';

interface NegotiationCardProps {
  outputs: Outputs;
  askAmount: number;
  tenureMonths: number;
  onBack: () => void;
}

export function NegotiationCard({ outputs, askAmount, tenureMonths, onBack }: NegotiationCardProps) {
  const [quote, setQuote] = useState('');
  const product = PRODUCTS[outputs.product.value];
  // Review finding 7/8: whichever of the two maximums is actually lower binds
  // — not always safeMax (see StatementScreen's same logic).
  const bindingCap = Math.min(outputs.lenderMax.value.hi || Infinity, outputs.safeMax.value.hi || Infinity);
  const useAmount = Math.min(askAmount, Number.isFinite(bindingCap) ? bindingCap : askAmount) || askAmount;
  const emiCeiling = outputs.emiCeiling.value.hi;

  const quoteRate = Number(quote);
  const hasQuote = quote.trim() !== '' && !Number.isNaN(quoteRate) && quoteRate > 0;
  const gapRupees = hasQuote
    ? Math.max(0, emi({ principal: useAmount, annualRatePercent: quoteRate, months: tenureMonths }) * tenureMonths -
        emi({ principal: useAmount, annualRatePercent: (outputs.rateBand.value.lo + outputs.rateBand.value.hi) / 2, months: tenureMonths }) * tenureMonths)
    : 0;

  const reasons = [outputs.rateBand.why, outputs.emiCeiling.why, outputs.verdict.why].filter(Boolean);

  return (
    <div className="card-screen">
      <div className="card-inner">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 9, borderBottom: '1px solid var(--ink)' }}>
          <div className="cond" style={{ fontSize: 15, letterSpacing: '0.06em' }}>
            MY TERMS
          </div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
            {product.label.toLowerCase()}
          </div>
        </div>

        <div style={{ paddingTop: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div className="sec">What I am asking for</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
            <div className="cond" style={{ fontSize: 36 }}>
              {formatINR(useAmount)}
            </div>
            <div className="mono" style={{ fontSize: 13, color: 'var(--muted)' }}>
              {tenureMonths} months
            </div>
          </div>
          {useAmount < askAmount && (
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              You asked {formatINR(askAmount)}; this card is built around {formatINR(useAmount)} — the number your own
              statement says you can actually get.
            </div>
          )}
        </div>

        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--rule)', display: 'flex', flexDirection: 'column', gap: 11 }}>
          <div className="sec">What is fair for me</div>
          <CardRow label="Interest rate" value={formatPercentBand(outputs.rateBand.value)} />
          <CardRow label="All-in APR with fees" value={formatPercentBand(outputs.aprBand.value)} />
          <CardRow label="Monthly EMI" value={`up to ${formatINR(emiCeiling)}`} />
        </div>

        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--rule)', display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div className="sec">Because</div>
          {reasons.map((r, i) => (
            <div style={{ display: 'flex', gap: 10 }} key={i}>
              <div className="mono" style={{ fontSize: 12, color: 'var(--muted)', paddingTop: 2 }}>
                {String(i + 1).padStart(2, '0')}
              </div>
              <div style={{ fontSize: 13.5, lineHeight: 1.45 }}>{r}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 18, padding: '13px 15px', border: '1px solid var(--red)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="sec" style={{ color: 'var(--red)' }}>
            What I will not agree to
          </div>
          <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>
            An EMI above <span className="mono">{formatINR(emiCeiling)}</span>.<br />
            An all-in APR above <span className="mono">{outputs.aprBand.value.hi.toFixed(1)}%</span>.<br />
            A processing fee not disclosed on the Key Fact Statement, or insurance bundled in without my consent.
          </div>
        </div>

        <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--rule)' }}>
          <div className="sec">If a lender quotes you a rate</div>
          <div className="field" style={{ marginTop: 8, maxWidth: 160 }}>
            <input
              inputMode="decimal"
              placeholder="e.g. 14.5"
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              aria-label="Lender's quoted rate"
            />
            <span className="mono" style={{ color: 'var(--muted)', fontSize: 14 }}>
              %
            </span>
          </div>
          {hasQuote && (
            <div style={{ fontSize: 14, lineHeight: 1.5, marginTop: 10 }}>
              That is <span className="mono">{formatINR(gapRupees)}</span> more than the middle of my band, over{' '}
              {tenureMonths} months. Ask what in the profile justifies it.
            </div>
          )}
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 16 }}>
          <button type="button" className="btn-text" onClick={onBack}>
            ← Back to my statement
          </button>
        </div>
      </div>
    </div>
  );
}

function CardRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <div style={{ fontSize: 14 }}>{label}</div>
      <div className="mono" style={{ fontSize: 19, color: 'var(--green)' }}>
        {value}
      </div>
    </div>
  );
}
