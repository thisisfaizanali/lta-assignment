/**
 * Transcribed from Statement.dc.html — the four outputs (O1-O4).
 *
 * The tenure trade-off table isn't part of Outputs (M3 only returns the
 * prudent-tenure numbers). Built here with money.ts's own emi()/
 * totalInterest() — the same pure functions M3 uses, called directly rather
 * than reimplemented, at the midpoint of the already-computed rate band, over
 * a small sweep of tenures derived from the routed product's own prudent/max
 * tenure. This is "UI derives a display table from existing math," not
 * duplicated financial logic.
 */
import { PRODUCTS } from '../rules/constants';
import { emi, totalInterest } from '../rules/money';
import type { Outputs } from '../rules/types';
import { BandVisual } from './Band';
import { formatINR, formatMoneyBand, formatPercentBand } from './format';

const VERDICT_LABEL: Record<Outputs['verdict']['value'], string> = {
  dont_borrow: "DON'T BORROW",
  fix_something_first: 'FIX SOMETHING FIRST',
  different_product: 'A DIFFERENT PRODUCT',
  borrow_less: 'BORROW LESS',
  borrow: 'BORROW',
};

const VERDICT_COLOR: Record<Outputs['verdict']['value'], string> = {
  dont_borrow: 'var(--red)',
  fix_something_first: 'var(--red)',
  different_product: 'var(--blue)',
  borrow_less: 'var(--red)',
  borrow: 'var(--green)',
};

interface StatementScreenProps {
  outputs: Outputs;
  askAmount: number;
  /** The prudent tenure, already capped by age (see App.tsx / affordability.ts's effectivePrudentTenureMonths). */
  tenureMonths: number;
  onOpenCard: () => void;
  onChangeAnswer: () => void;
}

