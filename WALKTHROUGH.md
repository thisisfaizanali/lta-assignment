# Walkthrough

A five-minute tour of the app, timed as a recording script. Full reasoning
behind every number is in [RULES.md](RULES.md); real output for all three
personas is in [RUNTHROUGHS.md](RUNTHROUGHS.md).

## 0:00 — The problem (30s)

A lender has a model that decides what a borrower gets. The borrower usually
has nothing — they find out three years later they paid four points over fair
and stretched to 65% of their income. Borrower Copilot is a self-assessment
that makes the borrower the best-informed person in the room before they walk
in: what a lender will likely offer, what they can actually safely carry, a
fair rate, and an EMI ceiling — with a one-page card to negotiate with.

## 0:30 — Adaptive questions (60s)

*Show:* the opening screen (pick a purpose), then a few must-questions with
the live estimate rail updating on the right.

The must-set is ten questions, fixed for everyone. Everything after that
adapts: a salaried employee sees "years at your current employer"; a
self-employed borrower sees ITR income, business vintage, GST/current-account
evidence instead — never both. And every optional question is only offered if
it can actually change something: the Sharpen screen runs the real engine on
each candidate question's two plausible answers and only shows it if some
output genuinely moves. Two borrowers with identical must-answers can end up
with completely different optional question lists.

## 1:30 — Lender max vs. safe max (60s)

*Show:* the Statement screen's O2 section, ideally Ravi's (biggest gap).

This is the core of the product. "What a lender will likely offer" and "what
you can safely carry" are two *different formulas*, not one number with a
haircut applied. The lender number models FOIR against your *documented*
income. The safe number models your real surplus against your *bad-month*
income, and deliberately keeps half of it uncommitted as a buffer. For Ravi —
self-employed, ITR shows ₹35,000/month, real cash flow is ₹40,000–80,000 — the
two numbers are nearly ₹1.4 lakh apart. Nobody at a branch volunteers that gap.

## 2:30 — Rate, APR, and the EMI ceiling (60s)

*Show:* O3 and O4 on the Statement.

The rate is shown as a band, and it's a band even for a fully-answered
profile — a floor width is built in, because pretending to more precision than
the inputs support would be dishonest. Below it, the *all-in APR* — the
nominal rate plus the processing fee and GST, solved as an actual IRR on the
real cash flow, matching how RBI's own Key Fact Statement computes it. That
gap between the headline rate and the APR is exactly what a fee-heavy short
loan hides. The EMI ceiling comes with the tenure trade-off shown honestly:
stretching the term lowers the EMI and raises the total interest, and the app
doesn't recommend the longer one just because the number looks smaller.

## 3:30 — The Negotiation Card (45s)

*Show:* opening the Card from the Statement.

One phone-sized screen: what I'm asking for, what's fair for me, why (in my
own numbers), and what I will not agree to. Type in a lender's quoted rate
and it tells you exactly how many rupees more that is than the middle of your
own band, over the real tenure — the one line designed to be read out loud
across a desk.

## 4:15 — Priya, Ravi, Anita (30s)

*Show:* verdict headlines only, back to back.

Same engine, three genuinely different verdicts. Priya — salaried, strong
profile — gets **borrow less**: her ask is just above what she can safely
carry. Ravi — self-employed, sitting on unencumbered property — gets
**a different product**: the app tells him to ask about a government
collateral-free scheme *before* it will let him pledge his shop, even though
routing him straight to a cheap secured loan was the easier thing to build —
and it was genuinely cheaper: loan against property prices him at 12.75–14%
for nearly his full ₹15L ask, against 15.3–17.1% unsecured. If the assignment
rubric asks "is he routed to a secured product" and expects yes, my answer is
still no, on purpose — that property is his only income, and a defaulted LAP
costs him the shop, not just the collateral. Anita — informal income, already
carrying 30%+ debt — gets **fix something first**: her scooter would likely
pay for itself, but the app refuses to let that override the fact that her
existing debt is more expensive than any loan it would offer her.

## 4:45 — One important limitation (15s)

The two numbers that matter most in the safety model — how much of your
surplus is safe to commit, and how much of a productive purpose's projected
earnings to credit — are judgement calls, not derived from data. They're
labelled as such in RULES.md, and they're exactly the kind of thing I'd expect
to defend and change live in a follow-up conversation.

---

## What I'd build next

- A real question-order optimiser for the Sharpen screen — right now it ranks
  by impact magnitude but doesn't account for how *cheap* a question is to
  answer relative to its value.
- A second, independently-sourced rate card to cross-check the "model
  assumption" tier of RULES.md's rate deltas against more than one source.
- Persisting a session locally (still device-only, never sent anywhere) so a
  borrower can leave and come back without re-answering everything.

## What I'd cut if I had less time

- The tenure trade-off table (O4) — useful, but the verdict and the two
  maximums are what actually change someone's decision.
- The live-updating rail during the question flow — nice, but the Statement
  at the end carries the real weight; the rail is polish, not the core claim.
