import { describe, expect, it } from 'vitest';
import { PRODUCTS } from '../constants';
import { defaultProductForPurpose, lenderLtvFor, routeProduct } from '../products';
import { computeRate } from '../rate';
import { baseAnswers } from './fixtures';

const rateFor = (answers: Parameters<typeof computeRate>[0]) => (p: (typeof PRODUCTS)[keyof typeof PRODUCTS]) =>
  computeRate(answers, p, 'cautious').band;

describe('defaultProductForPurpose', () => {
  it('maps consumption purposes to personal', () => {
    expect(defaultProductForPurpose('wedding')).toBe('personal');
    expect(defaultProductForPurpose('medical')).toBe('personal');
  });
  it('maps vehicle to twowheeler_ev, business to business, home to home', () => {
    expect(defaultProductForPurpose('vehicle')).toBe('twowheeler_ev');
    expect(defaultProductForPurpose('business')).toBe('business');
    expect(defaultProductForPurpose('home')).toBe('home');
  });
});

describe('routeProduct — no collateral', () => {
  it('stays on the purpose default with no override', () => {
    const answers = baseAnswers({ purpose: 'wedding', askAmount: 800_000, incomeType: 'salaried' });
    const routing = routeProduct(answers, rateFor(answers));
    expect(routing.product.value).toBe('personal');
    expect(routing.mudraFlag).toBe(false);
  });
});

describe('routeProduct — Mudra precedence (Ravi\'s case)', () => {
  it('surfaces Mudra before recommending LAP for a self-employed borrower within the ₹20L limit', () => {
    const answers = baseAnswers({
      purpose: 'business',
      askAmount: 1_500_000,
      incomeType: 'self_employed',
      collateralType: 'property',
      collateralValue: 4_500_000,
      collateralIsLivelihoodOrOnlyHome: true,
    });
    const routing = routeProduct(answers, rateFor(answers));
    expect(routing.mudraFlag).toBe(true);
    expect(routing.product.value).toBe('business'); // NOT routed to secured LAP
    expect(routing.product.why.toLowerCase()).toContain('mudra');
    expect(routing.securedAlternative?.product).toBe('lap');
  });

  it('does not flag Mudra above the ₹20L limit', () => {
    const answers = baseAnswers({ purpose: 'business', askAmount: 2_500_000, incomeType: 'self_employed' });
    const routing = routeProduct(answers, rateFor(answers));
    expect(routing.mudraFlag).toBe(false);
  });

  it('does not flag Mudra for a salaried borrower even within the limit', () => {
    const answers = baseAnswers({ purpose: 'business', askAmount: 1_000_000, incomeType: 'salaried' });
    const routing = routeProduct(answers, rateFor(answers));
    expect(routing.mudraFlag).toBe(false);
  });
});

describe('routeProduct — secured override and livelihood protection', () => {
  // Purpose 'business' (unsecured 14-26%) vs 'lap' (9-14%) has a large enough
  // BASE-BAND gap (5pp before any LTV bonus) to legitimately clear the 3pp
  // override threshold. A 'wedding' (personal, 10-24%) vs LAP comparison
  // cannot: their base floors are only 1pp apart, so a salaried, non-Mudra
  // wedding case never clears 3pp under this rate model — that's the engine
  // correctly declining to recommend pledging property to save ~1pp on a
  // wedding, not a bug.
  it('routes to secured when collateral clears the threshold and is not the sole livelihood', () => {
    const answers = baseAnswers({
      purpose: 'business',
      askAmount: 800_000,
      incomeType: 'salaried', // salaried, not self-employed, so Mudra never applies here
      collateralType: 'property',
      collateralValue: 5_000_000,
      collateralIsLivelihoodOrOnlyHome: false,
    });
    const routing = routeProduct(answers, rateFor(answers));
    expect(routing.product.value).toBe('lap');
  });

  it('does NOT route to secured when the collateral is the borrower\'s only home or livelihood', () => {
    const answers = baseAnswers({
      purpose: 'business',
      askAmount: 800_000,
      incomeType: 'salaried',
      collateralType: 'property',
      collateralValue: 5_000_000,
      collateralIsLivelihoodOrOnlyHome: true,
    });
    const routing = routeProduct(answers, rateFor(answers));
    expect(routing.product.value).toBe('business');
    expect(routing.product.why.toLowerCase()).toMatch(/livelihood|only home/);
  });
});

describe('lenderLtvFor', () => {
  it('uses the tiered gold LTV schedule, not a flat figure', () => {
    expect(lenderLtvFor(PRODUCTS.gold, 200_000)).toBe(0.85);
    expect(lenderLtvFor(PRODUCTS.gold, 400_000)).toBe(0.8);
    expect(lenderLtvFor(PRODUCTS.gold, 1_000_000)).toBe(0.75);
  });

  it('uses the lender LTV for LAP, not the advised (lower) figure', () => {
    expect(lenderLtvFor(PRODUCTS.lap, 5_000_000)).toBe(0.7);
  });
});
