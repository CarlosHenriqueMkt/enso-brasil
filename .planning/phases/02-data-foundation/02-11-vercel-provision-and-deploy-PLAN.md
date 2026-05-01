---
phase: 02-data-foundation
plan: 11
type: execute
wave: 7
depends_on: [01, 02, 03, 04, 05, 06, 07, 08, 09, 10]
files_modified:
  - README.md
autonomous: false
requirements:
  - REQ-S2.12
  - REQ-S2.06
  - REQ-S2.11
user_setup:
  - service: neon
    why: "Postgres database for alerts/sources_health/snapshot_cache/snapshot_archive"
    env_vars:
      - name: DATABASE_URL
        source: "Neon Console → Project → Connection String (with sslmode=require)"
    dashboard_config:
      - task: "Create Neon project named 'enso-brasil'; create 'dev' branch (P2 uses dev branch only — production branch is P7)"
        location: "https://console.neon.tech"
  - service: upstash
    why: "Redis cache for snapshot:current (REST, edge-safe)"
    env_vars:
      - name: UPSTASH_REDIS_REST_URL
        source: "Upstash Console → Database → REST API → URL"
      - name: UPSTASH_REDIS_REST_TOKEN
        source: "Upstash Console → Database → REST API → Token"
    dashboard_config:
      - task: "Create Upstash Redis database 'enso-brasil-dev'; choose region close to Vercel deployment region"
        location: "https://console.upstash.com"
  - service: vercel
    why: "Hosts Next.js + edge + node API routes"
    env_vars:
      - name: DATABASE_URL
        source: "Vercel Project → Settings → Environment Variables (paste from Neon)"
      - name: UPSTASH_REDIS_REST_URL
        source: "Vercel env vars (paste from Upstash)"
      - name: UPSTASH_REDIS_REST_TOKEN
        source: "Vercel env vars (paste from Upstash)"
      - name: INGEST_TOKEN
        source: "Generate locally with `openssl rand -hex 32`; paste into Vercel env vars + GH repo secrets"
    dashboard_config:
      - task: "Run `pnpm dlx vercel link` from repo root, choose 'enso-brasil' project; then `vercel env add` for all 4 vars on Preview + Production scopes"
        location: "local CLI + https://vercel.com/dashboard"
  - service: github-secrets
    why: "GH Actions cron + archive workflows need INGEST_TOKEN + VERCEL_URL"
    env_vars:
      - name: INGEST_TOKEN
        source: "Same value as Vercel INGEST_TOKEN"
      - name: VERCEL_URL
        source: "Vercel deployment URL (e.g., https://enso-brasil.vercel.app); use production URL"
    dashboard_config:
      - task: "GitHub repo → Settings → Secrets and variables → Actions → New repository secret (×2)"
        location: "https://github.com/<org>/enso-brasil/settings/secrets/actions"

must_haves:
  truths:
    - "User has provisioned Neon + Upstash + Vercel; 4 env vars set on Vercel Preview + Production scopes"
    - "GH repo secrets INGEST_TOKEN + VERCEL_URL are set"
    - "First deploy of main produces a Preview URL where /api/states returns 503 (cold), then 200 after manual `gh workflow run cron.yml`"
    - "/api/health returns 200 with parsed HealthReport"
    - "/api/ingest with valid Bearer token returns 200; alerts row count = 3 after first call"
    - "README.md has 'Como deployar' section listing all 4 env vars + provisioning origins (REQ-S2.12 acceptance)"
  artifacts:
    - path: "README.md"
      provides: "'Como deployar' section: lists DATABASE_URL, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, INGEST_TOKEN with source for each + step-by-step Vercel link/env-add commands"
      contains: "Como deployar"
  key_links:
    - from: "GH Actions cron"
      to: "Vercel /api/ingest"
      via: "secrets INGEST_TOKEN + VERCEL_URL"
      pattern: "Authorization: Bearer"
---

<objective>
Provision the cloud surfaces (Neon + Upstash + Vercel + GH secrets) that P2's deployed Vercel preview depends on, and document everything in README's "Como deployar" section.

