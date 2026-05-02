# Prompt para Claude Design — ENSO Brasil

> Cole este prompt em https://claude.ai/design ao criar um novo projeto.

---

Crie o design de um dashboard público brasileiro chamado **ENSO Brasil** — um site de utilidade pública (não comercial) que mostra perigos climáticos por estado, agregando alertas oficiais da Defesa Civil, INMET e CEMADEN.

## Vibe visual

**Cívico e acessível.** Pense em "site de órgão público brasileiro confiável", não em "produto SaaS startup". Referência mental: portal do INMET cruzado com Wikipedia em termos de sobriedade, mas com hierarquia visual moderna e tipografia limpa.

- Tipografia leve (peso 400 e 500 apenas)
- Espaço em branco generoso
- Bordas finas (0,5px)
- Sem gradientes, sem sombras decorativas, sem animações elaboradas
- Sem cores fortes no chrome (header, navegação) — a cor é reservada para os níveis de risco

## Paleta de níveis de risco

Espelha o padrão oficial do INMET (verifique cores semelhantes ao alertas2.inmet.gov.br):

- **Verde** — sem alertas ativos. Tons aproximados: fundo `#d1e7dd`, borda `#16a34a`, texto `#0d4f1e`
- **Amarelo** — perigo potencial. Fundo `#fef7d6`, borda `#d4a017`, texto `#6b5006`
- **Laranja** — perigo. Fundo `#fef0e1`, borda `#ea7c0c`, texto `#6b3206`
- **Vermelho** — grande perigo. Fundo `#fde2e2`, borda `#dc2626`, texto `#7a1f1f`

Cada nível deve ter três sinais redundantes (cor + ícone + rótulo textual) para acessibilidade de daltônicos.

## Telas a desenhar

### 1. Dashboard desktop (≥1024px)

Duas colunas:

- **Esquerda (40%)**: painel de informações do estado selecionado
  - Nome do estado e região
  - Bloco grande de status (cor + nível + frase explicativa)
  - Lista de perigos ativos, cada um em card pequeno: tipo, severidade (badge), descrição curta, fonte com link, timestamp
  - Link discreto: "Como calculamos o nível de risco?"
- **Direita (60%)**: mapa do Brasil
  - Estados coloridos pelo nível de risco
  - Hover/clique no estado atualiza o painel esquerdo
  - Legenda de cores acima do mapa
  - Use TopoJSON do IBGE como referência de fronteiras (fronteiras precisas, não estilizadas)

Header simples com nome do projeto e timestamp da última atualização.

Rodapé fixo com disclaimer obrigatório:

> Este site agrega informações de fontes oficiais para facilitar o acesso. Em caso de emergência, ligue **199** (Defesa Civil) ou **193** (Bombeiros). O ENSO Brasil não substitui sistemas oficiais de alerta.

### 2. Dashboard mobile (≤640px)

Sem mapa interativo na primeira dobra (mapa pode aparecer abaixo).

- Header compacto
- Campo de busca por estado
- Lista vertical de cards, **ordenados por severidade decrescente** (vermelho primeiro, verde por último)
- Cada card: nome do estado, badge de nível com ícone, descrição curta dos perigos ativos
- Borda lateral colorida no card (4px) reforça o nível
- Disclaimer compacto no rodapé

### 3. Estado expandido (mobile e desktop)

Quando o usuário clica num estado para ver detalhes — visão expandida com lista completa de alertas, cada um com fonte, link para a publicação oficial, timestamp.

### 4. Estado vazio

Como um estado em "Verde" (sem alertas) deve aparecer — friendly, sem parecer bug. "Sem alertas ativos no momento. Última verificação há X minutos."

### 5. Estado de erro

Como mostrar quando uma fonte de dados está fora do ar há mais de 30 minutos — mostrar dado anterior + aviso "Dados de [fonte] desatualizados há X minutos".

## Princípios

1. **Performance prioritária**: o site precisa carregar rápido em conexão 3G. Sem fontes externas pesadas, sem bibliotecas de mapa enormes (não use Mapbox/Google Maps).
2. **Acessibilidade WCAG AA**: contraste alto, navegação por teclado, alternativas textuais para o mapa, foco visível.
3. **Idioma**: português brasileiro. Linguagem simples, evite jargão. Ex: "perigo" em vez de "anomalia barométrica significativa".
4. **Sem autopromoção alarmista**: tom calmo e direto. O nível vermelho é grave por si só, não precisa de "🚨 ATENÇÃO 🚨".
5. **Atribuição obrigatória**: toda informação mostra de onde veio, com link para a fonte original.

## Conteúdo de exemplo (use estes dados realistas para preencher os mockups)

**Estados em vermelho:** Maranhão (chuva extrema, INMET aviso de grande perigo)

**Estados em laranja:** Bahia (chuva intensa + risco de deslizamento), Minas Gerais (chuva intensa), Pernambuco (chuva intensa)

**Estados em amarelo:** São Paulo (onda de calor), Rio Grande do Sul (perigo potencial de chuva), Mato Grosso (perigo potencial de queimada)

**Estados em verde:** Acre, Roraima, Amapá, Tocantins, Santa Catarina

## Stack alvo (para o handoff ao Claude Code)

O design vai ser implementado em:

- Next.js 15 (App Router)
- TypeScript estrito
- Tailwind CSS
- next-intl (i18n preparado, PT-BR no v1)
- react-simple-maps + TopoJSON do IBGE para o mapa
- Hospedagem Vercel free tier

Gere os componentes pensando nessa stack — componentes funcionais React, classes Tailwind nativas (sem CSS custom desnecessário), props tipados.
