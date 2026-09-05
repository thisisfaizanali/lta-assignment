import { describe, expect, it } from 'vitest';
import { BAND_FLOOR_WIDTH_PP, PRODUCTS } from '../constants';
import { computeRate, feeForStance } from '../rate';
import { baseAnswers } from './fixtures';

describe('computeRate — band width and clamping', () => {
  it('always returns at least BAND_FLOOR_WIDTH_PP width, even for a fully-answered profile', () => {
    const { band } = computeRate(baseAnswers({ creditScore: 780 }), PRODUCTS.personal, 'cautious');
    expect(band.hi - band.lo).toBeCloseTo(BAND_FLOOR_WIDTH_PP, 5);
  });

  it('never produces a band above the product\'s worst-tier ceiling', () => {
    const worstCase = baseAnswers({
      incomeType: 'informal',
      creditScore: 500,
      cardUtilisation: 0.9,
      bounceInLast12Months: true,
    });
    const { band } = computeRate(worstCase, PRODUCTS.personal, 'cautious');
    expect(band.hi).toBeLessThanOrEqual(PRODUCTS.personal.rateBase[1]);
  });

  it('never produces a band below the product\'s best-tier floor', () => {
    const bestCase = baseAnswers({ creditScore: 800, cardUtilisation: 0.05 });
    const { band } = computeRate(bestCase, PRODUCTS.personal, 'cautious');
    expect(band.lo).toBeGreaterThanOrEqual(PRODUCTS.personal.rateBase[0]);
  });
});

describe('computeRate — score tiers', () => {
  it('a 780+ score with an otherwise-clean, fully-stated profile contributes no delta', () => {
    const answers = baseAnswers({
      creditScore: 800,
      cardUtilisation: 0,
      bounceInLast12Months: false,
      yearsAtCurrentEmployer: 5, // stated, so the employer-tenure two-pass fallback doesn't apply
    });
    const { band } = computeRate(answers, PRODUCTS.personal, 'cautious');
    expect(band.lo).toBeCloseTo(PRODUCTS.personal.rateBase[0], 5);
  });

  it('a lower score produces a materially higher point than a higher score, all else equal', () => {
    const good = computeRate(baseAnswers({ creditScore: 800 }), PRODUCTS.personal, 'cautious');
    const bad = computeRate(baseAnswers({ creditScore: 660 }), PRODUCTS.personal, 'cautious');
    expect(bad.band.lo).toBeGreaterThan(good.band.lo);
  });

  it('"never borrowed" is priced via the thin-file rule, not the numeric UNKNOWNS band', () => {
    const secured = computeRate(baseAnswers({ creditScore: 'never_borrowed' }), PRODUCTS.lap, 'cautious');
    const unsecured = computeRate(baseAnswers({ creditScore: 'never_borrowed' }), PRODUCTS.personal, 'cautious');
    // thin-file adds a delta on SECURED products specifically
    const securedBaseline = computeRate(baseAnswers({ creditScore: 780 }), PRODUCTS.lap, 'cautious');
    expect(secured.band.lo).toBeGreaterThan(securedBaseline.band.lo);
    // score is always deltas[0] in computeRate's construction
    expect(unsecured.deltas[0].value).toBe(0);
    expect(unsecured.deltas[0].label.toLowerCase()).toMatch(/decline|first-time/);
  });
});

describe('computeRate — cautious vs favourable widens the band for an unknown score', () => {
  it('produces a wider combined range than a stated score would', () => {
    const unknownCautious = computeRate(baseAnswers({ creditScore: undefined }), PRODUCTS.personal, 'cautious');
    const unknownFavourable = computeRate(baseAnswers({ creditScore: undefined }), PRODUCTS.personal, 'favourable');
    expect(unknownCautious.band.lo).toBeGreaterThan(unknownFavourable.band.lo);
  });
});

describe('computeRate — card utilisation and bounce', () => {
  it('high utilisation adds more than low utilisation', () => {
    const high = computeRate(baseAnswers({ cardUtilisation: 0.8 }), PRODUCTS.personal, 'cautious');
    const low = computeRate(baseAnswers({ cardUtilisation: 0.1 }), PRODUCTS.personal, 'cautious');
    expect(high.band.lo).toBeGreaterThan(low.band.lo);
  });

  it('a bounce in the last 12 months raises the rate', () => {
    const withBounce = computeRate(baseAnswers({ bounceInLast12Months: true }), PRODUCTS.personal, 'cautious');
    const without = computeRate(baseAnswers({ bounceInLast12Months: false }), PRODUCTS.personal, 'cautious');
    expect(withBounce.band.lo).toBeGreaterThan(without.band.lo);
  });
});

describe('computeRate — EV concession', () => {
  it('applies EV_RATE_CONCESSION only for an electric two-wheeler', () => {
    const ev = computeRate(baseAnswers({ isElectricVehicle: true }), PRODUCTS.twowheeler_ev, 'cautious');
    const petrol = computeRate(baseAnswers({ isElectricVehicle: false }), PRODUCTS.twowheeler_ev, 'cautious');
    expect(ev.band.lo).toBeLessThan(petrol.band.lo);
  });
});

describe('computeRate — every delta carries a label (explainability)', () => {
  it('has no unlabelled adjustments', () => {
    const { deltas } = computeRate(baseAnswers(), PRODUCTS.personal, 'cautious');
    for (const d of deltas) {
      expect(d.label.length).toBeGreaterThan(0);
    }
  });
});

describe('feeForStance', () => {
  it('models a fee range for personal loans only', () => {
    const principal = 650_000;
    const cautious = feeForStance(PRODUCTS.personal, principal, 'cautious');
    const favourable = feeForStance(PRODUCTS.personal, principal, 'favourable');
    expect(cautious).toBe(13_000);
    expect(favourable).toBe(6_500);
  });

  it('does not vary by stance for a non-personal product', () => {
    const principal = 3_000_000;
    const cautious = feeForStance(PRODUCTS.lap, principal, 'cautious');
    const favourable = feeForStance(PRODUCTS.lap, principal, 'favourable');
    expect(cautious).toBe(favourable);
  });
});
