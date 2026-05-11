# Como contribuir com ENSO Brasil

Obrigado pelo interesse. ENSO Brasil é um projeto adjacente à segurança pública: contribuições são bem-vindas, mas o viés é conservador — erros devem falhar para o lado de avisar demais, nunca de avisar de menos.

## Como contribuir

Workflow é exclusivamente PR (decisão D-09). Toda mudança em `main` passa por Pull Request:

1. Faça um fork ou crie uma branch a partir de `main`.
2. Implemente sua mudança em commits atômicos (conventional commits — veja "Padrões de código").
3. Abra um PR descrevendo o que mudou e linkando o **REQ-ID** correspondente em [`.planning/REQUIREMENTS.md`](./.planning/REQUIREMENTS.md). Exemplo: `Closes FOUND-05` ou `Closes DATA-03`.
4. Aguarde CI verde e revisão.

PRs sem REQ-ID linkado serão pedidos de ajuste antes da revisão.

## Como rodar local

Pré-requisito: Node 24 LTS.

```bash
corepack enable && corepack prepare pnpm@latest --activate
pnpm install
pnpm dev
pnpm test
pnpm exec playwright test
```

## Como rodar testes

Testes unitários rodam sem dependências externas (`pnpm test`). Os testes de integração (Drizzle + Postgres) precisam de uma instância local do Postgres — eles se auto-pulam (`describe.skipIf`) quando `DATABASE_URL_TEST` não está definido.

### Setup local (com Docker)

1. Suba o container de teste (porta 5433, ephemeral, sem volumes):

   ```bash
   docker compose -f docker-compose.test.yml up -d
   ```

2. Exporte a URL do banco de teste:

   ```bash
   export DATABASE_URL_TEST=postgres://postgres:postgres@localhost:5433/test
   export DATABASE_URL=$DATABASE_URL_TEST
   ```

3. Aplique as migrações (idempotente, pode rodar quantas vezes precisar):

   ```bash
   pnpm db:migrate
   ```

4. Rode os testes (unit + integração):

   ```bash
   pnpm test
   ```

5. Quando terminar, derrube o container:

   ```bash
   docker compose -f docker-compose.test.yml down
   ```

### Sem Docker

Sem Docker rodando, `pnpm test` ainda funciona — apenas os testes de integração (`describe.skipIf(!process.env.DATABASE_URL_TEST)`) serão pulados. Os testes unitários cobrem ~80% do código.

### CI

A CI usa um GH Actions `services:` block (mesma imagem `postgres:17-alpine`) — não precisa rodar docker-compose dentro do runner. O passo `pnpm db:migrate` aplica o schema no container de serviço antes do vitest rodar. Veja [`.github/workflows/ci.yml`](./.github/workflows/ci.yml).

## Padrões de código

