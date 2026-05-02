---
phase: 02-data-foundation
plan: 11
subsystem: deploy-provision
tags: [vercel, neon, upstash, github-actions, dns, deploy]
requires: [02-01..02-10]
provides:
  - Live production deployment at https://www.ensobrasil.com.br
  - Neon Postgres (sa-east-1) — `enso-brasil` project, `dev` branch
  - Upstash Redis REST cache
  - Custom domain `ensobrasil.com.br` (apex 307→www)
  - GitHub secrets (`INGEST_TOKEN`, `VERCEL_URL`) wired into cron + archive workflows
  - End-to-end cron-triggered ingest validated
affects:
  - 4 Vercel env vars (production scope, Sensitive)
  - 2 GitHub repository secrets
  - DNS for ensobrasil.com.br
metrics:
  duration: ~30 minutes (HUMAN-gated)
  completed: 2026-05-02
  files_changed: 0 (provision-only; no source changes)
---

# Phase 2 Plan 11: Vercel Provision + Deploy Summary

Wave 7 (HUMAN gate). User provisioned external services and linked Vercel; this
session verified end-to-end against production.

## What Shipped

### External services

- **Neon Postgres** — project `enso-brasil`, region `sa-east-1`, branch `dev`,
  pooled host `ep-late-recipe-accsij1b-pooler.sa-east-1.aws.neon.tech`. Schema
  migrated by `pnpm db:migrate` from a developer machine using the pulled
  connection string.
- **Upstash Redis REST** — region close to sa-east-1, used by edge routes for
  `snapshot:current` cache.
- **Vercel project** `carloshenriquemkts-projects/enso-brasil`, linked to
  `CarlosHenriqueMkt/enso-brasil` GitHub repo. Auto-deploy on `main` push.
- **Custom domain** `ensobrasil.com.br` (apex) + `www.ensobrasil.com.br`.
  Apex returns 307 → www; canonical URL is `https://www.ensobrasil.com.br`.

### Vercel env vars (Production, Sensitive)

- `DATABASE_URL` — Neon pooled connection string
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `INGEST_TOKEN` — `openssl rand -hex 32`

### GitHub secrets

- `INGEST_TOKEN` — same value as Vercel
- `VERCEL_URL` — `https://www.ensobrasil.com.br` (www form, NOT apex — apex
  redirect drops the `Authorization` header on cross-host hop, which 401s the
  ingest call)

### Vercel Deployment Protection

Disabled on Production. Project is a public-safety information aggregator;
SSO-style protection would 401 anonymous map readers.

## End-to-End Verification

Smoke against `https://www.ensobrasil.com.br` after Neon migration ran:

| Endpoint                          | Expected            | Actual                          |
| --------------------------------- | ------------------- | ------------------------------- |
| `GET /api/health`                 | 200 + sources list  | 200 with `stub` source          |
| `GET /api/states`                 | 200 + 27 UF rows    | 200 with 27 UF rows             |
| `POST /api/ingest` (no auth)      | 401                 | 401 `{"error":"unauthorized"}`  |
| `POST /api/ingest` (Bearer token) | 200 + ingest result | 200, 3 alerts adopted from stub |

GH Actions cron workflow `cron.yml` triggered manually via `workflow_dispatch`:
run `25242329689` succeeded in 4s, hitting prod ingest with retry logic.

## Deviations from Plan

### Migration step required developer machine

Plan implied migrations would run automatically. They don't — `vercel env pull`
masks Sensitive vars as empty strings, so a developer must paste the Neon URL
into a one-shot `DATABASE_URL=... pnpm db:migrate` command. Documented in 02-10
supplement, lesson #3.

### `VERCEL_URL` secret uses www, not apex

Apex does HTTP 307 → www, and `curl -L` follows but strips the `Authorization`
header on cross-host redirect (security default). Setting the secret to apex
would break ingest auth in CI. Used `https://www.ensobrasil.com.br` directly.

## Threat Flags

- **Production token exposure during this session.** The 64-hex `INGEST_TOKEN`
  was generated locally and printed once for transcription into Vercel + GH
  secrets. If the operator's terminal scrollback or shell history is shared,
  rotate the token (`openssl rand -hex 32`) and re-set both secrets.
- **Sensitive var pull masks values.** Anyone with `vercel` CLI access reading
  `vercel env pull` output sees empty strings — they cannot be used for an
  attack but also cannot be used for legitimate local migration. Source
  secrets from Neon/Upstash dashboards instead.

## Self-Check: PASSED

- Neon migration: ran, all 4 tables created
- 4 Vercel env vars: set (Production, Encrypted)
- 2 GH secrets: set (`INGEST_TOKEN`, `VERCEL_URL`)
- DNS: `ensobrasil.com.br` + `www.ensobrasil.com.br` both resolve, www returns 200
- Smoke: 4/4 endpoints behave as contracted
- Cron workflow: triggered green in 4s

## Follow-Ups

- **Real source adapters (Phase 4).** Currently only the `stub` source is
  registered. CEMADEN + INMET adapters land in P4; ingest results will then
  show real alert counts.
- **Risk engine (Phase 3).** `snapshot_cache` rows currently use
  `formulaVersion: "v0-placeholder"` because the risk formula isn't wired.
  Phase 3 replaces the placeholder with the documented v0.1 risk function.
- **Cron actually fires every 15 min.** Confirmed via manual dispatch; the
  scheduled trigger should kick at the next 15-min boundary. Watch first auto
  run in `gh run list --workflow=cron.yml`.
- **Daily archive.** `archive.yml` runs once per day; verify after 24h with
  `SELECT count(*) FROM snapshot_archive`.
