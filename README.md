# Borrower Copilot

A borrower-side self-assessment tool for Indian retail credit. Before you walk
into a lender, it answers four questions in plain rupees: **should you borrow at
all, how much are you really eligible for, what's a fair rate for you, and what
EMI should you agree to**, then hands you a one-page card to negotiate with. No
login, no credit bureau pull, no data stored. Everything runs from what you
type, in your browser, and nothing leaves it.

Built for the Lokta Borrower Copilot Challenge.

## What it does

You answer an adaptive set of questions. A salaried employee and a self-employed
shop owner see different questions, and every optional one is only asked if it
can actually change your result. As you answer, a live estimate updates. At the
end you get a Key Fact Statement, the same disclosure a lender is required to
hand you, filled in by you first:

- **A verdict.** Borrow, borrow less, fix something first, a different product,
  or don't borrow. "Don't borrow" is a real, reachable outcome.
- **Two different maximums.** What a lender's own rule would likely permit, and
  what you can carry without wiping out your buffer. These are computed
  independently, are often far apart, and the app tells you which one to use.
- **A fair rate band and the honest APR.** A range rather than a point, plus the
  all-in cost once fees and GST are folded in, so a lender's quote can be
  compared against something real.
- **An EMI ceiling**, the tenure trade-off, and one stress case (income drop or
  rate rise).
- **A Negotiation Card.** One phone-sized screen, built to be held up at a
  branch.

See [RUNTHROUGHS.md](RUNTHROUGHS.md) for the three worked examples (Priya, Ravi,
Anita) with real output from the app, or run it yourself below.

## Key design and engineering decisions

- **Rules and presentation are two separate layers.** Everything under
  `src/rules/` has zero React imports and no UI concerns. The UI only ever calls
  `runEngine(answers)` and renders what comes back. Changing a rule is a
  one-line edit in `src/rules/constants.ts`.
- **Unknown is never zero, and never assumed favourable either.** Every input a
  borrower can skip has a documented cautious and favourable resolution
  (`UNKNOWNS` in `constants.ts`). The engine runs the full pipeline twice and
  the two results become the band you see, so the width of every range is a
  direct measure of what you haven't told it.
- **A cautious placeholder can shrink a number, never trigger a refusal.** A
  "don't borrow" verdict fires only on something you actually stated, never on a
  filled-in guess for something you skipped (RULES.md §7.0). Without that
  invariant, skipping one optional question about savings would refuse a
  financially healthy borrower outright.
- **The lender's number and your number are different formulas, not one formula
  with a haircut.** `lenderMax` models FOIR against assessed, documented income.
  `safeMax` models real surplus against true, bad-month income. For a salaried
  borrower they land close. For a self-employed or informal-income borrower they
  can differ several times over, and that gap is the problem this app exists to
  make visible.
- **Every optional question has to earn its place.** One is offered only if
  running the real engine on its two plausible answers moves an output for this
  borrower, checked in code rather than asserted in a comment. Two people with
  identical must-answers can get completely different optional question sets.
- **Confidence is shown honestly.** Rate bands carry a minimum width even for a
  fully answered profile, because claiming more precision than the inputs
  support would be dishonest. Where a band does collapse to a point, the app
  says which of the two possible reasons applies.
- **The interface reads as a Key Fact Statement, not a form.** That is the whole
  thesis of the app: this is the document a lender hands you at the end, so fill
  it in yourself first.

## Setup

Requires **Node 18+** (developed on Node 24). No environment variables, no
backend, no database.

```bash
npm install
npm run dev         # http://localhost:5173
npm test            # 154 tests across the rules engine
npm run typecheck
npm run build
```

Timed from a clean clone, `npm install` and `npm run dev` complete in well under
30 seconds, inside the 5-minute requirement.

## Project layout

```
RULES.md             every rule, threshold and its source; read this first
RUNTHROUGHS.md       Priya, Ravi, Anita, with real app output
WALKTHROUGH.md       a five-minute tour of the app and the reasoning
src/rules/           the financial model, zero React imports
  constants.ts       the executable half of RULES.md; the one place to
                     change a threshold
  types.ts           shared types
  money.ts           pure EMI, APR and rupee-formatting math
  products.ts        product routing (§2)
  income.ts          assessed vs. true income (§3)
  rate.ts            personalised rate band and APR (§4)
  affordability.ts   lenderMax, safeMax, stress test (§5, §6, §8)
  verdict.ts         ordered decision gates (§7)
  questions.ts       must/optional question set, adaptivity, impact
                     pricing (§10)
  engine.ts          orchestrates the above; runEngine() is the single
                     entry point the UI calls
  __tests__/         one file per module, plus personas.test.ts running
                     the three assignment personas end to end
src/ui/, src/App.tsx the borrower-facing flow; computes nothing financial
```

## Limitations and assumptions

The itemised list, with every threshold marked source-backed, model assumption,
or my judgement, is in [RULES.md](RULES.md) §11 and §12. The short version:

- **No bureau data, no bank statements.** Every input is self-reported.
  Household expenses and cash income are the least reliable inputs in the model
  and are widened accordingly.
- **The commit fraction and the productive-income uplift haircut are judgement
  calls, not derived numbers.** They are the two most arguable constants in the
  model and are labelled as such.
- **Rate bands are September 2026 national approximations.** They will not match
  every lender, and they drift as real rates move.
- **The informal-income path is the weakest part of the model.** It is also
  where the borrower most needs help, so it is flagged rather than papered over.
- **This is a preparation tool, not an underwriting decision.** Nothing here is
  a sanction, and no lender is bound by any number the app shows.
