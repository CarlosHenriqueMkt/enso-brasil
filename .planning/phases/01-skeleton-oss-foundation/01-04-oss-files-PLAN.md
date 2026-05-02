---
phase: 01-skeleton-oss-foundation
plan: 04
type: execute
wave: 2
depends_on: [01]
files_modified:
  - LICENSE
  - README.md
  - CONTRIBUTING.md
  - CODE_OF_CONDUCT.md
  - SECURITY.md
  - .github/ISSUE_TEMPLATE/bug_report.md
  - .github/ISSUE_TEMPLATE/data_discrepancy.md
  - .github/ISSUE_TEMPLATE/feature_request.md
  - .github/PULL_REQUEST_TEMPLATE.md
  - .github/renovate.json
autonomous: true
requirements:
  - FOUND-01

must_haves:
  truths:
    - "`git ls-files` includes LICENSE, README.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md at root"
    - "LICENSE contains MIT text with year `2026` and project name `ENSO Brasil`"
    - "README is PT-BR primary with all 9 D-07 sections"
    - "Issue templates include the project-unique `data_discrepancy` template (D-08)"
    - "Renovate config groups lint/test devDeps and isolates Next/React major-version PRs"
  artifacts:
    - path: "LICENSE"
      provides: "MIT license, 2026, ENSO Brasil"
      contains: "MIT License"
    - path: "README.md"
      provides: "PT-BR README with 9 sections per D-07"
      contains: "ENSO Brasil"
    - path: "CONTRIBUTING.md"
      provides: "Contributor guide PT-BR + branch protection workaround note (Pitfall 7)"
    - path: "CODE_OF_CONDUCT.md"
      provides: "Contributor Covenant 2.1 PT-BR translation"
      contains: "Contributor Covenant"
    - path: "SECURITY.md"
      provides: "Vulnerability disclosure -> LinkedIn DM (D-08)"
      contains: "linkedin.com/in/carloshenriquerp"
    - path: ".github/ISSUE_TEMPLATE/data_discrepancy.md"
      provides: "Project-unique template for data discrepancy reports (D-08)"
    - path: ".github/PULL_REQUEST_TEMPLATE.md"
      provides: "PR checklist: tests / types / no secrets / linked REQ-ID (D-08)"
      contains: "REQ-"
    - path: ".github/renovate.json"
      provides: "Renovate config: recommended preset + grouped lint/test + isolated framework majors (planner-answer #2)"
      contains: "config:recommended"
  key_links:
    - from: "SECURITY.md"
      to: "LinkedIn DM channel"
      via: "D-05 contact policy"
      pattern: "linkedin\\.com/in/carloshenriquerp"
    - from: ".github/renovate.json"
      to: "package.json deps"
      via: "Renovate package rules"
      pattern: "packageRules"
---

<objective>
Ship every OSS file required for FOUND-01 + D-07 + D-08 + D-09 in one focused plan. No code, no tests — pure governance/docs/templates. Runs in parallel with plans 02 and 03 (disjoint file sets).

Purpose: OSS scaffolding is independent of the Next.js codebase, so it gets its own wave-2 plan to maximize parallelism. Plan 05 will reference this plan's CONTRIBUTING.md from CI to verify branch-protection workaround is documented.
Output: LICENSE (MIT 2026) · README.md (PT-BR primary, 9 sections) · CONTRIBUTING.md · CODE_OF_CONDUCT.md (Covenant 2.1 PT-BR) · SECURITY.md (LinkedIn disclosure) · 3 issue templates (bug, data_discrepancy, feature) · PR template · Renovate config.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-skeleton-oss-foundation/01-SPEC.md
@.planning/phases/01-skeleton-oss-foundation/01-CONTEXT.md
@.planning/phases/01-skeleton-oss-foundation/01-RESEARCH.md
@CLAUDE.md
@risk-formula-v0.md