Purpose: This is the only manual gate in P2. Without provisioned env vars, the cron workflow fails at the Authorization header and the cache stays empty forever. The README section is required by REQ-S2.12 acceptance.
Output: Provisioned cloud accounts + 4 Vercel env vars + 2 GH secrets + README "Como deployar" section + smoke validation.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-data-foundation/02-SPEC.md
@.planning/phases/02-data-foundation/02-CONTEXT.md
@.planning/phases/02-data-foundation/02-RESEARCH.md
@.planning/phases/02-data-foundation/02-08-SUMMARY.md
@.planning/phases/02-data-foundation/02-09-SUMMARY.md
@.planning/phases/02-data-foundation/02-10-SUMMARY.md

<interfaces>
SPEC REQ-S2.12 acceptance:
  - PR push produces Vercel preview URL
  - /api/states returns 503 immediately after deploy (cold cache)
  - After `gh workflow run cron.yml --ref <branch>` → /api/states returns 200
  - README "Como deployar" lists all 4 env vars

RESEARCH: vercel CLI 53.0.1 stable; used for `vercel link` + `vercel env add`.

P2 deploy boundary: dev Neon branch is shared between Preview AND Production scopes (production Neon branch is P7). Documented in REQ-S2.12.

Token generation: `openssl rand -hex 32` produces a 64-char hex INGEST_TOKEN. Same token goes into Vercel env vars (both Preview + Production) AND GH repo secrets (INGEST_TOKEN). VERCEL_URL goes into GH secrets only (not Vercel — it's the URL OF Vercel).
</interfaces>
</context>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1: Provision Neon + Upstash + Vercel + GH secrets (HUMAN gate)</name>
  <what-built>
    Plans 01-10 produced all the code. Cron + archive workflows are committed and waiting for secrets. Without this provisioning, none of it runs. Claude cannot create cloud accounts.
  </what-built>
  <how-to-verify>
    Step 1 — Neon (https://console.neon.tech):
      a. Create a project named `enso-brasil`.
      b. Use the default `dev` branch.
      c. Copy the connection string (`postgres://USER:PASS@HOST/DB?sslmode=require`).
      d. Locally:  `export DATABASE_URL="<connection-string>"` then `pnpm db:migrate`. Confirm success log.

    Step 2 — Upstash (https://console.upstash.com):
      a. Create a Redis database named `enso-brasil-dev`. Choose a region close to Vercel deploy region (us-east-1 is the default for Vercel free tier).
      b. From REST API tab, copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

    Step 3 — Generate INGEST_TOKEN:
      ```
      openssl rand -hex 32
      ```
      Copy the 64-char output. This goes into Vercel + GH secrets. NEVER commit it.

    Step 4 — Vercel (CLI):
      a. From repo root: `pnpm dlx vercel@53 link` — choose existing scope, project name `enso-brasil`. Vercel auto-detects Next.js.
      b. Set env vars (run for each — the CLI prompts for the value, then asks which scope):
         ```
         pnpm dlx vercel@53 env add DATABASE_URL preview production
         pnpm dlx vercel@53 env add UPSTASH_REDIS_REST_URL preview production
         pnpm dlx vercel@53 env add UPSTASH_REDIS_REST_TOKEN preview production
         pnpm dlx vercel@53 env add INGEST_TOKEN preview production
         ```
      c. Confirm in https://vercel.com/<org>/enso-brasil/settings/environment-variables — 4 vars set on both Preview + Production.

    Step 5 — GH repo secrets (https://github.com/<org>/enso-brasil/settings/secrets/actions):
      a. New secret `INGEST_TOKEN` = same value generated in step 3.
      b. New secret `VERCEL_URL` = production URL (e.g., `https://enso-brasil.vercel.app`). Use the URL Vercel returns after `vercel link`.

    Step 6 — Trigger first deploy:
      a. Push `main` (any commit, even an empty one): `git commit --allow-empty -m "chore(02-11): trigger first deploy" && git push origin main`.
      b. Wait for Vercel preview to go green. Hit `https://enso-brasil.vercel.app/api/states` — expect HTTP 503 + `{"error":"snapshot_unavailable"}` (cold).
      c. Manually trigger the cron: `gh workflow run cron.yml --ref main`. Wait ~30s for it to finish.
      d. Re-hit `/api/states` — expect HTTP 200 + array of 27 StateSnapshot objects.
      e. Hit `/api/health` — expect HTTP 200 + HealthReport with sources=[{key:"stub",isStale:false,...}].

    Step 7 — Confirm with the user that all 7 steps succeeded. If any step fails (auth missing, env var typo, deploy red), report the specific error and do NOT proceed to task 2.

  </how-to-verify>
  <resume-signal>Type "approved" once all 7 steps pass; or describe the failure (which step, what error).</resume-signal>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Append "Como deployar" to README — REQ-S2.12 documentation acceptance</name>
  <read_first>
    - .planning/phases/02-data-foundation/02-SPEC.md (REQ-S2.12 acceptance line — README must list 4 env vars)
    - README.md (current state — preserve existing sections)
  </read_first>
  <files>README.md</files>
  <action>
    1. Append to `README.md` a new top-level section `## Como deployar`:
       ```markdown
       ## Como deployar

       O ENSO Brasil roda em **Vercel** (free tier) com **Neon Postgres** (dev branch) e **Upstash Redis** (REST). O cron de ingestão é orquestrado por **GitHub Actions** a cada 15 minutos.

       ### Variáveis de ambiente (4 obrigatórias)

       | Var | Origem | Onde colocar |
       |-----|--------|--------------|
       | `DATABASE_URL` | Neon Console → Project → Connection String (com `sslmode=require`) | Vercel env vars (Preview + Production) |
       | `UPSTASH_REDIS_REST_URL` | Upstash Console → Database → REST API → URL | Vercel env vars (Preview + Production) |
       | `UPSTASH_REDIS_REST_TOKEN` | Upstash Console → Database → REST API → Token | Vercel env vars (Preview + Production) |
       | `INGEST_TOKEN` | Gerar com `openssl rand -hex 32` | Vercel env vars + GitHub repo secret |

       Adicionalmente, `VERCEL_URL` (URL pública do deploy de produção, ex: `https://enso-brasil.vercel.app`) precisa ser configurado como **GitHub repo secret** para os workflows de cron + archive.

       ### Passos (one-time setup)

       1. **Neon** (https://console.neon.tech): crie projeto `enso-brasil`, branch `dev`. Copie a connection string.
       2. **Upstash** (https://console.upstash.com): crie Redis DB `enso-brasil-dev`. Copie REST URL + token.
       3. **Vercel CLI**: `pnpm dlx vercel@53 link` → escolha o projeto `enso-brasil`. Depois `vercel env add` para cada uma das 4 variáveis nos escopos `preview` e `production`.
       4. **Gere o token de ingest**: `openssl rand -hex 32`. Esse mesmo valor vai no Vercel `INGEST_TOKEN` E como GitHub secret.
       5. **GitHub repo secrets**: adicione `INGEST_TOKEN` (mesmo valor) e `VERCEL_URL` (URL de produção).
       6. **Aplicar migrações no Neon**: localmente, `export DATABASE_URL=<connection-string>` e `pnpm db:migrate`.
       7. **Push to main**: cron `*/15 * * * *` ativa automaticamente. Para o primeiro tick imediato, rode `gh workflow run cron.yml --ref main`.

       ### Validação pós-deploy

       - `GET /api/states` antes do primeiro cron: **503** com `{"error":"snapshot_unavailable"}` (cache vazio).
       - Após primeiro cron: **200** com array de 27 `StateSnapshot`.
       - `GET /api/health`: **200** com `HealthReport` (1 fonte: `stub`).
       - `POST /api/ingest` sem `Authorization: Bearer ${INGEST_TOKEN}`: **401**.

       ### Notas

       - **Branch Neon de produção**: Em P2, Preview e Production usam o mesmo `dev` branch (deploy boundary intencional). Branch dedicado de produção fica para P7.
       - **Plano gratuito**: limites Upstash 500k cmd/mês + Neon 100h compute/mês. ~3 cmd/tick × 2880 ticks/mês ≈ 9k cmd/mês — bem abaixo do limite. Monitorar baseline em logs.
       - **Cron via GitHub Actions** (não Vercel Cron — decisão arquitetural locked, ver `.planning/research/SUMMARY.md`).
       ```

    2. Run `pnpm format` to normalize. Verify the section is well-formed Markdown by reading it back.

  </action>
  <verify>
    <automated>cd "E:\programming\fullstack\enso-brasil" && grep -c "Como deployar" README.md && grep -c "DATABASE_URL" README.md && grep -c "UPSTASH_REDIS_REST_URL" README.md && grep -c "UPSTASH_REDIS_REST_TOKEN" README.md && grep -c "INGEST_TOKEN" README.md && grep -c "VERCEL_URL" README.md</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "Como deployar" README.md` returns 1
    - `grep -c "DATABASE_URL" README.md` returns >= 1
    - `grep -c "UPSTASH_REDIS_REST_URL" README.md` returns >= 1
    - `grep -c "UPSTASH_REDIS_REST_TOKEN" README.md` returns >= 1
    - `grep -c "INGEST_TOKEN" README.md` returns >= 1
    - `grep -c "VERCEL_URL" README.md` returns >= 1
    - `grep -c "Neon" README.md` returns >= 1
    - `grep -c "Upstash" README.md` returns >= 1
    - `grep -c "openssl rand -hex 32" README.md` returns >= 1
  </acceptance_criteria>
  <done>README "Como deployar" lists all 4 env vars + provisioning origins. REQ-S2.12 README acceptance criterion satisfied.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Final smoke verification — REQ-S2.12 deploy acceptance</name>
  <what-built>
    Vercel preview deployment is live. Cron triggers every 15 min. Archive triggers daily at 03:00 BRT. Code is in main; secrets are wired; README documents the flow.
  </what-built>
  <how-to-verify>
    1. From a clean shell:
       ```
       curl -sS -o /dev/null -w "%{http_code}\n" "$VERCEL_URL/api/states"
       ```
       Expect: `200` (after first cron tick) or `503` (before first cron tick — recoverable by `gh workflow run cron.yml`).

    2. Confirm cron scheduled:
       ```
       gh workflow list
       gh run list --workflow=cron.yml --limit 5
       ```
       Should list a recent successful run.

    3. Hit /api/ingest manually with the token (read from local `vercel env pull` output OR generated value):
       ```
       curl -sS -X POST -H "Authorization: Bearer $INGEST_TOKEN" "$VERCEL_URL/api/ingest" | jq '.adoptedCount'
       ```
       Expect: `0` (steady state — first cron already adopted) or `3` (cold). Either is acceptable.

    4. Confirm /api/health:
       ```
       curl -sS "$VERCEL_URL/api/health" | jq '.sources[0]'
       ```
       Expect: `{ key: "stub", displayName: "Stub (fixture)", isStale: false, ... }` if a recent cron ran in the last 30 min.

    5. Confirm archive workflow exists:
       ```
       gh workflow list | grep archive
       ```
       Should appear (it won't have run yet — first daily run is 03:00 BRT after deploy).

    6. Report PASS / FAIL with details.

  </how-to-verify>
  <resume-signal>Type "approved" if steps 1-5 all pass; or describe failures.</resume-signal>
</task>

</tasks>

<threat_model>
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-30 | Information Disclosure | INGEST_TOKEN pasted into wrong dashboard | accept | One-time human action; documented step-by-step in README + this plan; rotation procedure (regenerate, update Vercel + GH secret) noted in CONTRIBUTING follow-up |
| T-02-31 | Spoofing | Wrong VERCEL_URL secret points cron at attacker domain | mitigate | URL hardcoded to \*.vercel.app; HTTPS only; user verifies in step 5 of task 1 |
| T-02-32 | Denial of Service | Free-tier quota exhausted mid-month | accept | RESEARCH §Risk Table predicts ~9k Upstash cmd/mo (vs 500k limit); monitor in P6 hardening |
</threat_model>

<verification>
README "Como deployar" present with 4 env vars; tasks 1 and 3 are human-verified gates; cron + archive workflows scheduled; /api/states transitions 503→200 after first cron.
</verification>

<success_criteria>
End-to-end deploy works: every 15 min the cron tick produces a fresh snapshot; /api/states + /api/health serve from edge; daily archive prunes old rows. Vercel preview URL is the canonical address until P7.
</success_criteria>

<output>
After completion, create `.planning/phases/02-data-foundation/02-11-SUMMARY.md` AND `.planning/phases/02-data-foundation/02-VERIFICATION.md` (rolling up tasks 1+3 verification results).
</output>
