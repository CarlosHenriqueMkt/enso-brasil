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