<interfaces>
README sections required (D-07, ALL must appear):
1. O que é                         (what)
2. Por quê                         (mission — public-safety adjacent, PT-BR vulnerable users)
3. Como funciona                   (link to risk-formula-v0.md)
4. Fontes oficiais                 (CEMADEN, INMET, INPE/FIRMS, NOAA — domains in mono code-fence)
5. Status                          (em construção, fase atual = Phase 1)
6. Como rodar localmente           (pnpm install / pnpm dev / pnpm test / pnpm exec playwright test)
7. Como contribuir                 (link to CONTRIBUTING.md)
8. Limitações conhecidas           (semiárido drought, free-tier exhaustion, source instability — pull from STATE.md Risk Watch)
9. Disclaimer + emergency contacts (199 Defesa Civil · 193 Bombeiros · 190 Polícia + "não substitui sistemas oficiais")

OSS file decisions (D-08):

- SECURITY.md -> vulnerability disclosure via LinkedIn DM (D-05): https://www.linkedin.com/in/carloshenriquerp/
- Issue templates: bug_report, data_discrepancy (project-unique — for "this state is showing wrong data"), feature_request
- PR template checklist: tests pass / types pass / no secrets committed / linked requirement ID (REQ-ID format e.g. FOUND-05)
- NO `.github/FUNDING.yml` in P1 (deferred to P7)
- Branch protection (D-09): document the solo-dev "owner bypass" workaround in CONTRIBUTING (Pitfall 7)

