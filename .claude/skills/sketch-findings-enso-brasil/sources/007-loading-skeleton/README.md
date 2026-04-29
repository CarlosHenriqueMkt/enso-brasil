---
sketch: 007
name: loading-skeleton
question: "Cold-cache and 3G initial paint: SSR-instant with last-known data, skeleton + streaming, or dedicated total-failure page? What does the floor look like?"
winner: "A+C"
note: "A and C are complementary, not rival. A is the primary path for normal load. C is the mandatory floor for total-failure / first-deploy / 500 errors. Both ship in v1."
tags: [states, loading, perf, error]
---

# Sketch 007: Loading & Error States

## Design Question

Vida real: a primeira pintura de uma página em 3G + cold cache + Vercel cold-start pode levar 1.5–4 segundos. Em uma emergência climática, esse intervalo é onde o usuário decide se confia ou não no produto. Três abordagens, três contratos:

- **A — SSR-instant + last-known.** Server lê Upstash. Hit → renderiza completo. Miss → fallback para Postgres (último snapshot persistido) com pill de freshness. **Nunca skeleton** — em emergência, dado antigo honesto é melhor que tela vazia.
- **B — Skeleton + streaming.** Padrão Next.js convencional: `<Suspense>` com placeholder shimmer. Header renderiza primeiro, cards streamam.
- **C — Total-failure page.** Página dedicada para o piso absoluto: snapshot vazio (primeiro deploy), todas as fontes fora >1h, erro 500. Necessária independente da escolha A/B — é o fallback do fallback.

## How to View

```
open .planning/sketches/007-loading-skeleton/index.html
```

3 estados em cada variante (phones lado a lado).

## Variants

### A — SSR-instant + last-known

3 estados mostrados:
1. **Hot cache hit** (<50 ms) — Upstash retorna, renderiza completo com pill `há 8 min` verde
2. **Cold cache** (Upstash miss → Postgres) — renderiza completo com pill `há 17 min` laranja + banner stale "Mostrando snapshot de 17 min atrás. Estamos buscando dados novos."
3. **Mapa carregando** — cards renderizam SSR; mapa SVG é client-island com fallback `📍 Mapa carregando…` + atalho para `/texto`

**Característica-chave:** página *nunca* aparece sem dados. Banner explica freshness; usuário entende que está vendo "dado de X minutos atrás" e tem ação clara (recarregar).

### B — Skeleton + streaming

3 estados:
1. **Skeleton inicial** — header com texto "Carregando dados…", counts e cards são barras shimmer
2. **Streaming primeiros chegando** — counts + 2 cards reais + 2 skeletons restantes
3. **Pronto** — todos os cards reais

**Característica-chave:** padrão familiar, baixo custo de implementação (Suspense nativo), mas mostra "nada funcional" durante 800–2000 ms. Em emergência, fricção.

### C — Total-failure page

3 estados:
1. **Snapshot vazio · primeiro deploy** — banner cinza no topo, lista de sites oficiais com domínios mono, bloco emergência com 199/193/190
2. **Todas as fontes fora >1h** — variante para quando o pipeline está degradado mas o site está no ar
3. **Erro 500** — servidor próprio do ENSO Brasil fora; mostra error ID; mantém disponíveis sites das fontes e contatos de emergência

**Característica-chave:** assume responsabilidade pelo problema, redireciona honestamente para fontes. Sempre mostra contatos de emergência. Esta é o **piso** — necessária mesmo quando A ou B funciona normalmente.

## What to Look For

1. **A vs B em emergência.** Imagine alguém recebendo aviso de chuva forte e abrindo o site no celular fraco. A mostra dado antigo com aviso explícito. B mostra barras cinzas. Qual constrói confiança em 1 segundo?
2. **Honestidade de freshness.** A pill "há 17 min" é uma promessa: "isso pode estar desatualizado". B simplesmente esconde a possibilidade.
3. **Custo de implementação.** A requer fallback Postgres; já está na arquitetura (DUAL snapshot store decisão). B é trivial em Next.js. C precisa rotas próprias `error.tsx`, `not-found.tsx`, e detecção do estado degradado.
4. **199/193/190 sempre visível.** A mantém no footer; B no footer; C ressalta como bloco vermelho. C pode ser o ÚNICO lugar onde o usuário vê emergency contacts em emergência catastrófica — vale o destaque.
5. **Mapa client-island.** Em A.3 e em qualquer variante: o mapa SVG é o componente mais pesado. Tratar como island com fallback `<a href="/texto">` é melhor do que bloquear toda a página.
6. **Não competem.** A e B são abordagens **rivais** para load normal. C é **complementar** — necessária em qualquer caso.

## Notes

- A se alinha com a arquitetura locked: Upstash hot + Neon last snapshot. Se Upstash for cold, fall back to Postgres é gratuito.
- B contraria parte do contrato civic/sober — barras shimmer movem a tela e são "decoração de carregamento". Animação em conteúdo de emergência precisa ser justificada.
- C reusa todos os tokens existentes — gray meta-state, mono-font para sites oficiais, emergency block vermelho. Nada novo.

## Implementation hints

### A (recommended for normal load)

```tsx
// app/page.tsx (Server Component)
export default async function HomePage() {
  let snapshot = await readUpstashSnapshot();
  let dataAge = computeAge(snapshot.computedAt);
  let isStale = dataAge.minutes > 10;

  if (!snapshot) {
    snapshot = await readPostgresLastSnapshot();
    dataAge = computeAge(snapshot.computedAt);
    isStale = true;
  }

  if (!snapshot) return <TotalFailurePage scenario="empty-snapshot" />;

  return (
    <>
      {isStale && <StaleSnapshotBanner ageMinutes={dataAge.minutes} />}
      <Header dataAge={dataAge} stale={isStale} />
      <Counts snapshot={snapshot} />
      <CardList snapshot={snapshot} />
      <Suspense fallback={<MapFallback />}>
        <BrazilMap snapshot={snapshot} />
      </Suspense>
    </>
  );
}
```

### C (always-required floor)

`app/error.tsx` for 500s. `app/not-found.tsx` for 404. Conditional render in `page.tsx` when snapshot is empty AND last-fetch is >1h ago. All three reuse a single `<TotalFailurePage>` component with a `scenario` prop.

### B (rejected by default — adopt only if A's Postgres fallback proves expensive)

Trivial: `<Suspense fallback={<CardListSkeleton />}>{cards}</Suspense>`. But contradicts the principle of "honest data over decorative loading".
