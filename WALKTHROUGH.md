# Walkthrough

A short tour of what the app does, why it is built this way, and what I would
change next. Every threshold and its reasoning is in [RULES.md](RULES.md). Real
output for all three personas, captured from the running app, is in
[RUNTHROUGHS.md](RUNTHROUGHS.md).

## The problem

A lender has a model that decides what a borrower gets. The borrower has
nothing. They walk in blind, take the first sanction letter, and find out three
years later that they paid four points over fair and stretched to 65% of their
income.

Borrower Copilot is the borrower's half of that conversation. It answers four
questions before they walk in, and hands them one page to negotiate with.

## The flow

The borrower picks a purpose, answers ten must-questions, and gets a usable
statement. Everything after that is optional and adaptive.

Two things make the question set work. First, it branches on income type: a
salaried employee is asked about employer tenure, a self-employed borrower is
asked about ITR income, business vintage and GST evidence instead. Neither sees
the other's questions. Second, and more important, an optional question is only
offered if it can actually change that borrower's result. The Sharpen screen
runs the real engine on each candidate question's two plausible answers, diffs
the outputs, and shows the question only if something moved. The screen displays
what each one is worth before you answer it, for example "safe to carry
±₹1,20,000".

That check is code, not a promise. It also means two borrowers with identical
must-answers can end up with completely different optional question lists.

## The core idea: two maximums

This is the part of the product I care most about.

"What a lender will likely offer" and "what you can safely carry" are two
different formulas, not one number with a haircut applied to it.

The lender number models FOIR against *assessed* income, meaning what a lender
will actually credit. The safe number models real surplus against *true*
income, meaning the borrower's bad month, and deliberately leaves part of that
surplus uncommitted as a buffer.

For a salaried borrower the two land reasonably close. For everyone else they
come apart, and the gap is the whole point:

- **Priya** is cleared for roughly ₹18.6 lakh by a lender's own rule, but her
  rent, car EMI and living costs leave room for ₹4.6 to ₹8.0 lakh.
- **Ravi** is credited only his ITR income of about ₹35,000 a month, while his
  shop actually takes ₹40,000 to ₹80,000. The formal system cannot see most of
  what he earns.

Nobody at a branch volunteers that gap. The Statement shows both numbers side by
side and points at whichever one actually binds.

## Rate, APR, and the EMI ceiling

The rate is shown as a band, and stays a band even for a fully answered profile,
because claiming a single number would be claiming more precision than
self-reported inputs support. Where a band does collapse to a point, the app says
which of the two possible reasons applies: either the profile is pinned at the
product's ceiling, or the borrower answered everything that number depends on.

Underneath sits the all-in APR: the nominal rate plus processing fee and GST,
solved as an actual IRR on the real cash flow, annualised the way RBI's Key Fact
Statement does it (monthly IRR × 12, not effective compounding). That matters
because it makes our number directly comparable to the one the lender must hand
over. The gap between a headline rate and the true APR is exactly what a
fee-heavy short loan hides.

The EMI ceiling comes with the tenure trade-off laid out in rupees. A longer term
lowers the monthly number and raises the total cost. The app shows that
honestly and does not recommend the longer one just because the EMI reads better.

## The Negotiation Card

One phone-sized screen: what I am asking for, what is fair for me, why in my own
numbers, and what I will not agree to.

Type a lender's quoted rate into it and it tells you how many rupees more that is
than the middle of your own band over the real tenure. That is the line designed
to be read out loud across a desk.

Where the ask exceeds what the borrower can get, the Card says so rather than
quietly substituting a smaller number. Ravi's Card states that he asked for
₹15,00,000 and is built around ₹4,27,557.

## The three borrowers

Same engine, three genuinely different answers.

**Priya** gets **borrow less**. Her ask sits just above what she can safely
carry. She is close, not reckless, and the verdict says so.

**Ravi** gets **a different product**. He is self-employed with a ₹15,00,000 ask
that sits inside the ₹20,00,000 Mudra collateral-free limit, so the app tells him
to ask about that before pledging anything.

**Anita** gets **fix something first**. Her scooter would likely pay for itself,
but her existing app loans at 30%+ are more expensive than any rate this app
would quote her. The app refuses to let a productive purpose override that.

### The Ravi decision, stated plainly

Ravi owns his shop premises outright, worth about three times his ask, and
routing him to a loan against it was both easier to build and genuinely cheaper.
The numbers are real: LAP would price him at **12.75% to 14.0%** with a
lender-side maximum near **₹13.6 lakh**, close to his full ask, against
**15.25% to 17.05%** unsecured.

The app still declines to recommend it, because that property is not just
collateral, it is his only source of income. If the business has a bad year, a
defaulted LAP costs him the shop as well as the loan. A government scheme can
reach a comparable amount without that risk, so the app surfaces it first and
explains the trade rather than optimising for the lowest rate.

I expect this to be challenged, so the app shows the LAP numbers alongside the
recommendation instead of hiding the road not taken. The cheaper product is not
automatically the right one.

## Where it is guessing

The two numbers that matter most in the safety model are judgement calls, not
derived figures: how much of a borrower's surplus may become a fixed obligation,
and how much of a productive purpose's projected earnings to credit. Both are
labelled as judgement in RULES.md, which classifies every threshold as
source-backed, model assumption, or my judgement. Roughly a quarter are
source-backed and the rest are not, which is the honest picture of retail
lending in India, where the arithmetic is public and the underwriting policy is
not.

The informal-income path is the weakest part of the model, and it is also where
the borrower most needs help. Anita is currently told mostly what she cannot
have. That is honest, but it is not yet useful enough.

## What I'd build next

- **A refinance path for Anita.** Today the app tells her to clear 30%+ debt
  first and stops. The more useful product would size a consolidation that
  refinances the app loans and the scooter together, which is the answer she
  actually needs.
- **A question-order optimiser.** The Sharpen screen ranks by impact magnitude
  but ignores how hard a question is to answer. A borrower who does not know
  their card utilisation should not be asked for it ahead of something easier
  and nearly as valuable.
- **A second, independently sourced rate card**, to cross-check the model
  assumption tier of RULES.md's rate deltas against more than one source.
- **Local session persistence**, still device-only and never transmitted, so a
  borrower can leave and come back without starting over.

## What I'd cut if I had less time

- **The tenure trade-off table.** Useful context, but the verdict and the two
  maximums are what actually change someone's decision.
- **The live-updating rail during the question flow.** Pleasant, but the
  Statement at the end carries the real weight. The rail is polish, not the core
  claim.
- **Three of the six products.** Gold, home and unsecured business are coarse
  and marked as such in RULES.md. Only the three the personas reach are properly
  tuned, and shipping fewer, better products would have been the honest trade.
