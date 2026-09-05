# Run-throughs — Priya, Ravi, Anita

Every number below is real output from `runEngine()` (`src/rules/engine.ts`),
captured directly from the app — not hand-computed, not illustrative. Any
figure here should match what you see running the app with the same answers.
See [RULES.md](RULES.md) for the rule behind every number, and
[README.md](README.md) for how to run the app yourself.

Format per persona: key answers → the four outputs → major reasoning →
uncertainty still open → the Negotiation Card.

---

## Priya — salaried, strong profile

**Persona:** 29, Bengaluru, software engineer, 5 years at one employer. Net
₹1,10,000/month. One car EMI ₹14,000, two years left. Score 780. Rent ₹28,000.
Wants ₹8,00,000, unsecured, for a wedding.

**Answers given (11 of 15 possible):** all 10 must-questions, plus years at
current employer (5). Household expenses assumed at ₹24,000/month (not stated
in the brief — a plausible Bengaluru single-earner figure; flagged in RULES.md
as a self-reported estimate, not a bank statement).

**Still unresolved:** card utilisation, emergency savings, bounce history —
none of these were asked in this run-through, so the engine holds them as
unknown rather than assuming a value, and the ranges below are wider because
of it.

### The four outputs

| Output | Value | Why |
|---|---|---|
| **O1 — Verdict** | **BORROW LESS** | "You asked for more than you can safely carry. Take what's under 'safe to carry,' not the full ask." |
| **O2 — Estimated lender-side maximum** | ₹18,51,558 – ₹18,77,092 | 50% FOIR on her salaried income, at the top of her rate band, over the product's full 60-month tenure. A model of likely lender behaviour — not a sanction. |
| **O2 — Safe to carry (use this)** | ₹4,56,850 – ₹7,98,781 | Half her committable surplus, or 40% of true income minus existing EMIs — whichever binds — over a prudent 36-month term. |
| **O3 — Fair rate** | 10.0% – 11.8% | 780 score, salaried, 5 years at one employer, unsecured personal loan. |
| **O3 — All-in APR** | 10.7% – 12.3% | Nominal rate plus processing fee and GST folded in. |
| **O4 — EMI ceiling** | ₹15,000 – ₹26,000/month | 35% of her surplus is the binding limit. |
| **Stress test** | Survives a 20% income drop | She would still cover the ceiling EMI even at reduced income. |

**Tenure trade-off**, at the safe amount (₹7,98,781) and the middle of her rate
band (10.9%): 36 months → ₹26,113/month, 48 months → ₹20,606/month, 60 months →
₹17,328/month. Stretching to 60 months buys real monthly room but costs more
in total interest — the app shows this, it does not recommend it.

### Major reasoning

The gap between the two maximums is the entire point: a lender's own rule
would very likely clear her for close to ₹18.6 lakh, but her real household
budget — rent, an existing car EMI, living costs — only leaves room for
roughly ₹4.6–8.0 lakh without eating into the buffer that absorbs a bad month.
₹8,00,000 sits just above the top of that safe range, which is why the
verdict is "borrow less," not "don't borrow" — she is close, not reckless.

### What's still uncertain

Card utilisation, emergency savings and bounce history were never answered in
this run. The engine's own ranking (computed the same way the Sharpen screen
ranks them) says the highest-value remaining questions for her are: a
co-applicant (would move the verdict itself), months of savings (also
verdict-moving), and any bounce in the last 12 months (moves the rate band by
several points). None of the three that were skipped here happened to change
the verdict in this instance, but the app never assumes that in advance.

### Negotiation Card outcome

Because her ask exceeds what she can safely carry, the Card is built around
the **safe amount (₹7,98,781)**, not her original ₹8,00,000 ask — the app
never hands someone a negotiating position it has just told them not to take.
Terms: 10.0–11.8% interest, 10.7–12.3% all-in APR, EMI up to ₹26,000, over 36
months. "Because" cites her score/tenure, her single low-obligation EMI, and
the lack of recent hard enquiries — every line drawn from the same `why`
strings shown on the Statement, never freshly written for the Card.

---

## Ravi — self-employed, thin file, unencumbered collateral

