# Borrower Copilot

A borrower-side self-assessment tool for Indian retail credit: before you walk
into a lender, it estimates whether you should borrow at all, what a lender is
likely to offer vs. what you can safely carry, a fair rate band, and an EMI
ceiling — each with a plain-language reason. See [RULES.md](RULES.md) for
every threshold and its source.

## Status

- **M1/M1b** — Financial specification (`RULES.md`) and its executable
  constants (`src/rules/constants.ts`) are complete and reconciled.
- **M2** — Money math (`src/rules/money.ts`): EMI, total interest, APR via
  bisection IRR, Indian rupee formatting. Complete.
- **M3** — The rules engine (`src/rules/{products,income,rate,affordability,
  verdict,engine}.ts`): product routing, income assessment, rate
  construction, lender-side vs. borrower-safe affordability, verdict gates,
  the cautious/favourable two-pass model, and stress testing. Complete —
  runnable via `runEngine(answers)` in `src/rules/engine.ts`, no UI yet.
- **M4** — The question graph (`src/rules/questions.ts`): the must/optional
  question set, §10.3 adaptivity, and impact-pricing (an optional question
  is only offered if it provably moves an output, checked by running the
  real engine — not asserted by a rule). Complete, still no UI.
- **M5** — Borrower-facing UI (`src/ui/`, `src/App.tsx`): the full flow —
  opening, adaptive questions with a live-updating estimate, priced optional
  questions, the four-output Statement, and the Negotiation Card — built
  directly from the approved artboards in `design/`. Manually verified end to
  end in a browser for Priya, Ravi and Anita. Complete.
- **M6 (run-throughs, walkthrough)** — not started.

## Setup

```bash
npm install
npm run dev        # placeholder UI at http://localhost:5173
npm test           # 116 tests across the rules engine
npm run typecheck
npm run build
```

## Project layout

```
RULES.md                     every rule, threshold and its source
src/rules/
  constants.ts                the executable half of RULES.md — no financial
                               threshold lives anywhere else
  types.ts, money.ts          shared types; pure EMI/APR/formatting math
  products.ts                 product routing (§2 — Mudra-before-LAP, etc.)
  income.ts                   assessed vs. true income (§3)
  rate.ts                     personalised rate band + APR (§4)
  affordability.ts            lenderMax, safeMax, stress test (§5, §6, §8)
  verdict.ts                  ordered decision gates (§7)
  engine.ts                   orchestrates the above; runEngine() is the
                               single entry point
  __tests__/                  one file per module, plus personas.test.ts
                               running the three assignment personas end to end
```

Rules are kept strictly separate from presentation: nothing under `src/rules/`
imports React, and no threshold is hard-coded outside `constants.ts`.
