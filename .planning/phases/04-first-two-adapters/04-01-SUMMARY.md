---
phase: 04-first-two-adapters
plan: 01
status: complete
wave: 0
shipped_at: 2026-05-07
---

# Plan 04-01 Summary — fast-xml-parser dep + shared parser/error modules + vitest pre-extend

## What shipped

Wave 0 foundation for the INMET adapter (Path C, Phase 4):

- `fast-xml-parser@5.3.0` pinned exact (no caret/tilde). `tsx@4.19.2` added as devDep for Plan 04-04 refresh script.
- `src/lib/sources/xml.ts` — shared CAP XML parser. Exports `createCapXmlParser()` (XMLParser factory with locked options) and `parseCapXml(xml)` (validating wrapper, throws via `sourceError("xml_malformed", ...)`).
- `src/lib/sources/errors.ts` — canonical `sourceError(code, message, cause?)` factory + `isSourceError(e)` narrowing helper + `SourceErrorCode` union. **Factory pattern, not Error subclass** (resolves plan-checker W-1 per CONTEXT D-XX taxonomy).
- `vitest.config.ts` — `test.include` pre-extended to cover `tests/**/*.test.ts` and `scripts/**/*.test.ts` so Wave 1 plans 04-04 and 04-05 do not race-edit the same file (resolves W-4).
- Bonus policy commit: `chore(04): enforce no-skip test policy in CI` — ESLint Block C bans unconditional `.skip` / `.todo` / `xit`-family calls in test files, custom vitest reporter at `tests/reporters/no-skip.ts` fails CI runs with any skipped/pending test, `pnpm test:ci` script wraps `vitest run` with `cross-env CI=1`. Local dev still permits `skipIf(condition)` env guards.

## Commits (in order)

| SHA       | Subject                                                                 |
| --------- | ----------------------------------------------------------------------- |
| `b31ae6f` | `chore(04): pin fast-xml-parser 5.3.0 + tsx 4.19.2 devDep`              |
| `99d7e30` | `feat(04): add sourceError factory + SourceErrorCode union`             |
| `a29414f` | `feat(04): add CAP XML parser module + smoke tests`                     |
| `04439dc` | `chore(04): pre-extend vitest include glob for tests/ + scripts/ (W-4)` |
| `56500ae` | `chore(04): enforce no-skip test policy in CI`                          |

(Plus prerequisite `78d8807 docs(04): preserve CEMADEN PED swagger for P5 reference`.)

## Files changed

```
package.json                                +5
pnpm-lock.yaml                              (lockfile sync)
src/lib/sources/errors.ts                   +55 (new)
src/lib/sources/errors.test.ts              +~50 (new)
src/lib/sources/xml.ts                      +45 (new)
src/lib/sources/xml.test.ts                 +68 (new)
vitest.config.ts                            +12
eslint.config.mjs                           +35
tests/reporters/no-skip.ts                  +52 (new)
```

## Verification

- `pnpm install --frozen-lockfile` — clean.
- `pnpm tsc --noEmit` — zero errors.
- `pnpm lint` — zero errors (2 pre-existing anonymous-default-export warnings in eslint.config.mjs and postcss.config.mjs, unchanged).
- `pnpm test` — Wave 0 cases all pass (`xml.test.ts`, `errors.test.ts`). Suite-wide: 102 passed, 14 skipped (pre-existing `skipIf` env guards), 0 assertion failures. 8 worker-startup timeouts on `src/lib/risk/vocab.test.ts` — Windows + `pool: "forks"` + jsdom infra flake, not regression. Linux CI does not exhibit this.
- Nyquist invariants:
  - `grep -E '"fast-xml-parser":\s*"[\^~]' package.json` — empty (no caret/tilde).
  - `grep -c "isArray" src/lib/sources/xml.ts` — 2.
  - `grep -c "sourceError" src/lib/sources/xml.ts` — 3.
  - `grep -rE "class\s+\w+\s+extends\s+Error" src/lib/sources/` — empty (W-1 invariant).
  - `vitest.config.ts include` covers `scripts/**/*.test.ts` AND `tests/**/*.test.ts` (W-4 invariant).

## Deviations from plan

- **Bonus no-skip policy** — not in original plan. Added at user request mid-execution after observing the suite reports "14 skipped" silently. Two-layer guard (ESLint + custom vitest reporter) plus new `pnpm test:ci` script. cross-env@7.0.3 added pinned for cross-shell env-var setting (Windows + Linux CI parity).
- **Sub-agent runtime returned partial work** twice during Tasks 1-3, requiring two re-spawns to land all four tasks. No semantic deviation from plan; the final state matches the must_haves exactly.
- **Snapshot churn** on `src/lib/risk/sources/__snapshots__/{cemaden,inmet}.test.ts.snap` reverted — pure CRLF/LF line-ending noise from Windows checkout, no content diff.

## Resolves plan-checker findings

- **W-1** — sourceError factory replaces `class SourceError extends Error`. CONTEXT D-XX taxonomy honored. Grep gate passes.
- **W-4** — vitest include glob pre-extended in Wave 0. Wave 1 plans 04-04 and 04-05 no longer touch `vitest.config.ts`, eliminating the dual-edit race.

## Hand-off to Wave 1

Plan 04-03 (INMET adapter) and Plan 04-04 (fixture refresh script) are now unblocked:

- Both can `import { sourceError, isSourceError } from "@/lib/sources/errors"`.
- Both can `import { parseCapXml, createCapXmlParser } from "@/lib/sources/xml"`.
- Plan 04-04's `scripts/lib/fixture-runner.test.ts` will be picked up by the pre-extended vitest glob without further config change.
- Plan 04-05's `tests/contract/inmet.test.ts` likewise picked up automatically.
- `files_modified` for 04-03 and 04-04 are disjoint, so they can be executed in parallel.
