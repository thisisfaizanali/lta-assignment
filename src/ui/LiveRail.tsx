/**
 * The right-side "live estimate" panel shown during the question flow, once
 * enough is answered to compute anything (Question.dc.html / Phone.dc.html).
 *
 * Deviation from the mockup, and why: the mockup shows a categorical
 * "confidence: Low/Medium" badge. No RULES.md constant defines the cutoffs
 * for that label, and inventing one would be exactly the kind of threshold
 * the brief says not to invent. Shown instead: a plain answered-count and
 * the actual list of unresolved inputs (Outputs.unresolvedInputs) — the same
 * honesty RULES.md §9 already requires of the Statement screen, without a
 * fabricated cutoff.
 */
import type { Outputs } from '../rules/types';
import { BandVisual } from './Band';
import { formatMoneyBand, formatPercentBand, formatINR } from './format';

interface LiveRailProps {
  outputs: Outputs;
  askAmount: number;
  answeredCount: number;
  totalCount: number;
  previousUnresolvedCount?: number;
}

const FIELD_LABEL: Record<string, string> = {
  creditScore: 'credit score',
  cardUtilisation: 'card utilisation',
  emergencySavingsMonths: 'emergency savings',
  householdExpenses: 'household expenses',
  bounceInLast12Months: 'bounce history',
  existingEmiMonthly: 'existing EMIs',
  yearsAtCurrentEmployer: 'employer tenure',
  businessVintageYears: 'business vintage',
  gstAndCurrentAccount: 'GST/current account',
};

export function LiveRail({ outputs, askAmount, answeredCount, totalCount, previousUnresolvedCount }: LiveRailProps) {
  const maxScale = Math.max(askAmount, outputs.lenderMax.value.hi) * 1.15;
  const narrowedBy =
    previousUnresolvedCount !== undefined && previousUnresolvedCount > outputs.unresolvedInputs.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="eyebrow">Live estimate</div>

      <div style={{ marginTop: 26, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>You asked for</div>
        <div className="mono" style={{ fontSize: 17, color: 'var(--blue)' }}>
          {formatINR(askAmount)}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <BandVisual
          maxScale={maxScale}
          marker={{ value: askAmount, label: 'ask' }}
          spans={[
            { lo: outputs.safeMax.value.lo, hi: outputs.safeMax.value.hi, color: 'green' },
            { lo: outputs.lenderMax.value.lo, hi: outputs.lenderMax.value.hi, color: 'blue' },
          ]}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
        <Row label="Safe to carry" value={formatMoneyBand(outputs.safeMax.value)} color="var(--green)" bold />
        <Row label="Estimated lender-side maximum" value={formatMoneyBand(outputs.lenderMax.value)} color="var(--blue)" bold />
        <Row label="Fair rate" value={formatPercentBand(outputs.rateBand.value)} />
        <Row label="EMI ceiling" value={formatMoneyBand(outputs.emiCeiling.value)} last />
      </div>

      {narrowedBy && (
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div className="mono" style={{ fontSize: 12 }}>
            band narrowed — {previousUnresolvedCount! - outputs.unresolvedInputs.length} fewer unknown{previousUnresolvedCount! - outputs.unresolvedInputs.length === 1 ? '' : 's'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>That answer tightened every number above.</div>
        </div>
      )}

      <div style={{ marginTop: 'auto', paddingTop: 20, borderTop: '1px solid var(--rule)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div className="eyebrow">Answered</div>
          <div className="mono" style={{ fontSize: 13 }}>
            {answeredCount} of {totalCount}
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6, lineHeight: 1.5 }}>
          {outputs.unresolvedInputs.length === 0
            ? 'Everything relevant to your case has been answered.'
            : `Held as unknown, not as zero: ${outputs.unresolvedInputs.map((f) => FIELD_LABEL[f] ?? f).join(', ')} — which is why these ranges are still wide.`}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, color, bold, last }: { label: string; value: string; color?: string; bold?: boolean; last?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        padding: '13px 0',
        borderTop: '1px solid var(--rule)',
        borderBottom: last ? '1px solid var(--rule)' : undefined,
      }}
    >
      <div style={{ fontSize: 13, color: color ?? 'var(--muted)', fontWeight: bold ? 600 : 400 }}>{label}</div>
      <div className="mono" style={{ fontSize: 16, color }}>
        {value}
      </div>
    </div>
  );
}
