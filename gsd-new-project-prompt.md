# Prompt para `/gsd-new-project` — ENSO Brasil

> Cole o conteúdo abaixo (a partir de "VISÃO") direto no Claude Code após executar `/gsd-new-project`. O comando vai fazer perguntas para refinar — esse texto já antecipa a maioria delas, então o fluxo deve convergir rápido.

---

## VISÃO

Quero criar um projeto open source chamado **ENSO Brasil** (nome provisório) — um dashboard público em português que mostra, por estado brasileiro, os perigos climáticos atuais associados ao fenômeno ENSO (El Niño / La Niña).

**Missão:** entregar informação clara e acessível que ajude brasileiros em regiões vulneráveis a entenderem os riscos climáticos do seu estado. O foco é **anomalias e eventos com potencial de causar mortes ou perdas graves**.

**Contexto importante para a IA pesquisadora:** em abril de 2026 a NOAA emitiu o "Final La Niña Advisory" + "El Niño Watch". As condições estão em ENSO-neutro com transição prevista para El Niño entre maio–julho de 2026, persistindo até pelo menos o fim de 2026, com chance significativa de ser um evento forte. **O projeto não deve afirmar que um "Super El Niño" está acontecendo agora** — deve apresentar o status real do ENSO. A arquitetura precisa ser flexível para cobrir todo o ciclo ENSO (El Niño, La Niña, neutro), não só El Niño.

---

## PÚBLICO-ALVO (em ordem de prioridade)

1. **Pessoas em locais frágeis** — moradores de áreas de risco (encostas, margens de rios, regiões de seca crônica no Semiárido, áreas urbanas com histórico de enchente).
2. **Produtores rurais / agricultores** — pequenos produtores que dependem de previsão climática.
3. **Cidadão comum curioso** — quer entender se eventos climáticos extremos têm relação com o ENSO.

**Linguagem:** português brasileiro, simples. Evitar jargão técnico. Quando inevitável, traduzir entre parênteses ou via tooltip.

---

## ESCOPO V1 — MÍNIMO ABSOLUTO

**Filosofia:** v1 é a menor coisa que prova o conceito e já tem valor real. Tudo além disso é um marco posterior, planejado de forma atômica.

### O que entra no v1

**Uma única página: dashboard com perigos climáticos por estado.**

- **Desktop:** mapa do Brasil ao lado direito; painel de informações ao lado esquerdo. Clique em um estado → painel mostra os perigos daquele estado.
- **Mobile:** cards verticais empilhados, um por estado, com busca/filtro. Mapa pode aparecer abaixo como visualização secundária.
- **Referência visual:** infográfico estilo "Brazil Map Infographic" — mapa colorido por nível de risco, badges/cards com indicadores. Paleta acessível (não usar só cores — incluir ícones e rótulos para daltônicos).

**Por estado, mostrar apenas:**
- **Nível de risco simplificado** (verde / amarelo / laranja / vermelho)
- **Tipos de perigo ativos** no estado (seca, enchente, deslizamento, onda de calor, queimada — só os que estiverem em alerta)
- **Fonte de cada perigo listado** com link para a publicação oficial original
- **Data/hora da última atualização** dos dados

**Disclaimer obrigatório fixo no rodapé de toda página:**
"Este site agrega informações de fontes oficiais para facilitar o acesso. Em caso de emergência, ligue 199 (Defesa Civil) ou 193 (Bombeiros). O ENSO Brasil não substitui sistemas oficiais de alerta."

### Características técnicas do v1
- **Atualização:** ingestão a cada 15 minutos via cron (não precisa ser mais rápido no v1)
- **Cache agressivo** para sobreviver no free tier
- **Acessibilidade:** WCAG AA, navegação por teclado, alto contraste
- **Performance:** carregamento em conexão 3G
- **Idioma:** PT-BR apenas, mas estrutura de i18n preparada (next-intl) para futura expansão
- **Open source desde o dia 1** com README, LICENSE (MIT), CONTRIBUTING

### Fontes para o v1
**Regra rígida:** só APIs públicas documentadas. Sem scraping no v1.