export function StatementScreen({ outputs, askAmount, tenureMonths, onOpenCard, onChangeAnswer }: StatementScreenProps) {
  const product = PRODUCTS[outputs.product.value];
  const midRate = (outputs.rateBand.value.lo + outputs.rateBand.value.hi) / 2;
  const principal = Math.min(askAmount, outputs.safeMax.value.hi || askAmount) || askAmount;

  const tenureOptions = Array.from(
    new Set([tenureMonths, Math.round((tenureMonths + product.maxTenureMonths) / 2), product.maxTenureMonths]),
  ).sort((a, b) => a - b);

  const maxScale = Math.max(askAmount, outputs.lenderMax.value.hi) * 1.15;

  return (
    <div className="statement-screen">
      <div className="statement-header">
        <div className="cond" style={{ fontSize: 20, letterSpacing: '0.04em' }}>
          KEY FACT STATEMENT
        </div>
        <div className="eyebrow mono">Self-assessed · nothing saved</div>
      </div>
      <div style={{ height: 1, background: 'var(--ink)', margin: '0 24px' }} />

      <div className="statement-block statement-o1">
        <div className="statement-col">
          <div className="out">O1 · The verdict</div>
          <div className="cond" style={{ fontSize: 'clamp(40px, 6vw, 64px)', color: VERDICT_COLOR[outputs.verdict.value] }}>
            {VERDICT_LABEL[outputs.verdict.value]}
          </div>
          <div style={{ fontSize: 17, lineHeight: 1.45, maxWidth: '44ch' }}>{outputs.verdict.why}</div>
        </div>
        <div className="statement-col">
          <BandVisual
            maxScale={maxScale}
            marker={{ value: askAmount, label: `you asked ${formatINR(askAmount)}` }}
            spans={[
              { lo: outputs.safeMax.value.lo, hi: outputs.safeMax.value.hi, color: 'green' },
              { lo: outputs.lenderMax.value.lo, hi: outputs.lenderMax.value.hi, color: 'blue' },
            ]}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <div>
              <div className="mono" style={{ fontSize: 12, color: 'var(--green)' }}>
                {formatMoneyBand(outputs.safeMax.value)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>safe</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="mono" style={{ fontSize: 12, color: 'var(--blue)' }}>
                {formatMoneyBand(outputs.lenderMax.value)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>lender-side estimate</div>
            </div>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 14, lineHeight: 1.5 }}>
            The soft edges are what we still do not know. They shrink as you answer, and never close completely.
          </div>
        </div>
      </div>

      <Divider />

      <div className="statement-block statement-two-col">
        <div className="statement-col">
          <div className="out">O2 · Two different maximums</div>
          <OutputRow label="Estimated lender-side maximum" why={outputs.lenderMax.why} value={formatMoneyBand(outputs.lenderMax.value)} color="var(--blue)" />
          <OutputRow label="You can safely carry ← use this" why={outputs.safeMax.why} value={formatMoneyBand(outputs.safeMax.value)} color="var(--green)" underline />
          <div style={{ fontSize: 13.5, lineHeight: 1.5, maxWidth: '52ch' }}>
            The estimated lender-side figure is what a lender's own rule might permit. Yours is what survives a month
            where something goes wrong. Nobody at the branch will mention the gap.
          </div>
        </div>
        <div className="statement-col">
          <div className="out">O3 · A fair rate, and the real one</div>
          <OutputRow label="Fair interest rate" why={outputs.rateBand.why} value={formatPercentBand(outputs.rateBand.value)} />
          <OutputRow label="All-in APR, fees included" why="" value={formatPercentBand(outputs.aprBand.value)} underline />
          <div style={{ fontSize: 13.5, lineHeight: 1.5, maxWidth: '52ch' }}>
            Compare a quote against the second row, never the first — the APR is what you actually pay once fees and
            GST are folded in.
          </div>
        </div>
      </div>

      <Divider />

      <div className="statement-block statement-two-col">
        <div className="statement-col">
          <div className="out">O4 · The EMI to agree to</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
            <div className="cond" style={{ fontSize: 'clamp(36px, 5vw, 56px)' }}>
              {formatMoneyBand(outputs.emiCeiling.value)}
            </div>
            <div style={{ fontSize: 14, color: 'var(--muted)' }}>per month, ceiling</div>
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.5, maxWidth: '48ch' }}>{outputs.emiCeiling.why}</div>

          <div style={{ marginTop: 6, padding: '13px 16px', border: `1px solid ${outputs.stress.value.survives ? 'var(--rule)' : 'var(--red)'}` }}>
            <div className="eyebrow" style={{ color: outputs.stress.value.survives ? undefined : 'var(--red)' }}>
              If things go wrong
            </div>
            <div style={{ fontSize: 13.5, lineHeight: 1.5, marginTop: 6 }}>{outputs.stress.value.scenario}</div>
          </div>
        </div>

        <div className="statement-col">
          <div className="out">The tenure trade-off</div>
          <div className="tenure-table">
            <div className="tenure-row tenure-head">
              <div className="eyebrow">Term</div>
              <div className="eyebrow" style={{ textAlign: 'right' }}>
                Monthly EMI
              </div>
              <div className="eyebrow" style={{ textAlign: 'right' }}>
                Interest paid
              </div>
            </div>
            {tenureOptions.map((months) => {
              const loan = { principal, annualRatePercent: midRate, months };
              return (
                <div className="tenure-row" key={months}>
                  <div className="mono">{months} months</div>
                  <div className="mono" style={{ textAlign: 'right' }}>
                    {formatINR(emi(loan))}
                  </div>
                  <div className="mono" style={{ textAlign: 'right' }}>
                    {formatINR(totalInterest(loan))}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 13.5, lineHeight: 1.5, maxWidth: '50ch' }}>
            A longer term lowers the EMI and raises the total cost. Take it only if you need the room, not because
            the EMI reads better.
          </div>
        </div>
      </div>

      <div className="statement-footer">
        <div style={{ height: 1, background: 'var(--rule)' }} />
        <div className="statement-footer-row">
          <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.55, maxWidth: '74ch' }}>
            Where this is guessing: your living costs are your own estimate, not a bank statement. Rate bands are
            national approximations and will not match every lender. Nothing here is a sanction, and no lender is
            bound by it.
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', whiteSpace: 'nowrap' }}>
            <button type="button" className="btn-text" onClick={onChangeAnswer}>
              Change an answer
            </button>
            <button type="button" className="btn-primary" onClick={onOpenCard}>
              Open my card
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Divider() {
  return (
    <div style={{ padding: '0 24px' }}>
      <div style={{ height: 1, background: 'var(--ink)' }} />
    </div>
  );
}

function OutputRow({
  label,
  why,
  value,
  color,
  underline,
}: {
  label: string;
  why: string;
  value: string;
  color?: string;
  underline?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        padding: '13px 0',
        borderTop: '1px solid var(--rule)',
        borderBottom: underline ? '1px solid var(--ink)' : undefined,
        gap: 16,
      }}
    >
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color }}>{label}</div>
        {why && (
          <div className="why" style={{ marginTop: 2 }}>
            {why}
          </div>
        )}
      </div>
      <div className="mono" style={{ fontSize: 18, color, whiteSpace: 'nowrap' }}>
        {value}
      </div>
    </div>
  );
}
