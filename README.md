# ENSO Brasil

Painel público que agrega, por estado brasileiro, as ameaças climáticas ativas a partir de fontes oficiais. Software livre, hospedagem gratuita, foco em segurança pública.

## O que é

ENSO Brasil é um painel agregador, em PT-BR, que reúne informações sobre ameaças climáticas (chuvas intensas, deslizamentos, queimadas, estiagem, ondas de calor) por estado brasileiro. Os dados vêm exclusivamente de APIs públicas oficiais — CEMADEN, INMET, INPE/FIRMS e NOAA — e são apresentados em uma única tela acessível, otimizada para conexões 3G.

Este projeto é **agregador**, não um sistema de alerta oficial — **não substitui sistemas oficiais de alerta**. A Defesa Civil e o CEMADEN continuam sendo as fontes autoritativas de aviso à população.

A audiência prioritária são brasileiros em regiões vulneráveis: encostas, margens de rio, semiárido em estiagem crônica e áreas urbanas sujeitas a inundação. Pequenos produtores rurais e cidadãos curiosos sobre o ciclo ENSO são audiências secundárias.

## Por quê

A missão é entregar informação clara, em PT-BR, que ajude pessoas em regiões vulneráveis a entender os riscos climáticos do seu estado. O foco está em **anomalias e eventos com potencial de causar mortes ou perdas graves**.

Por ser um projeto adjacente à segurança pública, o viés é conservador: erros devem falhar para o lado de **avisar demais**, nunca de avisar de menos. Quando uma fonte oficial fica indisponível, o estado é marcado como "Dados indisponíveis" — nunca como verde por padrão.

## Como funciona

O risco por estado é computado a partir dos alertas ativos publicados pelas fontes oficiais. A versão v0 da fórmula faz mapeamento direto da severidade da fonte para um dos 5 níveis exibidos (`green | yellow | orange | red | unknown`), com viés conservador para termos desconhecidos.

Veja o contrato completo em [risk-formula-v0.md](./risk-formula-v0.md).

## Como calculamos o risco — v0

O risco de cada estado é calculado a partir dos alertas oficiais ativos
recebidos das fontes integradas. A versão atual da fórmula é **v0** — o
contrato completo está em [`risk-formula-v0.md`](./risk-formula-v0.md).

**Em resumo, para cada estado:**

1. **Coletamos** os alertas das fontes oficiais (CEMADEN, INMET) a cada 15 minutos.
2. **Filtramos** os que ainda estão ativos (validade explícita, ou janela de 24 h
   se a fonte não informou prazo).
3. **Mapeamos** a severidade declarada por cada fonte para uma escala interna
   (`low | moderate | high | extreme`). Termos desconhecidos viram `moderate`
   por precaução — nunca silenciamos um alerta como baixo.
4. **Combinamos** alertas duplicados do mesmo tipo de evento no mesmo estado
   quando os períodos de validade se sobrepõem. O alerta mais severo "vence",
   mas todos os emissores ficam registrados.
5. **Classificamos** o estado em uma das 5 faixas:
   `Sem alertas` | `Atenção` | `Alerta` | `Perigo` | `Dados indisponíveis`.
6. **Override de defasagem:** se todas as fontes integradas estão com mais
   de 1 hora sem atualização, o estado vai para `Dados indisponíveis` —
   nunca afirmamos `Sem alertas` quando não temos certeza.

### Exemplo (Minas Gerais)

Suponha que recebemos dois alertas para MG no mesmo intervalo, ambos
classificados como `moderate` na escala interna, ambos para o mesmo tipo
de evento (`enchente`):

- **INMET** — Aviso de Perigo (enchente) → severidade interna `moderate`
- **CEMADEN** — Alerta (enchente) → severidade interna `moderate`

Como o tipo de evento e o estado coincidem e os períodos se sobrepõem,
o motor combina os dois em um único alerta efetivo, mantendo ambas as
fontes na atribuição. Com severidade combinada `moderate`, o estado é
classificado como **Alerta** (laranja).

A explicação gerada automaticamente em PT-BR seria:

> "2 alertas ativos. Pior: Alerta do INMET + CEMADEN para enchente"

Esta frase única é o que aparece no card do estado, no `/texto`
(rota acessível) e em qualquer notificação futura — uma só fonte,
sem divergência entre superfícies.

### Limitações conhecidas (v0)

- Apenas duas fontes integradas neste milestone (CEMADEN, INMET).
  INPE Queimadas e NASA FIRMS chegam em fases futuras.
- Granularidade estadual; não calculamos risco por município ainda.
- O motor não faz previsão — apenas espelha alertas oficiais ativos.
- Versionamos a fórmula (`v0`, futuras `v1`, `v2`...) para que mudanças
  de algoritmo fiquem rastreáveis no banco e na UI.

## Fontes oficiais

- CEMADEN — `cemaden.gov.br`
- INMET — `alertas2.inmet.gov.br`
- INPE / Programa Queimadas — `queimadas.dgi.inpe.br`
- NASA FIRMS — `firms.modaps.eosdis.nasa.gov`
- NOAA Climate Prediction Center — `cpc.ncep.noaa.gov`

Toda informação exibida é atribuída à fonte original, com link direto para a publicação oficial.

## Status

Em construção. Fase atual: **Fase 1 — Skeleton & OSS Foundation**.

Roadmap completo: veja [`.planning/ROADMAP.md`](./.planning/ROADMAP.md).

## Como rodar localmente

Pré-requisito: Node 24 LTS.

```bash
corepack enable && corepack prepare pnpm@latest --activate
pnpm install
pnpm dev
pnpm test
pnpm exec playwright test
pnpm build
```

## Como contribuir

Leia o guia em [CONTRIBUTING.md](./CONTRIBUTING.md). Resumo:

- PRs exigem 1 aprovação e CI verde antes do merge. Em v1, o mantenedor solo usa o admin-bypass do GitHub para mergear PRs próprios após CI verde — esse workaround está documentado em CONTRIBUTING (Pitfall 7).
- Abra issues para bugs, **discrepâncias de dados** (quando o painel mostra informação errada para um estado) e sugestões de feature. Templates em [`.github/ISSUE_TEMPLATE/`](./.github/ISSUE_TEMPLATE/).
- Vulnerabilidades de segurança: **não** abra issue público — veja [SECURITY.md](./SECURITY.md).

## Limitações conhecidas

- **Semiárido em estiagem crônica pode aparecer verde no v0** — o mapeamento de severidade direto não captura risco estrutural de longo prazo. Correção planejada para M4.
- **Endpoints do CEMADEN podem mudar sem aviso** — o pipeline de ingestão valida schema e detecta drift, mas pode haver janelas de indisponibilidade.
- **Tier gratuito Vercel/Upstash/Neon pode esgotar em pico de alerta vermelho** — fallback estático JSON edge-cached é planejado para P6.
- **Snapshot stale durante alerta vermelho real** — mitigado por `revalidatePath` on-demand na ingestão (P2).
- **Contraste do amarelo** — a cor `#eab308` padrão do Tailwind falha WCAG AA em fundo branco; usamos `#d4a017` (amarelo escurecido) com texto preto.

## Disclaimer

Este site agrega informações de fontes oficiais. **Não substitui sistemas oficiais de alerta.**

Em emergência, ligue:

- **199** — Defesa Civil
- **193** — Bombeiros
- **190** — Polícia

Licenciado sob MIT. Copyright (c) 2026 ENSO Brasil.
