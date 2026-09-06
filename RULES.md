# RULES.md

Every rule, threshold, band and assumption the Borrower Copilot uses.

**How to read this.** Each table row is one rule: *what · value · why · source*.
The **Source** column takes one of four values, and the difference between them
is the point:

| Value | Means |
|---|---|
| **source-backed** | The cited source states this, at this value. Regulation, or a published rate card. |
| **source-backed (secondary)** | Same, but read from an analysis or summary rather than the primary document, because the primary was unavailable. Two rows in §1 carry this, see §11.8. |
| **model assumption** | A source supports the *shape* of the rule, but the exact number is my interpolation. Every score-tier delta in §4.1 is this. |
| **my judgement** | Nothing supports the number but the reasoning in the *Why* cell. Treat it as arguable. It is meant to be argued with. |

Roughly a quarter of the numbers here are source-backed, and the rest are
assumption or judgement. That ratio is the honest picture of retail lending in
India, where the arithmetic is public and the underwriting policy is not. A
number is never promoted to "source-backed" because a source endorses the
general principle behind it.

Everything in §5 and §6, the whole affordability model, is constructed. There
is no RBI-mandated affordability test for retail credit in India.

**Synchronisation with the code.** Every rule here has a counterpart in
[`src/rules/constants.ts`](src/rules/constants.ts), and no financial threshold
lives anywhere else. Most rows state the value rather than the identifier, so the
two files can drift silently, which is exactly how the emergency-savings bands
came apart at one point. `src/rules/__tests__/rules-sync.test.ts` now asserts the
pairing mechanically: every constant name written in backticks here must exist as
an export of `constants.ts`. That catches a renamed or deleted constant, but not
a documented *value* drifting from its code value, which is still maintained by
hand.

Rates and regulatory positions are **as of September 2026**. RBI repo rate is
5.25% (unchanged since the February 2026 cut).

---

## 0. What the app computes

| Output | What it is | Where the rules live |
|---|---|---|
| **O1** | Verdict: borrow / borrow less / fix something first / different product / don't borrow | §7 |
| **O2** | Two maximums, the **estimated lender-side maximum** (§5) and what the borrower **can safely carry** (§6) | §5, §6 |
| **O3** | Fair interest rate band (§4) and the all-in **APR** including fees (§4.4) | §4 |
| **O4** | Monthly **EMI ceiling** (§6.3), tenure trade-off, and a stress case (§8) | §6, §8 |

Two numbers are deliberately never the same thing: **what you'll be offered**
and **what you should take**. Every screen keeps them apart.

---

## 1. Regulatory anchors

These are the rules that are actually law, and the only ones in this document I
would defend without qualification.

