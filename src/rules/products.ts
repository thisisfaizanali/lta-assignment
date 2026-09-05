/**
 * Product selection — RULES.md §2.1. Decides which of the six products a
 * borrower's numbers get computed against, before rate.ts or affordability.ts
 * run. Pure, stance-independent: every input here is a stated fact
 * (purpose, collateral, income type), never an UNKNOWNS-covered field.
 */
import {
  GOLD_LTV_TIERS,
  MUDRA_COLLATERAL_FREE_LIMIT,
  PRODUCTS,
  SECURED_OVERRIDE_MIN_SAVING_PP,
  type Product,
  type ProductId,
  type Purpose,
} from './constants';
import type { Answers, Explained } from './types';

/**
 * §2.1's purpose -> product mapping. "refinance -> cheapest available" is
 * genuinely ambiguous (RULES.md never says by what measure, and no persona
 * uses it), so it falls back to `personal` as the simplest documented
 * unsecured option rather than a bespoke "search for cheapest" routine.
 */
export function defaultProductForPurpose(purpose: Purpose): ProductId {
  switch (purpose) {
    case 'wedding':
    case 'medical':
    case 'travel':
    case 'consumption':
      return 'personal';
    case 'vehicle':
      return 'twowheeler_ev';
    case 'business':
      return 'business';
    case 'home':
      return 'home';
    case 'refinance':
      return 'personal';
  }
}

/** The LTV a LENDER would actually apply against this collateral, for capping lenderMax (§5). */
export function lenderLtvFor(product: Product, collateralValue: number): number {
  if (product.id === 'gold') {
    const tier = GOLD_LTV_TIERS.find((t) => collateralValue <= t.upTo);
    return tier ? tier.ltv : GOLD_LTV_TIERS[GOLD_LTV_TIERS.length - 1].ltv;
  }
  return product.ltvLender ?? product.ltvAdvised ?? 1;
}

export interface RoutingResult {
  product: Explained<ProductId>;
  /** True when the ask is inside Mudra's collateral-free limit for a self-employed borrower — see §2.1. */
  mudraFlag: boolean;
  /** A cheaper secured alternative that was considered but NOT recommended, for the verdict's explanation text. */
  securedAlternative?: { product: ProductId; rateMidpoint: number; risksLivelihood: boolean };
}

/**
 * §2.1 routing, in the order the rule is written:
 *   1. Start from the purpose default.
 *   2. Mudra check FIRST, for a self-employed borrower within the ₹20L limit
 *      — this takes precedence over the secured-override math entirely, per
 *      "surface Mudra before recommending LAP." Mudra has no modeled rate
 *      (RULES.md never gives it one), so it never becomes the *computed*
 *      product — it's a routing note pointing the borrower at a
 *      collateral-free scheme before we'd otherwise suggest pledging property.
 *   3. Otherwise, if collateral exists and clears the secured-override
 *      threshold AND isn't the borrower's only home/sole livelihood, route to
 *      the secured product.
 *   4. Otherwise stay on the purpose default, but still surface a secured
 *      alternative in the explanation if one exists and would have helped,
 *      naming the livelihood risk if that's why it wasn't recommended.
 *
 * "Micro enterprise" (the Mudra eligibility test) has no separate definition
 * in RULES.md — self_employed income type is used as the proxy, since it's
 * the closest signal §10.1 actually collects.
 */
export function routeProduct(
  answers: Answers,
  ratePercentFor: (product: Product) => { lo: number; hi: number },
): RoutingResult {
  const defaultId = defaultProductForPurpose(answers.purpose);
  const defaultProduct = PRODUCTS[defaultId];

  const mudraEligible = answers.incomeType === 'self_employed' && answers.askAmount <= MUDRA_COLLATERAL_FREE_LIMIT;

  if (mudraEligible) {
    let securedAlternative: RoutingResult['securedAlternative'];
    if (answers.collateralType && (answers.collateralValue ?? 0) > 0) {
      const securedId: ProductId = answers.collateralType === 'gold' ? 'gold' : 'lap';
      const securedRate = ratePercentFor(PRODUCTS[securedId]);
      securedAlternative = {
        product: securedId,
        rateMidpoint: (securedRate.lo + securedRate.hi) / 2,
        risksLivelihood: answers.collateralIsLivelihoodOrOnlyHome === true,
      };
    }
    return {
      product: {
        value: defaultId,
        why: `Your ask is within Mudra's ₹20,00,000 collateral-free limit for a micro enterprise. Ask about Mudra (Tarun Plus) before considering anything secured — pledging property to raise an amount a government scheme can already cover is very likely the wrong trade.${securedAlternative ? ` If Mudra isn't available to you, ${securedAlternative.risksLivelihood ? 'a secured option would be cheaper but would put your stated livelihood or only home at risk' : 'a secured option would be materially cheaper'}.` : ''}`,
        from: ['incomeType', 'askAmount'],
      },
      mudraFlag: true,
      securedAlternative,
    };
  }

  const hasCollateral = !!answers.collateralType && (answers.collateralValue ?? 0) > 0;
  if (hasCollateral) {
    const securedId: ProductId = answers.collateralType === 'gold' ? 'gold' : 'lap';
    const securedProduct = PRODUCTS[securedId];
    const securedRate = ratePercentFor(securedProduct);
    const defaultRate = ratePercentFor(defaultProduct);
    const securedMid = (securedRate.lo + securedRate.hi) / 2;
    const defaultMid = (defaultRate.lo + defaultRate.hi) / 2;
    const savingPp = defaultMid - securedMid;
    const isLivelihoodOrOnlyHome = answers.collateralIsLivelihoodOrOnlyHome === true;

    if (savingPp >= SECURED_OVERRIDE_MIN_SAVING_PP && !isLivelihoodOrOnlyHome) {
      return {
        product: {
          value: securedId,
          why: `Your collateral makes ${securedProduct.label.toLowerCase()} roughly ${savingPp.toFixed(1)} percentage points cheaper than ${defaultProduct.label.toLowerCase()} — above our threshold for the extra paperwork and valuation cost to be worth it.`,
          from: ['collateralType', 'collateralValue', 'purpose'],
        },
        mudraFlag: false,
      };
    }

    return {
      product: {
        value: defaultId,
        why:
          isLivelihoodOrOnlyHome
            ? `A secured option (${securedProduct.label.toLowerCase()}) would be about ${savingPp.toFixed(1)} percentage points cheaper, but you told us that collateral is your only home or sole means of earning — we don't recommend risking it for this saving.`
            : `Your collateral doesn't beat ${defaultProduct.label.toLowerCase()} by enough (${savingPp.toFixed(1)}pp) to justify the extra paperwork and valuation cost.`,
        from: ['purpose'],
      },
      mudraFlag: false,
      securedAlternative: { product: securedId, rateMidpoint: securedMid, risksLivelihood: isLivelihoodOrOnlyHome },
    };
  }

  return {
    product: {
      value: defaultId,
      why: `${defaultProduct.label} is the standard product for this purpose.`,
      from: ['purpose'],
    },
    mudraFlag: false,
  };
}
