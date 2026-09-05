/**
 * Mechanical sync check between RULES.md and constants.ts.
 *
 * SCOPE, DELIBERATELY NARROW: this checks that every UPPER_SNAKE_CASE
 * identifier RULES.md references in a code span (`LIKE_THIS`) actually exists
 * as an export of constants.ts. That is the one direction that can be checked
 * robustly with plain substring/regex work — no markdown table parsing, no
 * attempt to verify that documented VALUES match code values.
 *
 * What this does NOT catch, and why: most rules in RULES.md are documented by
 * their prose and value ("50% of surplus"), not by repeating the constant's
 * name — grepping for every export's NAME across RULES.md produces ~40 false
 * positives (verified by hand during M1b: every one of those values was
 * present, just not under its identifier). Building a name-presence check in
 * that direction would be exactly the "fragile fake solution" this check is
 * supposed to avoid, so it isn't attempted here. The reverse direction below
 * is real signal: it is how this test caught two live typos
 * (BAND_FLOOR_WIDTH -> BAND_FLOOR_WIDTH_PP, EMERGENCY_BUFFER_TARGET ->
 * EMERGENCY_BUFFER_TARGET_MONTHS) and one reference to a constant that was
 * never created (BAD_MONTH_RULE) while this test was being written.
 *
 * A value-level check (RULES.md says 50%, constants.ts says 0.5) would need a
 * real markdown-table parser and is out of scope for "small mechanical check."
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as constants from '../constants';

const here = dirname(fileURLToPath(import.meta.url));
const rulesPath = resolve(here, '../../../RULES.md');
const rulesMd = readFileSync(rulesPath, 'utf8');

function backtickedIdentifiers(markdown: string): string[] {
  const matches = [...markdown.matchAll(/`([A-Z][A-Z0-9_]*)`/g)];
  return [...new Set(matches.map((m) => m[1]))].sort();
}

describe('RULES.md / constants.ts sync', () => {
  it('every `CONSTANT_NAME` referenced in RULES.md exists as an export of constants.ts', () => {
    const referenced = backtickedIdentifiers(rulesMd);
    const missing = referenced.filter((name) => !(name in constants));

    expect(
      missing,
      `RULES.md references these as constants, but constants.ts exports no such name: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  it('found at least one identifier to check (guards against the regex silently matching nothing)', () => {
    expect(backtickedIdentifiers(rulesMd).length).toBeGreaterThan(0);
  });
});