A fase de research do GSD precisa investigar quais destas fontes têm API pública estável e funcional. **Mínimo aceitável: 2 fontes integradas.** Ideal: 3+.
- **CEMADEN** — alertas de desastres naturais
- **INMET** — dados meteorológicos, previsões, alertas
- **INPE / CPTEC** — programa Queimadas (tem API), índices ENSO
- **NASA FIRMS** — focos de calor e queimadas via satélite (API REST aberta confirmada)
- **NOAA / CPC** — status oficial do ENSO (fonte global)

Toda fonte exige: atribuição visível, timestamp da última atualização, tratamento de falha (se a fonte cair, mostrar dado anterior + aviso de quanto tempo passou).

### Definição de pronto do v1
1. Dashboard único no ar com mapa (desktop) e cards (mobile)
2. Os 27 estados aparecem com nível de risco e tipos de perigo ativos
3. Pelo menos 2 fontes oficiais integradas via API
4. Disclaimer visível em todas as páginas
5. Atribuição de fonte em cada perigo mostrado
6. Acessível (WCAG AA) e usável em 3G
7. Repositório público no GitHub com README, LICENSE, CONTRIBUTING
8. CI rodando testes em cada PR
9. Site no ar em domínio (subdomínio Vercel ou .com.br barato)

**Tudo que NÃO está nesta lista é marco posterior.**

---

## MARCOS POSTERIORES (atômicos, planejar como fases separadas)

Cada item abaixo é uma fase independente que pode ser priorizada e implementada de forma isolada. O GSD deve criar um marco/fase para cada um, não embutir no v1.

**M2 — Página explicativa "Sobre o ENSO"**
Página estática explicando o que é El Niño / La Niña / fase neutra, como afeta cada região do Brasil (Norte, Nordeste, Centro-Oeste, Sudeste, Sul têm impactos distintos), e status atual segundo NOAA e INPE. Conteúdo editorial, sem dependência de API.

**M3 — Página "Fontes e Metodologia"**
Lista completa das fontes integradas, frequência de atualização, limitações conhecidas, e como o nível de risco é calculado.

**M4 — Detalhamento por estado**
Quando o usuário clica em um estado, abre uma visão expandida com: anomalia de chuva (déficit/excesso vs. média histórica), anomalia de temperatura, eventos recentes notáveis dos últimos 30 dias, e bloco "O que isso significa para você" em linguagem simples.

**M5 — Status ENSO no dashboard**
Adiciona o status ENSO atual (El Niño / La Niña / Neutro) e a previsão para os próximos 3 meses, exibido por estado e globalmente.

**M6 — Seção "Preparação" (educativa, sem comércio)**
Conteúdo educativo público de preparação para emergências. **Não é loja, não é lista de compras com links, não é afiliado.** Descreve *o que é* cada item essencial e *para que serve*, baseado em fontes oficiais (Defesa Civil, Cruz Vermelha, Ministério da Saúde, OMS).

Conteúdo inclui:
- Itens essenciais (água potável, hipoclorito, soro caseiro, kit primeiros socorros, lanterna, documentos) — descritos por função, não por marca
- Habilidades básicas em formato texto: tratamento de água em emergência, sinais de desidratação, o que fazer em deslizamento/enchente/onda de calor, higiene sem água corrente
- Conteúdo regionalizado: preparação para seca (Semiárido), enchente (Sul, costeiras), queimadas (Centro-Oeste, Amazônia)

Princípios editoriais rígidos:
- Sem marcas, sem links de compra, sem afiliados
- Toda recomendação cita fonte oficial
- Linguagem para 5ª série
- Sempre reforçar canais oficiais (199, 192) em emergência

**M7 — Vídeos curtos de habilidades de sobrevivência**
Conteúdo audiovisual ("Como conservar carne com sal", "Como tratar água em emergência", etc.). Hospedagem gratuita (YouTube embed). Pode reusar vídeos oficiais de canais governamentais/ONGs com crédito antes de produzir conteúdo próprio.

**M8 — API pública para terceiros**
Expor os dados normalizados via REST/JSON para jornalistas, pesquisadores e outros devs consumirem. Documentação OpenAPI, rate limiting básico, atribuição obrigatória.

**M9 — Expansão de fontes (incluindo scraping responsável)**
Adicionar fontes que não têm API: portais de Defesa Civil estaduais, agências regionais. Scraping com cache, atribuição clara, e respeito a robots.txt.

**M10 — Histórico interativo**
Comparar o evento atual com El Niños/La Niñas passados (1997–98, 2015–16, 2023–24). Visualização temporal de anomalias.

