# Phase 2 — Deferred Items

Out-of-scope discoveries logged during plan execution. Each line includes the
plan that observed it and the plan/owner who should resolve it.

## From 02-02 (db schema + drivers + migration)

- `src/lib/log/node.test.ts` — 10 tsc errors (TS2578 unused @ts-expect-error,
  TS2307 cannot find module './node', TS2540 NODE_ENV read-only).
  Origin: commit `5482d7a` `test(02-04): add failing tests for dual-runtime loggers`.
  This is the TDD RED phase of plan 02-04 (logger). The test file imports a
  not-yet-implemented `./node` module — failures are expected and required.
  Owner: plan **02-04** GREEN task. Do NOT fix in 02-02.