Renovate config (planner answer #2):

- preset: `config:recommended`
- packageRules:
  • group "lint tooling" -> eslint, prettier, lint-staged, husky, knip
  • group "test tooling" -> vitest, @vitejs/plugin-react, jsdom, @playwright/test
  • Next.js + React major-version updates -> separate PR group named "framework-major"

Anti-features (CLAUDE.md) — README/templates MUST NOT promote:

- user accounts · social · comments · user-submitted reports · forecasting · affiliate · commerce · individual analytics
  </interfaces>
  </context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: License + README (PT-BR, 9 sections)</name>
  <read_first>
    - .planning/phases/01-skeleton-oss-foundation/01-CONTEXT.md (D-07 — README sections)
    - .planning/phases/01-skeleton-oss-foundation/01-RESEARCH.md (Code Examples MIT LICENSE template)
    - CLAUDE.md (mission, anti-features, locked stack)
    - .planning/STATE.md (Risk Watch — for "Limitações conhecidas")
    - risk-formula-v0.md (linked from §Como funciona)
    - .planning/PROJECT.md (vision, audience)
  </read_first>
  <files>LICENSE, README.md</files>
  <action>
    1. Write `LICENSE` with the standard MIT text. Header lines must be EXACTLY:
       `MIT License` blank line `Copyright (c) 2026 ENSO Brasil`
       Followed by the standard MIT permission grant + warranty disclaimer (full text from RESEARCH §Code Examples MIT LICENSE template, expanded to the complete standard MIT body — do not abbreviate the warranty disclaimer "THE SOFTWARE IS PROVIDED \"AS IS\"...").

    2. Write `README.md` in PT-BR with EXACTLY these 9 H2 sections in this order (D-07):
       - `## O que é` (2-3 paragraphs: aggregator dashboard for Brazilian climate hazards via official APIs — CEMADEN, INMET, INPE/FIRMS, NOAA. Public-safety adjacent. Não substitui Defesa Civil. Audiência: brasileiros em regiões vulneráveis.)
       - `## Por quê` (Mission from PROJECT.md/CLAUDE.md — informação clara em PT-BR, foco em anomalias com potencial de mortes/perdas, viés conservador.)
       - `## Como funciona` (Brief explainer of v0 risk formula. Link: "Veja o contrato completo em [risk-formula-v0.md](./risk-formula-v0.md).")
       - `## Fontes oficiais` (Bullet list with domains in inline code: CEMADEN — `cemaden.gov.br`; INMET — `alertas2.inmet.gov.br`; INPE/FIRMS — `queimadas.dgi.inpe.br` and `firms.modaps.eosdis.nasa.gov`; NOAA CPC — `cpc.ncep.noaa.gov`)
       - `## Status` (Em construção. Fase atual: **Fase 1 — Skeleton & OSS Foundation**. Roadmap: link para `.planning/ROADMAP.md`.)
       - `## Como rodar localmente` (Code-fenced bash: `corepack enable && corepack prepare pnpm@latest --activate`, then `pnpm install`, `pnpm dev`, `pnpm test`, `pnpm exec playwright test`, `pnpm build`. Pré-requisito: Node 24 LTS.)
       - `## Como contribuir` (Link to CONTRIBUTING.md. Mention: PRs require 1 approval (Pitfall 7 note: solo-dev owner-bypass workaround documented in CONTRIBUTING). Open issues for bugs, **data discrepancies**, and feature requests — templates in `.github/ISSUE_TEMPLATE/`.)
       - `## Limitações conhecidas` (Bullet list pulled from STATE.md Risk Watch: semiárido em seca crônica pode aparecer verde no v0 (correção em M4); endpoint do CEMADEN pode mudar sem aviso; tier gratuito Vercel/Upstash/Neon pode esgotar em pico de alerta vermelho (fallback estático em P6); yellow contrast usa `#d4a017` darkened porque Tailwind default `#eab308` falha WCAG AA.)
       - `## Disclaimer` (LITERAL block — must include all 6 emergency tokens):
         > Este site agrega informações de fontes oficiais. **Não substitui sistemas oficiais de alerta.**
         > Em emergência, ligue:
         > - **199** — Defesa Civil
         > - **193** — Bombeiros
         > - **190** — Polícia
         Followed by: "Licenciado sob MIT. Copyright (c) 2026 ENSO Brasil."

    3. README MUST NOT mention any anti-feature (CLAUDE.md): no user accounts, social, comments, forecasting, affiliate, commerce, individual analytics. README MUST NOT mention `next-intl`, `i18n`, locale routing, or English README (deferred to P7 per planner answer #1).

  </action>
  <verify>
    <automated>cd "E:\programming\fullstack\enso-brasil" && test -s LICENSE && test -s README.md && grep -c "MIT License" LICENSE && grep -Fc "2026 ENSO Brasil" LICENSE</automated>
  </verify>
  <acceptance_criteria>
    - File `LICENSE` exists and is non-empty
    - `grep -c "MIT License" LICENSE` returns 1
    - `grep -Fc "Copyright (c) 2026 ENSO Brasil" LICENSE` returns 1
    - `grep -c "WITHOUT WARRANTY" LICENSE` returns 1 (full MIT body, not abbreviated)
    - File `README.md` exists and is non-empty
    - All 9 H2 sections present (each `grep -c` returns 1): `^## O que é$`, `^## Por quê$`, `^## Como funciona$`, `^## Fontes oficiais$`, `^## Status$`, `^## Como rodar localmente$`, `^## Como contribuir$`, `^## Limitações conhecidas$`, `^## Disclaimer$`
    - `grep -c "199" README.md` >= 1 AND `grep -c "Defesa Civil" README.md` >= 1
    - `grep -c "193" README.md` >= 1 AND `grep -c "Bombeiros" README.md` >= 1
    - `grep -c "190" README.md` >= 1 AND `grep -c "Polícia" README.md` >= 1
    - `grep -Fc "não substitui sistemas oficiais" README.md` >= 1
    - `grep -cE "next-intl|i18n|locale routing|README\.en\.md" README.md` returns 0
    - `grep -ciE "user accounts|comments|forecasting|affiliate|shopping" README.md` returns 0
    - `grep -c "risk-formula-v0.md" README.md` >= 1
    - `grep -c "pnpm install" README.md` >= 1
  </acceptance_criteria>
  <done>MIT LICENSE pinned to 2026 ENSO Brasil. PT-BR README has all 9 D-07 sections, all 6 emergency tokens, no anti-features, no English README reference (deferred per planner answer #1).</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: CONTRIBUTING + CODE_OF_CONDUCT + SECURITY + GitHub templates + Renovate</name>
  <read_first>
    - .planning/phases/01-skeleton-oss-foundation/01-CONTEXT.md (D-08, D-09 — OSS files + branch protection; D-05 — LinkedIn contact)
    - .planning/phases/01-skeleton-oss-foundation/01-RESEARCH.md (Pitfall 7 solo-dev workaround; Don't Hand-Roll README/Renovate)
    - .planning/REQUIREMENTS.md (REQ-ID format for PR template)
  </read_first>
  <files>CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md, .github/ISSUE_TEMPLATE/bug_report.md, .github/ISSUE_TEMPLATE/data_discrepancy.md, .github/ISSUE_TEMPLATE/feature_request.md, .github/PULL_REQUEST_TEMPLATE.md, .github/renovate.json</files>
  <action>
    1. Write `CONTRIBUTING.md` in PT-BR. Required sections:
       - "Como contribuir" (PR-only workflow per D-09; descreva mudanças linkando ao REQ-ID)
       - "Como rodar local" (pnpm install / pnpm dev / pnpm test)
       - "Padrões de código" (TS strict, ESLint, Prettier, conventional commits)
       - "Pre-commit" (Husky + lint-staged + gitleaks — instale gitleaks: winget/brew/release binary)
       - "Branch protection" — Pitfall 7 NOTE verbatim: "Em v1, o mantenedor solo (@CarlosHenriqueMkt) usa o admin-bypass do GitHub para mergear PRs próprios após CI verde. Quando um segundo revisor for adicionado, o bypass será desativado."
       - "Issue templates" (bug, data_discrepancy, feature_request)
       - "Disclosure de segurança" (não abra issue público — DM no LinkedIn, ver SECURITY.md)
       - "Anti-features" (lista do CLAUDE.md — PRs que adicionem user accounts/social/comments/forecasting/affiliate/commerce/analytics individuais serão fechados)

    2. Write `CODE_OF_CONDUCT.md` using the Contributor Covenant 2.1 PT-BR translation. Header MUST contain literal `Contributor Covenant`, version `2.1`, and the canonical contact line pointing to the LinkedIn URL (D-05): `https://www.linkedin.com/in/carloshenriquerp/`. (Use the official PT-BR translation text from contributor-covenant.org/translations. If the agent cannot fetch the page, embed the English 2.1 text and add a note at top: "Tradução PT-BR oficial pendente — texto em inglês válido até substituição." This is acceptable per Assumption A3 in RESEARCH.)

    3. Write `SECURITY.md` (D-08) in PT-BR. Required content:
       - Heading "Política de segurança"
       - Disclosure channel: LinkedIn DM em `https://www.linkedin.com/in/carloshenriquerp/` (D-05)
       - "NÃO abra um issue público para vulnerabilidades"
       - SLA expectation: "Resposta inicial em até 7 dias úteis"
       - Scope: aplicação web pública; vulns em fontes oficiais devem ser reportadas ao órgão
       - Future transition: "Quando um endereço de e-mail dedicado existir (a partir do P7), este canal será atualizado."

    4. Write `.github/ISSUE_TEMPLATE/bug_report.md` in PT-BR with frontmatter (`name: Reportar bug`, `about: Algo está quebrado tecnicamente...`, `title: "[BUG] "`, `labels: ["bug"]`) and sections: O que aconteceu / O que você esperava / Como reproduzir / Ambiente (Navegador / SO / URL / Horário com fuso) / Screenshot ou log.

    5. Write `.github/ISSUE_TEMPLATE/data_discrepancy.md` (PROJECT-UNIQUE per D-08) with frontmatter (`name: Discrepância de dados`, `about: O painel está mostrando informação errada para um estado`, `title: "[DADOS] "`, `labels: ["data-discrepancy"]`) and sections: Estado afetado (UF) / O que o ENSO Brasil está mostrando / O que a fonte oficial mostra (link direto + screenshot — cite CEMADEN, INMET, INPE) / Quando você verificou (data + horário com fuso) / Possível causa (opcional).

    6. Write `.github/ISSUE_TEMPLATE/feature_request.md` in PT-BR (`name: Sugestão de feature`, `title: "[FEAT] "`, `labels: ["enhancement"]`) with sections: Problema do usuário / Solução proposta / Alternativas consideradas / Encaixa no escopo do v1? (link to REQUIREMENTS.md). MUST include a fixed disclaimer block: "**Anti-features (não serão aceitas):** contas de usuário, social, comentários, reports submetidos por usuário, modelo de previsão (somos agregador), links afiliados, comércio, analytics individuais."

    7. Write `.github/PULL_REQUEST_TEMPLATE.md` in PT-BR with the D-08 checklist:
       - Section "## O que muda"
       - Section "## Requirement linkado" (Ex: FOUND-05, DATA-03 — link to .planning/REQUIREMENTS.md). Followed by "Closes #"
       - Section "## Checklist" with 8 boxes:
         `[ ] pnpm exec tsc --noEmit passa`
         `[ ] pnpm lint passa`
         `[ ] pnpm test passa`
         `[ ] pnpm exec playwright test passa (se mudou rota/layout)`
         `[ ] Sem segredos commitados (gitleaks no pre-commit cobre isso)`
         `[ ] Sem strings PT-BR inventadas — usei src/lib/messages.ts`
         `[ ] Sem cores de risco hardcoded — usei tokens --color-risk-* do @theme`
         `[ ] Documentei mudanças em .planning/STATE.md se relevante`

    8. Write `.github/renovate.json` (planner answer #2 — researcher's call). MUST be valid JSON containing:
       - `"$schema": "https://docs.renovatebot.com/renovate-schema.json"`
       - `"extends": ["config:recommended"]`
       - `"schedule": ["before 6am on monday"]`
       - `"timezone": "America/Sao_Paulo"`
       - `"prConcurrentLimit": 5`
       - `"packageRules"` array with FOUR objects:
         a) `{ "groupName": "lint tooling", "matchPackageNames": ["eslint","prettier","lint-staged","husky","knip"], "matchPackagePatterns": ["^eslint-","^@typescript-eslint/"] }`
         b) `{ "groupName": "test tooling", "matchPackageNames": ["vitest","@vitejs/plugin-react","jsdom","@playwright/test"] }`
         c) `{ "groupName": "framework-major", "matchPackageNames": ["next","react","react-dom"], "matchUpdateTypes": ["major"], "labels": ["framework-major","needs-review"] }`
         d) `{ "groupName": "framework-minor", "matchPackageNames": ["next","react","react-dom"], "matchUpdateTypes": ["minor","patch"] }`

    9. VERIFY: `.github/FUNDING.yml` must NOT exist (D-08). If it does, delete it.

  </action>
  <verify>
    <automated>cd "E:\programming\fullstack\enso-brasil" && test -s CONTRIBUTING.md && test -s CODE_OF_CONDUCT.md && test -s SECURITY.md && test -s .github/ISSUE_TEMPLATE/bug_report.md && test -s .github/ISSUE_TEMPLATE/data_discrepancy.md && test -s .github/ISSUE_TEMPLATE/feature_request.md && test -s .github/PULL_REQUEST_TEMPLATE.md && node -e "JSON.parse(require('fs').readFileSync('.github/renovate.json','utf8'))"</automated>
  </verify>
  <acceptance_criteria>
    - All 8 OSS files exist and are non-empty (`test -s` for each)
    - `grep -c "Contributor Covenant" CODE_OF_CONDUCT.md` returns 1
    - `grep -c "2.1" CODE_OF_CONDUCT.md` returns >= 1
    - `grep -Fc "linkedin.com/in/carloshenriquerp" SECURITY.md` returns 1 (D-05 channel)
    - `grep -Fc "linkedin.com/in/carloshenriquerp" CODE_OF_CONDUCT.md` returns 1
    - `grep -c "admin-bypass" CONTRIBUTING.md` >= 1 (Pitfall 7 documented)
    - `grep -c "gitleaks" CONTRIBUTING.md` >= 1
    - `grep -c "data-discrepancy" .github/ISSUE_TEMPLATE/data_discrepancy.md` returns 1
    - `grep -cE "name: (Reportar bug|Discrepância de dados|Sugestão de feature)" .github/ISSUE_TEMPLATE/*.md` returns 3
    - `grep -c "REQ-" .github/PULL_REQUEST_TEMPLATE.md` >= 1 (D-08 — REQ-ID linkage required)
    - `grep -cE "tsc --noEmit|pnpm lint|pnpm test" .github/PULL_REQUEST_TEMPLATE.md` returns >= 3
    - `node -e "const r=JSON.parse(require('fs').readFileSync('.github/renovate.json','utf8')); process.exit(r.extends && r.extends.includes('config:recommended') ? 0 : 1)"` exits 0
    - `node -e "const r=JSON.parse(require('fs').readFileSync('.github/renovate.json','utf8')); const groups=r.packageRules.map(p=>p.groupName); process.exit(groups.includes('lint tooling') && groups.includes('test tooling') && groups.includes('framework-major') ? 0 : 1)"` exits 0
    - `! test -e .github/FUNDING.yml` (D-08 explicitly excludes it from P1)
  </acceptance_criteria>
  <done>OSS governance files complete. CONTRIBUTING documents the solo-dev branch-protection workaround (Pitfall 7). SECURITY routes vulnerabilities to LinkedIn DM (D-05). Three issue templates including the project-unique data_discrepancy. PR template enforces REQ-ID linkage. Renovate groups lint/test tooling and isolates framework-major upgrades per planner answer #2.</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                          | Description                                                           |
| --------------------------------- | --------------------------------------------------------------------- |
| Public GitHub issue -> mantenedor | Untrusted reports may include sensitive info or vulnerability details |
| Public PR -> main branch          | External contributors may submit malicious code                       |

## STRIDE Threat Register

| Threat ID | Category               | Component                                   | Disposition | Mitigation Plan                                                                                                                                                                       |
| --------- | ---------------------- | ------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-01-08   | Information Disclosure | Vulnerability report posted as public issue | mitigate    | SECURITY.md routes disclosures to LinkedIn DM (private) and forbids public issues for security; bug_report template explicitly says "técnico, não vulnerabilidade"                    |
| T-01-09   | Tampering              | Malicious PR slips past review              | mitigate    | D-09 branch protection (1 review, CI green, no force-push, no self-approval — owner-bypass documented as transitional); PR template checklist makes scope/REQ-ID/secret-scan explicit |
| T-01-10   | Repudiation            | License/COC dispute                         | accept      | MIT LICENSE + Contributor Covenant 2.1 are industry-standard, well-litigated artifacts                                                                                                |

</threat_model>

<verification>
All 8 OSS files non-empty. Renovate JSON parses and contains the 3 required group names. SECURITY + CONTRIBUTING route to the LinkedIn channel per D-05.
</verification>

<success_criteria>
FOUND-01 fully satisfied: public-repo-ready scaffolding (LICENSE + README PT-BR + CONTRIBUTING + CODE_OF_CONDUCT) plus D-08 governance (SECURITY + 3 templates + PR template) plus D-03 Renovate config. No EN README (deferred per planner answer #1). No FUNDING.yml.
</success_criteria>

<output>
After completion, create `.planning/phases/01-skeleton-oss-foundation/01-04-SUMMARY.md`
</output>