- **TypeScript strict** (`noUncheckedIndexedAccess`, `noImplicitOverride`).
- **ESLint + Prettier** rodam no pre-commit e na CI.
- **Conventional commits** — prefixos `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `style`, `perf`. Escopo opcional com fase/plano (ex.: `feat(02-03): ...`).
- **Sem strings PT-BR inventadas** — toda string visível ao usuário vem de `src/lib/messages.ts`.
- **Sem cores de risco hardcoded** — use os tokens `--color-risk-*` definidos no `@theme` block do `globals.css`.

## Pre-commit

Husky + lint-staged executam ESLint --fix e Prettier --write nos arquivos staged. Adicionalmente, **gitleaks** roda como hook separado para impedir commit de segredos.

Instale o gitleaks antes do primeiro commit:

- **Windows:** `winget install gitleaks` (ou baixe binário em https://github.com/gitleaks/gitleaks/releases)
- **macOS:** `brew install gitleaks`
- **Linux:** baixe o release binário ou use o package manager da sua distro

A CI também roda gitleaks em cada PR (defesa em profundidade — D-04).

## Estratégia de merge

PRs são integrados em `main` exclusivamente via **squash merge**. Os outros métodos (merge commit, rebase) estão desabilitados nas configurações do repositório e no ruleset.

Por quê:

- **Histórico limpo em `main`**: cada PR vira um commit. `git log main` mostra features e fixes, não passos intermediários (`fix(03): drop dead branch`, `test(03): add 13 cases`).
- **Reverter uma feature inteira é um `git revert <sha>` só.**
- **`git bisect` rápido**: cada commit em `main` é um estado coerente, com CI verde.
- O detalhe completo (commits atômicos do branch) fica preservado para sempre dentro do PR.

A mensagem do squash deve seguir Conventional Commits e referenciar o número do PR:

```
feat(03): Pure Risk Engine v0 (#1)

<corpo opcional explicando o porquê e o que mudou>
```

Branch do PR é deletada automaticamente após merge.

## Branch protection

Branch `main` está protegida (D-09): exige 1 aprovação de PR, todos os checks de CI verdes, histórico linear (sem merge commits), sem force-push e sem self-approval.

**Pitfall 7 (workaround solo-dev):** Em v1, o mantenedor solo (@CarlosHenriqueMkt) usa o admin-bypass do GitHub para mergear PRs próprios após CI verde. Quando um segundo revisor for adicionado, o bypass será desativado. Isso está documentado para transparência — o objetivo permanece: nenhum código entra em `main` sem CI verde.

## Issue templates

Use os templates em [`.github/ISSUE_TEMPLATE/`](./.github/ISSUE_TEMPLATE/):

- **bug_report** — algo está quebrado tecnicamente (componente não renderiza, build falha, erro de runtime).
- **data_discrepancy** — o painel está mostrando informação errada para um estado (você verificou na fonte oficial e os números não batem). Template único deste projeto.
- **feature_request** — sugestão de nova funcionalidade. Verifique antes se ela cabe no escopo do v1.

## Disclosure de segurança

**Não abra issue público** para vulnerabilidades de segurança. Veja [SECURITY.md](./SECURITY.md) — disclosure é feita por DM no LinkedIn.

## Anti-features

PRs que adicionem qualquer um destes itens serão **fechados sem merge**:

- Contas de usuário, login, autenticação de end-user
- Recursos sociais (likes, follows, feeds)
- Comentários ou discussão pública dentro do app
- Reports submetidos por usuário (somos agregador de fontes oficiais)
- Modelo próprio de previsão climática (somos agregador, não autoridade)
- Links afiliados, comércio, recomendações de marca
- Analytics que rastreiam indivíduos
- Qualquer coisa que possa substituir ou competir com a Defesa Civil / CEMADEN como sistema oficial de alerta

Esta lista vive em [`CLAUDE.md`](./CLAUDE.md) e em [`.planning/PROJECT.md`](./.planning/PROJECT.md). Se você acha que um item dessa lista deveria mudar, abra uma issue de discussão antes de codar.

## Workflow de fixture refresh (mantenedor)

Fixtures do INMET são capturadas manualmente e commitadas no repositório.
Execute após mudanças na API do INMET ou quando suspeitar de deriva de schema:

```bash
# 1. Captura ao vivo (requer rede)
pnpm fixtures:refresh:inmet

# 2. Revise o diff impresso no terminal
#    - Saída 0: sem mudança estrutural → commit direto
#    - Saída 1: deriva estrutural detectada → investigue antes de commitar

# 3. Se a captura falhou por rate-limit ou INMET indisponível, use dry-run:
pnpm fixtures:refresh:inmet --dry-run

# 4. Commit
git add tests/fixtures/sources/inmet-*.{xml,list.json}
git commit -m "chore: refresh INMET fixtures <YYYY-MM-DD>"
```

**Path C (Fase 4):** apenas INMET está integrado. CEMADEN será adicionado
na Fase 5 — veja issue [#4](https://github.com/CarlosHenriqueMkt/eo-brasil/issues/4)
para o rastreamento da sentinela de deriva e a decisão completa em
`.planning/phases/04-first-two-adapters/04-CONTEXT.md`.

Quando o CEMADEN for adicionado, apenas dois passos serão necessários:

1. Criar `scripts/refresh-cemaden.ts` (thin wrapper em `runFixtureRefresh`)
2. Appender `cemadenAdapter` ao array em `src/lib/sources/registry.ts`

O orquestrador (`/api/ingest`) já itera `sources[]` via `Promise.allSettled`
e não precisará de alterações.
