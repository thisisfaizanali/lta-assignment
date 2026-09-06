# Borrower Copilot

A borrower-side self-assessment tool for Indian retail credit. Before you walk
into a lender, it answers four questions in plain rupees: **should you borrow
at all, how much are you really eligible for, what's a fair rate for you, and
what EMI should you agree to** — then hands you a one-page card to negotiate
with. No login, no credit bureau pull, no data stored: everything runs from
what you type, in your browser, and nothing leaves it.

Built for the Lokta Borrower Copilot Challenge.

## What it does

You answer an adaptive set of questions — a salaried employee and a
self-employed shop owner see different questions, and every optional one is
only asked if it can actually change your result. As you answer, a live
estimate updates in real time. At the end you get a Key Fact Statement (the
same document RBI requires lenders to give you, written by you, first) with:

- **A verdict** — borrow, borrow less, fix something first, a different
  product, or don't borrow. "Don't borrow" is a real, reachable outcome.
- **Two different maximums** — what a lender's own rule would likely permit,
  and what you can actually carry without wiping out your buffer. These are
  computed independently and are often far apart; the app tells you which one
  to use.
- **A fair rate band and the honest APR** — a range, not a point, plus the
  all-in cost once fees and GST are folded in, so you can compare a lender's
  quote against something real.
- **An EMI ceiling**, the tenure trade-off, and one stress test (income drop
  or rate rise).
- **A Negotiation Card** — one screen, phone-sized, built to be held up at a
  branch.

Try [RUNTHROUGHS.md](RUNTHROUGHS.md) for the three worked examples (Priya,
Ravi, Anita) with real numbers from the app, or run it yourself below.

## Key design and engineering decisions

- **Rules and presentation are two separate layers, on purpose.** Everything
  under `src/rules/` — every threshold, every formula, every decision gate —
  has zero React imports and no UI concerns. The UI (`src/ui/`, `src/App.tsx`)
  only ever calls `runEngine(answers)` and renders what comes back. This is
  what makes a rule changeable in one place, and it's what a follow-up
  conversation about "change this assumption" would touch: one file,
  `src/rules/constants.ts`.
- **Unknown is never zero, and it's never assumed favourable either.** Every
  input a borrower could skip has a documented *cautious* and *favourable*
  resolution (`UNKNOWNS` in `constants.ts`). The engine runs the whole
  pipeline twice and the two results become the band you see — the width of
  every range you see is a direct, honest measure of what you haven't told it.
- **A cautious placeholder can shrink a number. It can never trigger a
  refusal.** A "don't borrow" verdict only fires on something you actually
  stated — never on a filled-in guess for something you skipped. This was a
  real bug caught and fixed during engine testing (see RULES.md §7.0):
  without it, skipping one optional question about savings would have
  produced a false "don't borrow" for a financially healthy borrower.
- **The lender's number and your number are different formulas, not one
  formula with a haircut.** `lenderMax` models FOIR against *assessed*
  (documented) income; `safeMax` models real surplus against *true*
  (bad-month) income. For a salaried borrower they're close. For a
  self-employed or informal-income borrower they can differ by several times
  over — because that gap is the actual, real-world problem this app exists
  to make visible.
- **Every optional question has to earn its place.** An optional question is
  only offered if running the real engine on its two plausible answers
  produces a genuinely different result for *this* borrower — checked by
  code, not asserted in a comment. Two people with identical must-answers can
  end up with completely different optional question sets.
- **The design is a real Key Fact Statement, not a form.** The visual
  language (transcribed in `src/ui/tokens.css` from the approved artboards in
  `design/`) is deliberately built to read like the RBI-mandated disclosure
  document a lender has to give you — because the whole thesis of the app is
  "fill it in yourself, first."

## Setup

Requires **Node 18+** (developed and tested on Node 24). No environment
variables, no backend, no database — everything runs client-side.

```bash
npm install
npm run dev         # http://localhost:5173
npm test            # ~150 tests across the rules engine
npm run typecheck
npm run build
```

Timed from a clean clone: `npm install` finishes in well under 10 seconds on
this machine, and `npm run dev` is serving within ~1 second of that — both far
inside the assignment's 5-minute requirement. Times will vary with network
speed on `npm install`'s first run elsewhere, but there is nothing else in the
setup that scales with project size — no build step before `dev`, no seed
data, no service to wait on.

## Project layout

```
RULES.md            every rule, threshold and its source — read this first
RUNTHROUGHS.md       Priya, Ravi, Anita — real app output, not illustrations
WALKTHROUGH.md       a five-minute tour of the app and the reasoning behind it
src/rules/           the financial model — zero React imports
  constants.ts         the executable half of RULES.md; the one place to
                        change a threshold
  types.ts, money.ts   shared types; pure EMI/APR/rupee-formatting math
  products.ts          product routing (§2 — Mudra-before-LAP, etc.)
  income.ts            assessed vs. true income (§3)
  rate.ts               personalised rate band + APR (§4)
  affordability.ts     lenderMax, safeMax, stress test (§5, §6, §8)
  verdict.ts            ordered decision gates (§7)
  questions.ts          the must/optional question set, adaptivity, and
                         impact-pricing (§10)
  engine.ts              orchestrates all of the above; runEngine() is the
                         single entry point the UI calls
  __tests__/            one file per module, plus personas.test.ts running
                        the three assignment personas end to end
src/ui/, src/App.tsx  the borrower-facing flow — consumes the engine,
                        computes nothing financial itself
design/                the approved artboards the UI was built from
                        (not tracked in git — see .gitignore)
```

## Limitations and assumptions

The full, itemised list — with every threshold marked source-backed, model
assumption, or my judgement — is in [RULES.md](RULES.md) §11 and §12. The
short version:

- **No bureau data, no bank statements.** Every input is self-reported.
  Household expenses and cash income are the least reliable inputs in the
  model, and are widened accordingly.
- **The commit fraction (how much of your surplus can become a new EMI) and
  the productive-income uplift haircut are judgement calls, not derived
  numbers.** They're the two most arguable constants in the whole model, and
  they're labelled as such.
- **Rate bands are September 2026 national approximations.** They will not
  match every lender, and they drift as real rates move.
- **The informal-income path is the weakest part of the model.** It's also
  where the borrower most needs help — flagged honestly rather than
  papered over.
- **This is a preparation tool, not an underwriting decision.** Nothing here
  is a sanction, and no lender is bound by any number the app shows.

## AI-use disclosure

This project was built with Claude Code as an implementation and research
assistant — including the RBI/market research behind the cited thresholds in
RULES.md, the engine, the question logic, and the UI. Every rule, threshold
and judgement call in RULES.md was reviewed, and several were corrected or
reconciled across the build (see the milestone commit history). I can defend
and change any rule live.