**Persona:** 42, Mysuru, kirana store owner for 14 years. Cash income
₹40,000–80,000/month; ITR declares ₹4,20,000/year. Owns the shop premises
(~₹45,00,000, unencumbered) — his sole livelihood. Never taken a formal loan.
Wife earns ₹18,000 teaching (not entered as a co-applicant — nothing in the
brief says she'd co-sign). Wants ₹15,00,000 for stock and a delivery vehicle.

**Answers given (9 must + 8 optional):** purpose modelled as "business" (the
larger, defining half of his ask); net monthly income entered as his
ITR-implied figure (₹35,000) as a single best-guess answer to the general
income question, with the sharper self-employed-specific figures (ITR annual,
bad/good cash month, vintage, GST+account) given separately; credit score
answered as "I have never borrowed," not a numeric guess. Collateral
(property, ₹45,00,000, flagged as his only livelihood) was given directly.
Household expenses were **not** given — not stated anywhere in the brief.

### The four outputs

| Output | Value | Why |
|---|---|---|
| **O1 — Verdict** | **A DIFFERENT PRODUCT** | "Your ask is within Mudra's ₹20,00,000 collateral-free limit for a micro enterprise. Ask about Mudra (Tarun Plus) before considering anything secured — pledging property to raise an amount a government scheme can already cover is very likely the wrong trade." |
| **Product routed** | Business loan (unsecured) — **not** loan against property | The Mudra check runs *before* any secured-override math, and takes precedence over it entirely. |
| **O2 — Estimated lender-side maximum** | ₹5,64,819 – ₹5,70,941 | 45% FOIR on his *ITR-assessed* income (~₹35,000–36,250/month) — what a lender actually credits, not what the shop takes in. |
| **O2 — Safe to carry (use this)** | ₹1,83,722 – ₹4,27,557 | Half his committable surplus, from his real bad-month cash figure (₹40,000), over a 36-month term. |
| **O3 — Fair rate** | 15.3% – 17.1% | Unsecured business band, adjusted for a documented (GST + current account + 14-year vintage) self-employed profile and a thin credit file. |
| **O3 — All-in APR** | 17.0% – 17.6% | |
| **O4 — EMI ceiling** | ₹6,500 – ₹15,000/month | 30% of his surplus is the binding limit. |
| **Stress test** | Survives a 20% income drop | |

**Tenure trade-off**, at the safe amount (₹4,27,557) and 16.1%: 36 months →
₹15,063/month, 48 months → ₹12,150/month, 60 months → ₹10,431/month.

### Major reasoning

This is the persona the routing rule exists for. He owns unencumbered
property worth three times his ask — the naive move is to route him straight
to a cheap loan against that property. The app deliberately does not: because
he's self-employed and his ₹15,00,000 ask sits inside the ₹20,00,000
collateral-free Mudra (Tarun Plus) limit, the verdict tells him to ask about
Mudra *first*, and explains plainly that pledging his shop — his only
livelihood — to raise an amount a government scheme could already cover is
very likely the wrong trade. The quantitative numbers shown (lender max, safe
max, rate) are deliberately computed against the **unsecured** product, not a
LAP he hasn't confirmed he needs.

The gap between his two maximums is the sharpest illustration of "lender
reality vs. borrower reality" in this document: a lender credits only his ITR
(~₹35,000/month), while his real cash flow is ₹40,000–80,000/month — the
formal system simply cannot see most of what his shop actually earns.

### What's still uncertain

Card utilisation, emergency savings, household expenses and 12-month bounce
history were never answered. One finding worth being explicit about: because
Ravi is already routed via Mudra regardless of his collateral answer,
disclosing the collateral changes *only* the explanation text, not any of the
four output numbers — so the app's own "does this question move a number"
check correctly never re-offers the collateral question to him once it's
answered, even though it remains central to his case narratively.

### Negotiation Card outcome

Terms built around his safe amount (₹4,27,557): 15.3–17.1% interest, 17.0–17.6%
all-in APR, EMI up to ₹15,000, over 36 months — priced as an **unsecured**
business loan, consistent with the verdict's own advice not to pledge the shop
until Mudra is ruled out.

---

## Anita — informal income, existing distress, productive purpose

**Persona:** 35, Hubballi. Delivery-platform rider plus home tailoring — two
income sources with no single formal category, modelled here as **informal**
(the more conservative of gig/informal, since the tailoring income has no
platform-verifiable trail at all). Combined income ₹26,000–30,000/month;
₹26,000 (the low end) entered directly, per the bad-month rule. Two children
and a husband unemployed for 8 months, modelled as 3 dependents. Three app
loans, ₹35,000 outstanding at 30%+ APR (entered as existingDebtAPR = 32, a
representative point above "30%+"); an estimated ₹3,000/month EMI on that
balance (the brief gives the outstanding balance, not the monthly payment — a
necessary estimate, flagged here). One bounce last month. Wants ₹1,50,000 for
an electric scooter to increase delivery capacity.

**Answers given (9 must + 5 optional):** credit score deliberately left
unanswered — nothing in the brief states it, and the app does not infer a bad
score merely because the rest of her situation is difficult. Emergency
savings entered as 0 (a reasonable inference given 8 months on one income and
three running app loans). No rupee figure was ever given anywhere in the
brief for what "doubling delivery runs" would actually earn, so the
productive-uplift question was left unanswered — the app correctly does not
invent one.

### The four outputs

| Output | Value | Why |
|---|---|---|
| **O1 — Verdict** | **FIX SOMETHING FIRST** | "You're carrying debt at 32% APR — even our most cautious estimate for this loan (16.0%) is cheaper. Clear or refinance that debt before taking on more; a new loan doesn't fix a balance sheet that's already losing to a costlier one." |
| **O2 — Estimated lender-side maximum** | ₹77,628 | 40% FOIR on her (heavily discounted) informal income, secured by the scooter itself. |
| **O2 — Safe to carry (use this)** | ₹17,836 | 35% commit fraction (no savings, volatile income, 3 dependents, a recent bounce all pull it down), over 48 months. |
| **O3 — Fair rate** | 14.8% – 16.0% | Already pinned near the product's ceiling — informal income and a recent bounce alone account for most of the band, before any unknown is even considered. |
| **O3 — All-in APR** | 16.1% | |
| **O4 — EMI ceiling** | ₹500/month | 25% of her (very thin) surplus is the binding limit. |
| **Stress test** | **FAILS** a 20% income drop | She would come up short every month if her already-thin income dropped further. |

**Tenure trade-off**, at the safe amount (₹17,836) and 15.4%: 36 months →
₹622/month, 48 months → ₹500/month, 60 months → ₹428/month.

### Major reasoning

This is the case the "fix something first" verdict exists for, and it is
named explicitly in RULES.md §7.2 as the intended example. Her existing app
loans, at 30%+, are more expensive than *any* rate this app would quote her
for the scooter (worst case 16.0%) — so taking on a new loan without
addressing the old one makes her overall position worse, even though the
scooter itself is a productive purchase that would likely earn her more. The
verdict does not let the productive purpose override that: the app tells her
to clear or refinance the existing debt first, not to take the new loan
anyway because it "pays for itself." Her stated projected extra earnings
were never quantified, so the productive-uplift calculation correctly
contributes nothing here — the app does not credit income that was never
stated.

### What's still uncertain

Credit score and card utilisation are unresolved — and notably, *answering*
either one would not currently move any output for her: her rate is already
pinned at the product's ceiling by her informal income type and recent bounce
alone, and her commit fraction is already at its floor from the same stacked
factors. This is a real, defensible consequence of how much distress is
already reflected in her stated answers, not a flaw in the ranking — once a
profile is pessimistic enough on several independent factors, further
granular unknowns can stop changing the outcome.

### Negotiation Card outcome

Terms built around her safe amount (₹17,836) — a fraction of her ₹1,50,000
ask: 14.8–16.0% interest, 16.1% all-in APR, EMI up to ₹500, over 48 months.
"Because" cites the same costly-debt reasoning as the verdict. This is the
clearest illustration in the three run-throughs of the Card protecting a
borrower from a number they should not accept, rather than helping them
negotiate one they should.

---

## What the three run-throughs together show

- **Lender max and safe max are never forced apart or together by a rule** —
  they diverge because assessed income and true income diverge (Ravi), or
  converge because a borrower's situation is already fully determined by what
  they stated (Anita's zero-width bands). Nothing here is scripted per persona.
- **The verdict space is genuinely used**: borrow less (Priya), a different
  product entirely (Ravi), fix something first (Anita) — not just borrow/don't.
- **Unknown is never zero, and it's never assumed favourable either**: Anita's
  credit score stays unanswered rather than assumed bad; Ravi's productive
  purpose gets no uplift credit because no figure was ever given.