| What | Value | Why it matters here | Source |
|---|---|---|---|
| Key Facts Statement is mandatory | All retail and MSME term loans sanctioned on or after **1 Oct 2024** | The app is shaped as a KFS the borrower writes first. A lender must hand them the same document, so the two are directly comparable. | [RBI circular, 15 Apr 2024](https://rbidocs.rbi.org.in/rdocs/notification/PDFs/CIRCULARKFS1504242AE2500BAF494C2A82442B0B642705C1.PDF) |
| APR definition | "The annual cost of credit to the borrower that **includes interest rate and all other charges**" | This is why the app never shows a nominal rate without the APR beside it. | [Same circular](https://rbidocs.rbi.org.in/rdocs/notification/PDFs/CIRCULARKFS1504242AE2500BAF494C2A82442B0B642705C1.PDF) |
| APR **includes** | Processing fee, documentation, on-boarding, verification, valuation, legal, insurance premia (asset/borrower/credit), all third-party charges collected by the lender | We add processing fee + GST + bundled insurance to the cash flow before solving. | [RBI KFS annexes, summarised](https://vinodkothari.com/2024/04/the-key-to-loan-transparency-rbi-frames-kfs-norms-for-all-retail-and-msme-loans/) |
| APR **excludes** | Contingent charges, penal charges, foreclosure/prepayment fees, default charges, plus stamp duty and other statutory levies | These are excluded from our APR too, and shown separately on the Card as things to negotiate. | [Same](https://vinodkothari.com/2024/04/the-key-to-loan-transparency-rbi-frames-kfs-norms-for-all-retail-and-msme-loans/) |
| APR **annualisation method** | Monthly IRR **× 12** (nominal), *not* effective compounding | This is the single most consequential detail in the document. Effective annualisation `(1+i)^12 − 1` gives a materially higher number. For Priya's ₹6.5L / 36m case it is **14.0% effective vs 13.2% RBI**. We use ×12 so our APR is comparable to the lender's KFS. | **source-backed (secondary)**, [law-firm analysis of the circular](https://vinodkothari.com/2024/04/the-key-to-loan-transparency-rbi-frames-kfs-norms-for-all-retail-and-msme-loans/). The primary RBI PDF was CAPTCHA-blocked and could not be read directly; see §11.8 |
| Charges outside the KFS | Cannot be levied without the borrower's explicit consent | Card line: *"anything not on your KFS, I have not agreed to."* | [Business Standard, 15 Apr 2024](https://www.business-standard.com/finance/news/banks-can-t-charge-additional-beyond-key-facts-statement-says-rbi-124041500993_1.html) |
| No prepayment penalty | Floating-rate loans to **individuals for non-business purposes**; and to individuals/MSEs for **business purposes** up to ₹7.5 crore. **No lock-in period** permitted. Applies to loans sanctioned or renewed on or after **1 Jan 2026**. | Direct Card line. Note the trap: most personal loans are *fixed* rate, so this protection does **not** apply to Priya. It does apply to Ravi's LAP if he takes it floating. | [RBI (Pre-payment Charges on Loans) Directions, 2025, 2 Jul 2025](https://elplaw.in/wp-content/uploads/2025/07/Reserve-Bank-of-India-Pre-payment-Charges-on-Loans-Directions-2025-issued-on-July-2-2025.pdf) |
| Gold loan LTV cap | Tiered from **1 Apr 2026**: **85%** up to ₹2.5L · **80%** ₹2.5–5L · **75%** above ₹5L | Replaces the old flat 75%. Used in the gold product's max-amount rule. | [RBI Lending Against Gold and Silver Collateral Directions, 2025, EY summary](https://www.ey.com/en_in/insights/strategy-transactions/rbi-gold-loan-guidelines-2025-impact-assessment-and-key-changes) |
| Gold eligible collateral | Jewellery, ornaments, specially minted coins only. **Not** bars, biscuits, bullion or ETFs | Prevents the app suggesting a gold loan against the wrong asset. | [Same](https://www.ey.com/en_in/insights/strategy-transactions/rbi-gold-loan-guidelines-2025-impact-assessment-and-key-changes) |
| Digital lending cooling-off | Minimum **1 day**, exit without penalty beyond a disclosed one-time processing fee | Relevant to Anita's three app loans, she can exit a new one, and lenders must pre-notify before a recovery agent contacts her. | [RBI Digital Lending Directions, 2025](https://indiacorplaw.in/2025/07/19/rbis-revised-digital-lending-guidelines-strengthening-guardrails-in-an-evolving-ecosystem/) |
| Mudra collateral-free limit | Up to **₹20 lakh** (Tarun Plus tier) for eligible micro enterprises | Materially changes Ravi's answer, see §7.3. | **source-backed (secondary)**, [ClearTax MSME schemes 2026](https://cleartax.in/s/msme-loan-scheme-2020). Not verified against a SIDBI or Ministry primary source; eligibility in practice is lender-by-lender |

**What is *not* regulated, and which the app must therefore treat as opinion:**
FOIR limits, income multiples, what counts as assessable income for a
cash business, and every interest rate in §4. There is no RBI-mandated
affordability test for retail credit in India. Everything in §5 and §6 is
constructed.

---

## 2. Products

Six products. Only the three the personas reach (personal, LAP, two-wheeler/EV)
have carefully-tuned bands. The rest are coarse and marked so.

| id | Product | Secured | Rate band (best → worst tier) | Max tenure | Processing fee | LTV | Amount cap | Tuning |
|---|---|---|---|---|---|---|---|---|
| `personal` | Personal loan | No | **10.0% – 24.0%** | 60 m | 2% of sanction, or a flat ₹6,500 at some banks, modelled as a **range** (§4.4) | n/a | 20× net monthly income, ₹40L absolute | Tuned |
| `lap` | Loan against property | Yes | **9.0% – 14.0%** | 180 m self-employed, 300 m salaried | 1% + GST | **60%** of market value | ₹5 Cr | Tuned |
| `twowheeler_ev` | Two-wheeler / EV loan | Yes (hypothecation) | **9.5% – 16.0%**, less a **0.5%** green concession for EVs | 48 m | 2%, min ₹1,500 | 85% of on-road, up to 95% for EV at some lenders | ₹3L | Tuned |
| `business` | Unsecured business loan | No | **14.0% – 26.0%** | 48 m | 2% + GST | n/a | ₹50L | Coarse |
| `gold` | Gold loan | Yes | **9.0% – 24.0%** (banks 9–12, NBFCs 12–24) | 12 m bullet / 36 m EMI | 1% | Tiered 85/80/75 (§1) | ₹1 Cr | Coarse |
| `home` | Home loan | Yes | **7.5% – 11.0%** | 300 m | 0.5%, capped ₹10,000 | 80%, 75% above ₹75L | n/a | Coarse |

**Sources for the bands:**
personal [BankBazaar / Paisabazaar Sept 2026, 9.99% floor, most applicants 11–16%](https://www.bankbazaar.com/personal-loan-interest-rate.html) ·
LAP [8.5–14% range, Bajaj/SBI/HDFC cards](https://cleartax.in/s/loan-against-property-interest-rates) ·
two-wheeler/EV [11–16% typical, EV concession ~0.5pp, LTV 85–100%](https://www.bankbazaar.com/two-wheeler-loan-interest-rates.html) ·
business [14–26% for unsecured NBFC lending](https://www.paisabazaar.com/business-loan/interest-rates/) ·
gold [banks 9–12%, NBFCs 12–26%](https://cleartax.in/s/gold-loan-interest-rates) ·
home [7.10% floor at PSU banks with repo at 5.25%](https://www.ruloans.com/blog/home-loan-interest-rates-in-india/).

**Judgement inside the table:** the LAP LTV of **60%**, against a published
market range of 50–75%. Reason: the app is advising the borrower, not the
lender. Sizing a secured loan at the top of the LTV range is how people lose the
asset that secured it. 60% leaves headroom for a valuation that comes in low and
for a property market that moves. The lender's own number (§5) uses **70%**, so
the two are visibly different and the borrower can see the gap.

### 2.1 Product routing

| Rule | Value | Why | Source |
|---|---|---|---|
| Purpose → default product | wedding/medical/travel → `personal`; vehicle → `twowheeler_ev` or auto; business stock/equipment → `business`; property purchase/repair → `home`; refinance → cheapest available | Purpose determines product, product determines band. | my judgement |
| Secured override | If the borrower has unencumbered collateral **and** a secured product beats the unsecured one by **≥ 3.0 percentage points**, route to secured and say so | Below 3pp the extra paperwork, valuation cost and the risk of pledging a productive asset are not worth it. Above it, the saving is large enough to be the headline. | my judgement: threshold is arguable, and the interview will probably poke it |
| Collateral of last resort | Never route to secured if the collateral is the borrower's **only home** or their **sole means of earning**, unless no unsecured option exists at all, and then say plainly what is being risked | Ravi's shop premises *is* his livelihood. A LAP that goes wrong takes the business with it. | my judgement |
| Scheme check before secured | If the ask is ≤ ₹20L and the borrower is a micro enterprise, surface **Mudra (Tarun Plus)** as collateral-free before recommending LAP | This is the rule that matters most for Ravi. ₹15L is inside the Mudra limit, so pledging a ₹45L shop to raise ₹15L is very likely the wrong trade. The app should say so even though it is less "sophisticated" than routing to LAP. | [Mudra ₹20L limit](https://cleartax.in/s/msme-loan-scheme-2020); the *precedence* is my judgement |
| `MUDRA_FIRST_TIME_LIKELY_LIMIT` | A genuine first-timer (Ravi: "never taken a formal loan") more realistically tops out near **₹10 lakh**, surfaced only as a caveat in the routing text | The ₹20L Tarun Plus tier is not a first-loan ceiling, it generally requires a previously repaid Tarun loan. **Routing still uses the ₹20L limit above**: gating eligibility on ₹10L would push a first-timer's ₹15L ask straight into the secured branch and defeat the row above, the opposite of what this section exists to do. | **my judgement**; the ₹10L figure approximates the base Tarun tier, not independently verified against a primary SIDBI source (same caveat as the ₹20L figure above) |

---

## 3. Income assessment

The single biggest gap between borrower reality and lender arithmetic. Lenders
assess **documented** income. The app tracks both, and never lets them merge.

| Income type | Lender-assessed income | Borrower's true income | Why | Source |
|---|---|---|---|---|
| Salaried | Net monthly credit as stated | Same | Salary is documented and stable; the two numbers agree. | my judgement |
| Self-employed | **ITR annual ÷ 12**, plus **25%** of the banked-but-undeclared cash gap **only if** GST registration *and* a business current account exist | **Bad-month** cash income, not the average | Lenders lend against ITR. Ravi declares ₹4.2L (₹35,000/m) but takes ₹40–80k. The 25% add-back is what a good NBFC underwriter will actually credit against banking evidence, and zero without that evidence. | 25% figure is **my judgement**. ITR-primacy: [LAP eligibility documentation norms](https://cleartax.in/s/loan-against-property-interest-rates) |
| Gig / platform | **70%** of stated monthly earnings, and only if there is 6+ months of platform payout history | **Bad-month** income | Platform earnings are real but volatile and unverifiable at the counter; the discount is the price of that. | my judgement |
| Informal / cash, undocumented | **50%** of stated, and most formal lenders will assess **zero** | Bad-month income | Being honest that the formal system will not see this income at all is more useful to the borrower than pretending it will. | my judgement |
| Co-applicant | Added in **full** | Added at **50%** | A co-applicant's salary genuinely raises eligibility. It does not equally raise safety, the household still has one set of expenses and the co-applicant may have their own plans. | my judgement |

**A deliberate consequence.** For informal income this 50% discount can put the estimated lender-side maximum *below* what the borrower could actually safely carry. It is the one income type where the usual "a lender offers more than is safe" relationship runs the other way. This is not tuned away: 50% is already generous, since many formal lenders assess this income at zero. The app never hardcodes which of the two numbers is larger, and the Statement always points at whichever actually binds (see `StatementScreen.tsx`'s `bindingCap`).

Worth being precise about who this applies to: it does **not** happen to Anita, the persona closest to it. Once her real household costs are stated, those costs collapse `safeMax` far enough that `lenderMax` stays the larger number for her too. The inversion is still real and reachable, and `affordability.test.ts` carries a dedicated low-outgoing informal borrower that proves it, but it is not Anita's case. Stated here rather than claiming a persona result the numbers do not support.

| Rule | Value | Why | Source |
|---|---|---|---|
| **the bad-month rule** | When a range is given, use the **low end**, not the mean | Anita earns ₹26–30k. Budgeting to ₹28k means a ₹26k month is a missed EMI. This is the core of the borrower-side model. Not a named constant: it is a selection rule `income.ts` applies, not a numeric threshold. | my judgement |
| `VOLATILE_INCOME_TYPES` | self-employed, gig, informal | These get the bad-month rule and the volatility haircut in §6.2. | my judgement |
| `PRODUCTIVE_UPLIFT_HAIRCUT` | Count **50%** of stated extra earnings, capped at **30%** of current income, and only from month 4 | Anita's scooter really will earn more. But borrowers overestimate, delivery rates change, and the loan starts repaying immediately while the earnings ramp. Half, capped, delayed. | my judgement: the most arguable number in this document |

---

## 4. The rate band

Built as a base band plus a list of `{delta, why}` adjustments, so the final
number carries its own derivation.

### 4.1 Credit score tier

**Read the Source column carefully here.** The published rate cards give *rate
ranges by score band*. They do not give deltas. Every number in this table is my
interpolation, chosen to land inside the published ranges when applied to the
product's base band, so the shape of the curve is source-backed and the exact
values are not. Labelling these as sourced would be the kind of borrowed
authority this document is supposed to avoid.

| Score | Delta on base | Source |
|---|---|---|
| 780+ | **0.0 pp** (base) | model assumption, interpolated from [750+ sees the 9.99–11% floor](https://www.onepaisa.in/articles/personal-loan-interest-rate-comparison-india-2026) |
| 750–779 | **+0.4 pp** | model assumption, same range |
| 700–749 | **+1.8 pp** | model assumption, interpolated from [700–749 → 12–14%](https://moneyscore.in/blog/good-cibil-score-for-personal-loan-india) |
| 650–699 | **+5.0 pp** | model assumption, interpolated from [650–699 → 16–20%](https://freed.care/blog/personal-loan-650-cibil-score-india) |
| Below 650 | **+9.0 pp**, and unsecured is usually declined | model assumption, same source |
| **"I don't know my score"** | Priced as a band: cautious 680, favourable 760, see §9 | my judgement |
| **"I have never borrowed" (thin file)** | **+3.0 pp** on secured; unsecured largely unavailable. A thin file is *not* a bad file and must not be priced as one, but it is not a good file either, since there is nothing to underwrite against, which is why collateral changes a thin-file answer so much | my judgement |

The distinction between *don't know* and *never borrowed* is deliberate. Ravi is
the second; most people who tick "I don't know" are the first.

### 4.2 Profile adjustments

| Factor | Delta | Why | Source |
|---|---|---|---|
| Salaried, large employer, ≥3 years | 0.0 | Baseline. | my judgement |
| Salaried, small employer or <2 years | +0.75 | Job-stability proxy that underwriters do apply. | my judgement |
| Self-employed, ITR + GST, 3+ years vintage | +1.25 | Documented but lumpier than salary. | my judgement |
| Self-employed, thin documentation | +3.00 | No ITR or no banking trail means the lender is pricing uncertainty, not risk. | my judgement |
| Gig, documented payout history | +4.00 | Real earnings, but unverifiable at a counter and variable week to week. | model assumption: the direction is supported by [gig borrowers being priced meaningfully above GST-documented ones](https://indiacorplaw.in/2025/07/19/rbis-revised-digital-lending-guidelines-strengthening-guardrails-in-an-evolving-ecosystem/); the magnitude is mine |
| Informal, undocumented | +8.00 | Where a lender lends at all, it prices the absence of evidence. | my judgement |
| Card utilisation > 70% | +1.50 | Utilisation is the strongest short-horizon distress signal after a bounce, and moves pricing even at a high score. | my judgement |
| Card utilisation 30–70% | +0.60 | Normal use, mild signal. | my judgement |
| Card utilisation < 30% | 0.00 | Healthy use. No adjustment. | my judgement |
| Any EMI/cheque bounce in last 12 months | +2.50 | The single strongest repayment signal a borrower can self-report. | my judgement |
| Bounce in last **3** months | Hard stop, see §7 | Too recent to price; it changes the verdict rather than the rate. | my judgement |
| 3+ hard enquiries in last 6 months | +0.50 | Shopping hard for credit reads as needing it. | my judgement |
| Secured, LTV > 70% | +0.75 | Thin equity cushion if the valuation is optimistic. | my judgement |
| Secured, LTV ≤ 50% | −0.50 | A large equity cushion genuinely lowers the lender’s loss-given-default. | my judgement |

### 4.3 Band width

| Rule | Value | Why | Source |
|---|---|---|---|
| `BAND_FLOOR_WIDTH_PP` | **1.2 pp** minimum | Even a fully-answered profile does not get a point estimate. Lenders differ by more than a point on identical files. Showing a single number would be a lie about our own precision. | my judgement |
| Band widening | Comes out of the two-pass evaluation (§9), not from a fixed multiplier | | |

### 4.4 APR

| Rule | Value | Why | Source |
|---|---|---|---|
| Method | Solve monthly IRR on the real cash flow by bisection, then **× 12** | Matches the RBI KFS method so the two documents can be compared line to line. | [§1](https://vinodkothari.com/2024/04/the-key-to-loan-transparency-rbi-frames-kfs-norms-for-all-retail-and-msme-loans/) |
| Cash flow | `t=0`: sanctioned amount **minus** processing fee, GST on fee, and any bundled insurance. `t=1..n`: the EMI | Fees deducted at disbursal are the normal Indian practice and the reason APR ≫ headline rate on short tenures. | my judgement on the deduction convention |
| GST on fees | **18%** | Standard rate on financial services fees. | Statutory |
| Processing fee modelled as a **range** | Cautious: 2% of sanction. Favourable: flat ₹6,500 | HDFC charges a flat ₹6,500 on personal loans; ICICI charges up to 2%. On ₹6.5L that is ₹6,500 vs ₹13,000, a real spread that belongs in the band rather than being averaged away. | [HDFC flat fee; ICICI up to 2%](https://www.bankbazaar.com/personal-loan-interest-rate.html) |
| Insurance | Counted **only if** the borrower says it was bundled; then added to `t=0` in full | Bundled credit insurance is the most common hidden APR inflator, and it is inside RBI's APR definition. | [§1](https://vinodkothari.com/2024/04/the-key-to-loan-transparency-rbi-frames-kfs-norms-for-all-retail-and-msme-loans/) |
| Excluded | Penal charges, foreclosure fees, stamp duty | Contingent and statutory, RBI excludes them, so we do too, and list them separately on the Card. | [§1](https://vinodkothari.com/2024/04/the-key-to-loan-transparency-rbi-frames-kfs-norms-for-all-retail-and-msme-loans/) |

**Worked check** (this is a test case in `money.test.ts`):
₹6,50,000 · 36 months · 11.5% nominal · 2% fee + 18% GST = ₹15,340 deducted.
EMI ₹21,433. Net disbursal ₹6,34,660. Monthly IRR ≈ **1.0973%** → **APR 13.17%**.
The 1.67pp gap between 11.5% and 13.17% is the fee, and it is what the borrower
is never shown at the counter.

---

## 5. Estimated lender-side maximum: `lenderMax`

**Terminology, and it is load-bearing.** This number is a *model of how a lender
is likely to behave*, produced from assumptions this document sets out. It is not
an approval, a sanction, an eligibility, or a promise. The app says **"estimated
lender-side maximum"** or **"likely lender range"** and never "you will get",
"the lender will sanction", "you are eligible for", or "guaranteed". No lender is
bound by anything here, and a real underwriter sees data (bureau file, bank
statements, employer checks) that this app never touches.

The formula below is unchanged, this section is a correction to how the output
is described, not to how it is computed.

| Rule | Value | Why | Source |
|---|---|---|---|
| FOIR, salaried, net ≥ ₹50,000/m | **50%** | The conservative end of the published band, so we under-promise rather than over-promise on someone else's decision. | model assumption, from [lenders keep FOIR at 50–55% for salaried above ₹50k](https://precisa.in/blog/foir-fixed-obligation-to-income-ratio/) |
| FOIR, salaried, net < ₹50,000/m | **40%** | Low absolute income leaves less residual after a 50% bite, so lenders tighten. | model assumption, from [40–50% is the usual range](https://www.bankbazaar.com/personal-loan/fixed-obligations-to-income-ratio-foir.html) |
| FOIR, self-employed | **45%** on assessed (ITR) income | Between the salaried tiers: documented, but lumpier. | my judgement |
| FOIR, gig / informal | **35%** on assessed income | Volatile earnings get less cash-flow cover from any lender that lends at all. | my judgement |
| Secured products | **+5 pp** on the above | Collateral makes lenders more relaxed on cash-flow cover. | my judgement |
| `FOIR_ABSOLUTE_CAP` | **55%** | A hard ceiling regardless of tier. | source-backed: [above 55%, approval odds fall sharply](https://precisa.in/blog/foir-fixed-obligation-to-income-ratio/) |
| Available EMI | `FOIR × assessed income − existing EMIs` | The standard eligibility arithmetic. | industry practice |
| Converted to principal at | **Top** of the rate band, over the product's **maximum** tenure | Maximum tenure produces the largest number, which is what a lender quotes. Top-of-band rate stops us overstating it. | my judgement |
| Then floored by | Product LTV (the **lender's** 70% for LAP, not our advised 60%), income multiple, absolute cap | Whichever cap binds first. | §2 |

`lenderMax` is a **model of someone else's likely behaviour**, not a
recommendation and not a prediction we stand behind. The UI never presents it as
a target, and §5's opening paragraph fixes the wording it must use.

---

## 6. What the borrower can safely carry: `safeMax`

This is the number the app actually recommends, and the whole reason the product
exists.

### 6.1 Surplus

```
surplus = trueIncome − rent − householdExpenses − existingEMIs
```

`trueIncome` uses the **bad month** for volatile earners (§3).

**Definition, `householdExpenses`.** Everyday running costs of the household:
food, utilities, phone and internet, transport, school fees, medical, domestic
help. It **excludes rent** and **excludes existing loan EMIs**, because both are
subtracted separately on the same line. Nothing may appear in two of those three
terms. Must-question #7 (§10.1) is worded to make the exclusion explicit at the
point of asking, and `UNKNOWNS.householdExpenseRatio` in `constants.ts` carries
the same definition in its comment, so it cannot drift.

### 6.2 Commit fraction

How much of that surplus we are willing to hand to a new EMI.

The bands below are **half-open and exhaustive**: every non-negative number of
months falls in exactly one, with no gap and no overlap. A negative input is
clamped to 0. `constants.ts` implements them as `COMMIT_BY_SAVINGS_MONTHS`, a
descending first-match table; the two must be read as the same rule.

| Rule | Value | Why | Source |
|---|---|---|---|
| `COMMIT_BASE` | **50%** of surplus | The other half is what absorbs a delayed salary, a hospital week, a festival month or a school fee. Committing more than half of discretionary surplus to a fixed obligation is how a solvent borrower becomes a defaulting one. This is the single most important judgement call in the model. | my judgement |
| Emergency savings **0 to <1 month** | **35%** | Nothing to absorb a shock, so the loan itself has to carry the buffer. | my judgement |
| Emergency savings **1 to <3 months** | **45%** | Something behind them, but less than the 3-month buffer target. | my judgement |
| Emergency savings **3 to <6 months** | **50%**, this is `COMMIT_BASE` | The baseline case. A borrower at the `EMERGENCY_BUFFER_TARGET_MONTHS` of 3 months gets the unmodified rule. | my judgement |
| Emergency savings **6 months and above** | **60%** | A real buffer earns real headroom. | my judgement |
| Emergency savings **unknown** | Not priced here. The unknown is carried as a *number of months* (§9) and resolves through the four bands above like any stated answer. | One mechanism, not two. An unknown that took its own shortcut to a fraction could disagree with the table, and did, before this was corrected. | my judgement |
| Volatile income type | **−5 pp** | A bad month is likelier, so more of the surplus has to stay uncommitted. | my judgement |
| 3 or more dependents | **−5 pp** | More people relying on the same surplus, and less of it is genuinely discretionary. | my judgement |
| Any bounce in last 12 months | **−10 pp** | A bounce is evidence the current obligations are already too tight. | my judgement |
| `COMMIT_FLOOR` / `COMMIT_CEILING` | 25% / 60% | Bounds so stacked penalties cannot drive it absurd. | my judgement |
| `EMERGENCY_BUFFER_TARGET_MONTHS` | **3 months** of expenses | The commonly cited floor for household resilience; used for the buffer warning and as the band boundary above. | my judgement |

Boundary behaviour, stated so it can be tested: **0 → 35%**, **1 → 45%**,
**3 → 50%**, **6 → 60%**. Each boundary belongs to the band it opens.

### 6.3 EMI ceiling and prudent tenure

`emiCeiling = min(commitFraction × surplus, TOTAL_EMI_CAP × trueIncome − existingEMIs)`,
rounded **down** to the nearest ₹500.

**These are two different tests, not one rule written twice.** They are a
conjunction, the binding one wins, and they use different denominators:

| Constraint | Denominator | What it protects |
|---|---|---|
| `commitFraction × surplus` | **Surplus**, what is left after rent, household costs and existing EMIs | The borrower's remaining month-to-month breathing room. It asks: *of the money genuinely spare, how much may become a fixed obligation?* |
| `TOTAL_EMI_CAP × trueIncome − existingEMIs` | **True income**, the whole earning, before any deduction | Total debt service as a share of everything earned. It asks: *how much of this person's income should be going to lenders at all?* |

| Rule | Value | Why | Source |
|---|---|---|---|
| `TOTAL_EMI_CAP` | Existing + new EMI ≤ **40%** of true income, always | A ceiling on total debt burden that holds even for a borrower with low rent and low expenses, whose surplus test alone would permit far more. Set below the FOIR a lender uses (§5) and applied to *true* income rather than assessed income. | my judgement |

Both subtract existing EMIs, which looks like double-counting and is not: one
subtracts them to find spare cash, the other to find remaining debt-service
headroom. Neither is redundant, for a borrower with cheap rent the total-EMI cap
binds, and for one with high rent the surplus test binds.

`safeMax` is the principal that ceiling supports at the **middle** of the rate
band over the **prudent** tenure, not the maximum tenure:

| Purpose | Prudent tenure | Why | Source |
|---|---|---|---|
| Wedding, medical, travel, consumption | **36 months** | Consumption debt should not outlive the memory of what it bought. Stretching it lowers the EMI and raises the total cost, which is exactly the trade lenders push. | my judgement |
| Vehicle | **48 months** | Roughly matched to useful life. | my judgement |
| Business / productive | **36 months** | Matched to a stock cycle rather than an asset life. | my judgement |
| Home / LAP | **180 months** | Matched to the life of the asset rather than to a spending event. | my judgement |

The app always shows the maximum-tenure option too, with the extra interest in
rupees, so the borrower makes the trade with their eyes open. It just doesn't
recommend it.

**Age caps the prudent tenure further.** Tenure should not run past a borrower's
working life, so must-question #8 (§10.1) feeds a cap on top of the prudent
tenure above:

| Rule | Value | Why | Source |
|---|---|---|---|
| `RETIREMENT_AGE` | Salaried tenure capped at **60**; self-employed / gig / informal at **65** | Common Indian lender norm, tenure should not run past a borrower's working life. | model assumption |
| `MIN_TENURE_FLOOR_MONTHS` | **12 months**, floor | If age has already passed the retirement figure above, the tenure math still needs a positive, computable number rather than zero or negative. | my judgement |

`ageTenureCapMonths(incomeType, age) = max(MIN_TENURE_FLOOR_MONTHS, (RETIREMENT_AGE − age) × 12)`,
applied to whichever tenure `computeLenderMax` and `computeSafeMax` would
otherwise use (the product max and the prudent tenure above, respectively).
It never widens either. An unstated age caps nothing. None of the three assignment
personas are old enough for this to bind; `affordability.test.ts` carries a
dedicated older-borrower case so the rule is provably live rather than
decorative.

---

## 7. The verdict: O1

Ordered gates. First match wins. Each gate returns its own sentence.
Gates are evaluated on the **cautious** pass (§9), a deliberate asymmetry: we
will tell someone to slow down on incomplete information, but we will not tell
them to go ahead on it.

### 7.0 What a hard-stop gate is allowed to read

**Cautious placeholders size the numbers. Only stated facts trigger a hard stop.**
(`HARD_STOP_GATES_REQUIRE_STATED_INPUTS` in `constants.ts`.)

A §7.1 gate may fire only when every input its condition depends on was actually
answered by the borrower. Where an input is unknown, its cautious placeholder
(§9) still shrinks `safeMax`, the rate band and the EMI ceiling, but it may not
by itself produce a refusal.

This is not a softening of the model; it is the §9 rule *"unknown is never zero"*
applied where it matters most. A cautious placeholder of zero savings is a device
for widening a range downward. Letting it satisfy a gate written as
`savings = 0` silently converts it into an assertion that the borrower has no
savings, which is exactly the substitution §9 forbids, and the same reasoning
that already stops us inventing an unstated bounce.

Concretely, without this rule Priya (₹1,10,000 net, 780 score, one car EMI)
would be refused outright for a wedding loan purely because she skipped the
optional savings question, since a wedding is consumption and ₹8,00,000 exceeds
2× her monthly income. That is a wrong verdict on the highest-weighted output,
justified by a sentence asserting something she never said.

Unknowns still have teeth: they widen the band, they lower the cautious end, and
the Statement names each one and what it is costing. They just do not refuse.

### 7.1 Don't borrow

| Gate | Condition | Requires stated | Why | Source |
|---|---|---|---|---|
| Negative surplus | Surplus after the new EMI < 0 | income, rent, household expenses, existing EMIs | Nothing else needs saying. All four are must-questions, so this normally holds; if one was skipped the gate stands down and the range widens instead. | my judgement |
| Already over-committed | Existing EMIs > **50%** of true income | existing EMIs, income | Beyond this, more credit is not a solution to anything. Both are must-questions and §9 never fabricates an EMI, so this gate is always live. | my judgement |
| Fresh distress | Any bounce in the **last 3 months** and the ask is unsecured | bounce history | A bounce three weeks ago plus a new unsecured application is the profile of a debt spiral. Lenders will mostly decline anyway; the app should say why rather than let them collect a rejection and a hard enquiry. §9 never assumes an unstated bounce, so this only ever fires on something the borrower told us. | my judgement |
| No buffer, pure consumption | Emergency savings **stated as** 0 **and** purpose is consumption **and** ask > 2× monthly income | **emergency savings** | The gate that motivated §7.0. It is a real signal when someone says they have nothing put by; it is not a signal when they simply did not answer. Unanswered leaves the borrower in "borrow less" with a wider band and savings named as the unknown that would tighten it most. | my judgement |

### 7.2 Fix something first

| Gate | Condition | Why |
|---|---|---|
| Costlier debt outstanding | Existing debt at **> 24% APR** and a cheaper product is available for the same borrower | Borrowing at 18% while carrying 30% app loans makes the balance sheet worse even though the new loan looks cheap. The verdict names the order: clear the 30% first, or refinance it, then come back. This is Anita's case. |
| Productive loan behind distress | The loan would genuinely earn (§3 uplift) **but** a §7.1 gate is close to firing | Refusing outright is unhelpful when the asset pays for itself. The app gives the sequence and a smaller amount, not a flat no. |

`COSTLY_DEBT_THRESHOLD = 24% APR`, **my judgement**. Chosen because it is
roughly where regulated NBFC unsecured pricing tops out (§2), so anything above
it is either a distress product or a fintech app loan, and is almost always
worth refinancing first.

### 7.3 Different product

Fires when §2.1's secured override or scheme check finds a materially better
route. Ravi is the intended case, and the expected output is **not** simply
"take a LAP": it is *Mudra first at ₹15L collateral-free, LAP only if that is
refused, and be clear that a LAP puts the shop itself at risk.*

### 7.4 Borrow less

Fires when `ask > safeMax`. Returns the safe number and the one-sentence reason
for the gap.

### 7.5 Borrow

Everything passed and `ask ≤ safeMax`.

---

## 8. Stress tests

| Scenario | Magnitude | Why | Source |
|---|---|---|---|
| Income drop | **−20%** | Roughly a lost variable component for a salaried borrower, or two bad weeks for a gig worker. Large enough to bite, small enough to be likely. | my judgement |
| Rate rise | **+2.0 pp** | Only applied to floating-rate products. Comparable to a full tightening cycle. | my judgement |
| Failure condition | Post-EMI surplus goes negative, or total EMI crosses 50% of stressed income | | my judgement |

The Statement shows exactly one stress case, whichever fails harder, because
two is a table nobody reads.

---

## 9. Unknowns: "unknown is never zero"

Missing answers are **not** defaults. Each unanswerable input has a cautious
value and a favourable value; the engine runs end to end on both, and the two
results are the band the borrower sees.

| Unknown | Cautious | Favourable | Why not a single default | Source |
|---|---|---|---|---|
| Credit score, "don't know" | 680 | 760 | Someone who doesn't know their score is far more likely to be ordinary than bad. Treating it as 300, or as 750, both lie. | my judgement |
| Credit score, "never borrowed" | thin-file rule (§4.1) | thin-file rule | Not a number at all. A thin file is a different underwriting problem from a low score. | my judgement |
| Card utilisation | 70% | 10% | Unstated utilisation is as likely to be high as low, and it moves the rate either way. | my judgement |
| Emergency savings | **0 months** | **6 months** | Carried as a number of *months* and resolved through the §6.2 bands exactly as a stated answer would be, 0 → 35%, 6 → 60%. There is no separate path that assigns a commit fraction directly to "unknown"; one existed and disagreed with the table, and has been removed. | my judgement |
| Household expenses | 45% of income | 30% of income | Wide on purpose. Self-reported expenses are the least reliable input in the whole model. Same definition as §6.1 throughout: everyday running costs **excluding rent and existing EMIs**, which are subtracted separately. | my judgement |
| Bounce history | none in 12m | none in 12m | Deliberately **not** widened. Assuming an unstated bounce would be inventing distress. | my judgement |
| Existing EMIs | as stated, or 0 | as stated, or 0 | If they say zero we believe them; this is the one input a borrower reliably knows. | my judgement |
| Income stability / vintage | bottom of the stated bracket | top | Where a bracket was given but not a precise figure, price both ends rather than the midpoint. | my judgement |

**Verdict uses the cautious pass. Amounts and rates are shown as the full band.**
**But see §7.0**: a cautious placeholder may lower a number, never fire a
hard-stop gate on its own. Refusals come from what the borrower stated.

The Statement names every unknown still open and what it is costing, so the
borrower can see the price of not knowing rather than just a wider number.

---

## 10. Questions

Ten must-questions. Every optional question must move a number or it is not
shown, and that is enforced in code, not by promise: for each unanswered
optional question the engine is re-run at that question's cautious and
favourable values, and the question is displayed only if some output differs.

### 10.1 Must set

| # | Question | Feeds |
|---|---|---|
| 1 | What is the loan for? | product routing, prudent tenure |
| 2 | How much do you want? | the ask, the verdict comparison |
| 3 | Net monthly income | everything |
| 4 | How does that income reach you? (salaried / self-employed / gig / informal) | §3 assessment, FOIR, rate adjustment, and which questions come next |
| 5 | Total EMIs you pay now, and years left | FOIR headroom, surplus, `TOTAL_EMI_CAP` |
| 6 | Rent | surplus |
| 7 | Everything else the household spends in a month, food, bills, transport, school, medical. **Not** rent, **not** loan EMIs; both are asked separately (§6.1) | surplus |
| 8 | Age | max tenure (capped at retirement), product eligibility |
| 9 | Credit score, or "don't know" / "never borrowed" | rate tier |
| 10 | Anyone financially dependent on you? | commit fraction |

Answering only these produces all four outputs with visibly wide bands and a
stated low confidence.

### 10.2 Optional set and what each moves

| Question | Moves | Shown when |
|---|---|---|
| Months of expenses you could live on | `safeMax`, EMI ceiling | always |
| Credit card utilisation | rate, APR | score ≥ 650 or unknown |
| Years at current employer | rate | salaried |
| ITR-declared income | `lenderMax`, rate | self-employed |
| Business vintage | rate, product eligibility | self-employed |
| GST registration / current account | assessed income, rate | self-employed |
| Bad-month vs good-month earnings | `trueIncome`, `safeMax` | volatile income types |
| Platform payout history length | assessed income | gig |
| Any bounce in 12 months | rate, verdict gates | always |
| Collateral owned, and its value | product routing, LTV, rate | always |
| Is the collateral your only home or livelihood? | routing override | collateral > 0 |
| Co-applicant income | `lenderMax` (full), `safeMax` (half) | always |
| What the loan will earn, if productive | `trueIncome` uplift | business/vehicle purpose |
| A quote you already have | the Card's gap line only | always |
| Large expense coming in 12 months | commit fraction | always |

### 10.3 Adaptivity

A salaried borrower never sees ITR, vintage, GST or payout-history questions:
four of the fifteen. A gig worker never sees employer tenure. A borrower with no
collateral never sees the LTV or livelihood questions. The question count for
the three personas differs by design, and the run-throughs show it.

---

## 11. What I don't know

The honest list.

1. **No bureau data.** Every score in this app is self-reported. A real bureau
   pull would change rate tiers, catch loans the borrower forgot, and surface
   enquiries. The app is a preparation tool, not an underwriting decision.
2. **No bank statements.** Household expenses and cash income are self-reported
   and are the weakest inputs in the model. §9 widens them hard for this reason,
   but widening is not the same as knowing.
3. **The commit fraction is the whole model, and it is a judgement.** 50% of
   surplus is defensible and it is not derived from data. A lender would call it
   conservative; a financial planner might call it loose. If one number in this
   document deserves an argument, it is this one.
4. **The productive-income uplift is the shakiest rule.** Half of stated extra
   earnings, capped, delayed. It is applied to Anita, whose whole case rests on
   it, and I have no data behind the haircut.
5. **The informal-income path is the weakest part of the model.** It is also the
   path where the borrower most needs help. The app currently tells Anita mostly
   what she cannot have. That is honest, but it is not yet useful enough.
6. **Rate bands are national approximations.** Actual pricing is regional,
   channel-dependent, and moves with campaigns. A borrower in Hubballi and one in
   Bengaluru with identical files will not get identical quotes.
7. **No RBI-mandated affordability test exists.** Everything in §5 and §6 is
   constructed from practice and judgement. Only §1 is law.
8. **Two §1 claims rest on secondary sources.** The APR IRR×12 method and the
   ₹20L Mudra limit are taken from a law-firm analysis and a tax-portal summary
   respectively. The primary RBI circular PDF returned a CAPTCHA and could not
   be read directly. Both are marked *source-backed (secondary)* rather than
   source-backed, and the APR method is load-bearing, if it is wrong, every
   APR in the app is wrong by roughly 0.8pp.
9. **Rates are a September 2026 snapshot** with repo at 5.25%. There is no live
   data feed; the constants will drift and the app does not know it.
10. **The score-tier deltas and profile adjustments in §4 are interpolations.**
    The published sources give rate ranges by band; the deltas that reproduce
    those ranges are mine. The curve's shape is evidenced, its exact steps are
    not.

---

## 12. Language the app may not use

The model is a set of assumptions about someone else's decision. The copy has to
say that, everywhere, or the honesty in this document is undone at the last
inch.

| Never | Instead |
|---|---|
| "guaranteed", "assured", "pre-approved" | "estimated", "modelled" |
| "the lender will approve / will sanction" | "estimated lender-side maximum", "likely lender range" |
| "you will get ₹X" | "a lender may offer around ₹X" |
| "this is the rate you should get" | "a fair rate for your profile is X–Y" |
| "RBI says you can afford" | "our conservative assumption is" |
| "safe amount" used bare | "borrower-safe under these assumptions" |

The restriction is on **claims**, not vocabulary. "Approve", "sanction" and
"safe" appear throughout this document and must stay usable in explanations.
What is banned is asserting an outcome the app cannot know. This is a checkable
list, `BANNED_PHRASES` in `constants.ts`, and `personas.test.ts` scans every
`why` string the engine actually produces against it.

---

## 13. Sources

- [RBI, Key Facts Statement for Loans and Advances, 15 Apr 2024](https://rbidocs.rbi.org.in/rdocs/notification/PDFs/CIRCULARKFS1504242AE2500BAF494C2A82442B0B642705C1.PDF)
- [Vinod Kothari Consultants, KFS norms, APR inclusions/exclusions and the IRR×12 method](https://vinodkothari.com/2024/04/the-key-to-loan-transparency-rbi-frames-kfs-norms-for-all-retail-and-msme-loans/)
- [RBI (Pre-payment Charges on Loans) Directions, 2025, 2 Jul 2025](https://elplaw.in/wp-content/uploads/2025/07/Reserve-Bank-of-India-Pre-payment-Charges-on-Loans-Directions-2025-issued-on-July-2-2025.pdf)
- [RBI Gold and Silver Collateral Directions, 2025, EY impact assessment](https://www.ey.com/en_in/insights/strategy-transactions/rbi-gold-loan-guidelines-2025-impact-assessment-and-key-changes)
- [RBI Digital Lending Directions, 2025, IndiaCorpLaw analysis](https://indiacorplaw.in/2025/07/19/rbis-revised-digital-lending-guidelines-strengthening-guardrails-in-an-evolving-ecosystem/)
- [Business Standard, banks cannot charge beyond the KFS](https://www.business-standard.com/finance/news/banks-can-t-charge-additional-beyond-key-facts-statement-says-rbi-124041500993_1.html)
- [BankBazaar, personal loan rates, Sept 2026](https://www.bankbazaar.com/personal-loan-interest-rate.html)
- [OnePaisa, personal loan rate comparison by lender, 2026](https://www.onepaisa.in/articles/personal-loan-interest-rate-comparison-india-2026)
- [MoneyScore, rate by CIBIL band](https://moneyscore.in/blog/good-cibil-score-for-personal-loan-india)
- [FREED, personal loans at a 650 score](https://freed.care/blog/personal-loan-650-cibil-score-india)
- [Precisa, FOIR thresholds](https://precisa.in/blog/foir-fixed-obligation-to-income-ratio/)
- [BankBazaar, FOIR explained](https://www.bankbazaar.com/personal-loan/fixed-obligations-to-income-ratio-foir.html)
- [ClearTax, loan against property rates, 2026](https://cleartax.in/s/loan-against-property-interest-rates)
- [BankBazaar, two-wheeler loan rates, 2026](https://www.bankbazaar.com/two-wheeler-loan-interest-rates.html)
- [Paisabazaar, business loan rates](https://www.paisabazaar.com/business-loan/interest-rates/)
- [ClearTax, gold loan rates, 2026](https://cleartax.in/s/gold-loan-interest-rates)
- [ClearTax, MSME and Mudra schemes, ₹20L collateral-free limit](https://cleartax.in/s/msme-loan-scheme-2020)
- [Ruloans, home loan rates with repo at 5.25%](https://www.ruloans.com/blog/home-loan-interest-rates-in-india/)
- [CorpLawUpdates, repo rate 5.25%, June 2026 MPC](https://www.corplawupdates.in/rbi/repo-rate)