**M11 — Notificações por estado**
Push web, email ou Telegram bot. Usuário escolhe estado(s) e recebe aviso quando o nível de risco mudar.

**M12 — Internacionalização**
Espanhol (Cone Sul também é afetado pelo ENSO) e inglês. Aproveitar a estrutura i18n já preparada no v1.

**M13 — Integração internacional ampliada**
NASA, ECMWF, e outras agências para contexto global e melhores previsões.

---

## NÃO-OBJETIVOS (o que o projeto NUNCA é)

- **Não é** sistema oficial de alerta de emergência. Defesa Civil e CEMADEN fazem isso.
- **Não é** plataforma de previsão climática própria — só agrega previsões oficiais.
- **Não é** rede social, fórum ou app com login.
- **Não é** loja, marketplace, agregador de afiliados, nem indica onde comprar nada. Quando a seção de preparação chegar (M6), será educativa.
- **Não tem** monetização. Projeto open source sem fins lucrativos.

---

## STACK TÉCNICA

- **Framework:** Next.js 15 (App Router) — frontend + API routes no mesmo projeto
- **Hospedagem:** Vercel free tier (frontend + API routes + cron jobs)
- **Banco:** Vercel Postgres free tier; alternativas se não couber: Neon, Supabase, ou Turso (SQLite)
- **Cache:** Vercel KV ou Upstash Redis free tier
- **Cron:** Vercel Cron Jobs; fallback GitHub Actions agendado se limitar
- **Mapa:** SVG estático ou `react-simple-maps` com TopoJSON do IBGE. **Não usar** Mapbox/Google Maps (caros, dependência pesada)
- **i18n:** `next-intl` configurado desde o dia 1
- **Styling:** Tailwind CSS
- **Linguagem:** TypeScript estrito
- **Testes:** Vitest (unitários) + Playwright (e2e para fluxos críticos)
- **CI:** GitHub Actions
- **Lint/format:** ESLint + Prettier + Husky pre-commit

**Por que abandonar Nest.js:** free tiers que rodam Nest (Render, Fly) têm cold start ou limites que prejudicam UX. Concentrar no Next.js reduz superfície, custo e complexidade.

---

## RESTRIÇÕES

- **Orçamento: zero.** Tudo em free tiers. Plano pago precisa de justificativa antes.
- **Linguagem do dev: JS/TS apenas.** Sem Python, Go, Rust no v1.
- **Open source desde o dia 1.** MIT. README em PT-BR e EN.
- **Acessibilidade não é opcional.** É premissa.
- **Toda informação precisa ter fonte rastreável.** Sem isso, projeto perde credibilidade.

---

## POSTURA ÉTICA E LEGAL

- **Disclaimer forte e visível** em todas as páginas: agregamos fontes oficiais, não substituímos a Defesa Civil.
- **Atribuição completa** de toda fonte com link.
- **Sem alarmismo:** linguagem direta e calma. Não usar "catástrofe iminente" sem que a fonte oficial use.
- **Transparência:** página de metodologia (M3) explica como dados são coletados e classificados.
- **Privacidade:** sem analytics invasivo. Se precisar de métricas, usar Plausible ou similar (privacy-first).
- **Logs de mudança:** mudanças nos critérios de classificação de risco precisam ser versionadas e visíveis.

---

## PERGUNTAS QUE EU JÁ RESPONDI (não precisa perguntar)

- Backend: Next.js API routes, sem Nest.js
- Tempo real: poll a cada 15 min, não websockets
- Fontes: só APIs públicas no v1, sem scraping
- Risco legal: disclaimer forte + posicionamento como agregador, não substituto
- Idioma: PT-BR com arquitetura i18n-ready
- Escopo v1: APENAS dashboard com nível de risco e perigos por estado. Tudo mais é marco posterior.
- Conteúdo de preparação (M6): educativo, sem marcas, sem afiliados, sem indicar onde comprar

## PERGUNTAS ABERTAS (pode me perguntar)

- Nome final do projeto / domínio
- Detalhes de design visual (paleta, tipografia)
- Qual fórmula simples para calcular o nível de risco no v1 (combinando alertas oficiais ativos)
- Estratégia de SEO e divulgação inicial
- Estrutura de governança open source (quem aceita PRs, código de conduta)
- Ordem de priorização dos marcos M2–M13
