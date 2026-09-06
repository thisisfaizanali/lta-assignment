/**
 * The one piece of the presentation layer that can change a financial number.
 *
 * Both fields below render as a `percent` control, but the engine stores them
 * differently, and getting it wrong is silent: a mis-scaled card utilisation
 * doesn't throw, it just prices the borrower as stretched.
 */
import { describe, expect, it } from 'vitest';
import { CARD_UTILISATION_HIGH, CARD_UTILISATION_LOW, COSTLY_DEBT_THRESHOLD_APR } from '../../rules/constants';
import { INPUT_KIND, percentScaleFor } from '../inputKinds';

describe('percentScaleFor', () => {
  it('scales card utilisation into the 0..1 fraction the engine compares against', () => {
    const typed = 20; // borrower types "20" meaning 20%
    const stored = typed / percentScaleFor('cardUtilisation');

    expect(stored).toBeCloseTo(0.2);
    // the point of the fix: 20% must read as LOW utilisation, not high
    expect(stored).toBeLessThan(CARD_UTILISATION_LOW);
    expect(stored).not.toBeGreaterThan(CARD_UTILISATION_HIGH);
  });

  it('leaves a whole-number APR alone', () => {
    const typed = 32; // "32" meaning 32% APR
    const stored = typed / percentScaleFor('existingDebtAPR');

    expect(stored).toBe(32);
    expect(stored).toBeGreaterThan(COSTLY_DEBT_THRESHOLD_APR);
  });

  it('round-trips a stored answer back into the input without re-scaling it', () => {
    const scale = percentScaleFor('cardUtilisation');
    const shown = 0.2 * scale;

    expect(shown).toBeCloseTo(20);
    expect(shown / scale).toBeCloseTo(0.2);
  });

  it('covers every percent-rendered field, so a new one cannot be missed silently', () => {
    const percentFields = Object.entries(INPUT_KIND)
      .filter(([, kind]) => kind === 'percent')
      .map(([id]) => id);

    expect(percentFields.sort()).toEqual(['cardUtilisation', 'existingDebtAPR']);
  });
});
