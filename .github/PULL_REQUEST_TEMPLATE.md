## O que muda

<!-- Descreva a mudança em 1-3 frases. Inclua screenshot se a mudança for visual. -->

## Requirement linkado

<!-- Linke ao(s) REQ-ID(s) em .planning/REQUIREMENTS.md. Exemplo: FOUND-05, DATA-03, RISK-02. -->

REQ-ID:

Closes #

## Checklist

- [ ] `pnpm exec tsc --noEmit` passa
- [ ] `pnpm lint` passa
- [ ] `pnpm test` passa
- [ ] `pnpm exec playwright test` passa (se mudou rota/layout)
- [ ] Sem segredos commitados (gitleaks no pre-commit cobre isso)
- [ ] Sem strings PT-BR inventadas — usei `src/lib/messages.ts`
- [ ] Sem cores de risco hardcoded — usei tokens `--color-risk-*` do `@theme`
- [ ] Documentei mudanças em `.planning/STATE.md` se relevante
