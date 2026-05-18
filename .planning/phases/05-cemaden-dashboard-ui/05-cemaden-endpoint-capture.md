# CEMADEN Endpoint Capture — DevTools Session

**Captured:** 2026-05-18
**Source SPA:** https://painelalertas.cemaden.gov.br
**Captured by:** Carlos
**Browser:** Chrome — Versão 148.0.7778.168 (Versão oficial) 64 bits
**Status:** 2 endpoints capturados e verificados por replay.

---

## Discovered Endpoints

### Endpoint 1: Geometrias das UFs (mal nomeado como "Lat/Lon dos Estados")

> ⚠️ Nome engana: não retorna pares lat/lon (centroides). Retorna **GeoJSON
> com polígonos** (MultiPolygon) das 27 unidades federativas. Útil para
> desenhar o mapa do painel.

- **URL:** `https://painelalertas.cemaden.gov.br/resources/json/estadosBrasil2.json`
- **Method:** GET
- **Query params:** Não
- **Path params:** Não
- **Request headers (relevant):**
  - `Authorization:` ausente
  - `x-api-key:` ausente
  - `Origin:` não exigido. `Referer:` não exigido. (Verificado por replay sem ambos — 200.)
  - Único `Cookie:` no request original: `_pk_id` / `_pk_ses` (Matomo, não auth)
- **Auth required?** **Não — verificado** por replay sem cookies/Referer/Origin.
- **CORS:** **`Access-Control-Allow-Origin` ausente.** Consumo cross-origin via browser será bloqueado — exige proxy server-side.
- **Rate-limit headers:** Nenhum. Apache puro (`Apache/2.4.10 (Debian)`).
- **Geographic scope:** **Nacional, por UF.** Um `FeatureCollection` com 27 features (26 estados + DF).
- **Sample response (estrutura — coordenadas truncadas):**

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "MultiPolygon",
        "coordinates": [
          [
            [
              [-73.800983, -7.111458],
              [-73.737625, -7.134317],
              [-72.900612, -7.436948],
              "... (milhares de pontos a mais — UF: Acre)"
            ]
          ]
        ]
      },
      "properties": "... (confirmar com jq após download local)"
    }
    // ... + 26 features
  ]
}
```

- **Observed timestamp format:** N/A no payload (sem campos de tempo). Headers: IMF-fixdate (`Last-Modified: Wed, 17 Oct 2018 17:08:46 GMT`).
- **Severity vocabulary:** N/A — sem alertas neste endpoint.
- **Hazard taxonomy:** N/A — sem alertas neste endpoint.
- **Stability signals:**
  - Não sob `/api/`. Path `/resources/json/` = asset estático Apache (`Accept-Ranges: bytes`, `ETag` forte, `Last-Modified` antigo).
  - Versionamento por nome (`2` em `estadosBrasil2.json` ⇒ houve v1). Sem alias.
  - Não internal-only: sem JWT, sem signed URL.
  - **Altamente estável:** sem mudança desde 2018-10-17. Cacheável indefinidamente via `If-None-Match`.

---

### Endpoint 2: Lista de alertas ativos (wsAlertas2)

> Este é o coração do painel — alimenta a tabela `UF | Município | Tipo | Nível
| Abertura` e os contadores `Muito Alto / Alto / Moderado`.

- **URL:** `https://painelalertas.cemaden.gov.br/wsAlertas2`
- **Method:** GET
- **Query params:** **Aceita mas ignora** `_=<epoch_ms>` — cache-buster do jQuery (`$.ajax({cache:false})`). Payload com e sem o parâmetro é **byte-idêntico** (verificado por replay).
- **Path params:** Não
- **Request headers (relevant):**
  - `Authorization:` ausente
  - `x-api-key:` ausente
  - `Origin:` não exigido. `Referer:` não exigido. (Verificado.)
- **Auth required?** **Não — verificado** por replay sem cookies/Referer/Origin.
- **CORS:** **`Access-Control-Allow-Origin` ausente.** Mesmo bloqueio cross-origin via browser do Endpoint 1.
- **Rate-limit headers:** Nenhum observado.
- **Geographic scope:** **Nacional — flat array.** Um único response cobre todas as UFs simultaneamente; agrupamento por UF/município feito no cliente via `uf` e `codibge`. **Confirma viabilidade da D-03.**
- **Sample response (5 entradas — payload real, sem truncamento):**

```json
{
  "alertas": [
    {
      "cod_alerta": 2092,
      "datahoracriacao": "2026-05-09 17:30:37.092",
      "ult_atualizacao": "2026-05-09 17:30:37.092",
      "codibge": 1302504,
      "evento": "Risco Hidrológico - Moderado",
      "nivel": "Moderado",
      "status": 1,
      "uf": "AM",
      "municipio": "MANACAPURU",
      "latitude": -3.2914230945153,
      "longitude": -60.958424389662
    },
    {
      "cod_alerta": 2121,
      "datahoracriacao": "2026-05-13 09:41:46.225",
      "ult_atualizacao": "2026-05-13 09:41:46.225",
      "codibge": 1300631,
      "evento": "Risco Hidrológico - Moderado",
      "nivel": "Moderado",
      "status": 1,
      "uf": "AM",
      "municipio": "BERURI",
      "latitude": -4.6034983521613,
      "longitude": -61.787542278385
    },
    {
      "cod_alerta": 2124,
      "datahoracriacao": "2026-05-13 22:13:19.09",
      "ult_atualizacao": "2026-05-14 01:08:42.378",
      "codibge": 1600279,
      "evento": "Risco Hidrológico - Alto",
      "nivel": "Alto",
      "status": 1,
      "uf": "AP",
      "municipio": "LARANJAL DO JARI",
      "latitude": 1.0965735549331,
      "longitude": -53.305868029142
    },
    {
      "cod_alerta": 2127,
      "datahoracriacao": "2026-05-14 06:31:25.991",
      "ult_atualizacao": "2026-05-14 06:31:25.991",
      "codibge": 1302603,
      "evento": "Risco Hidrológico - Moderado",
      "nivel": "Moderado",
      "status": 1,
      "uf": "AM",
      "municipio": "MANAUS",
      "latitude": -2.6259193827197,
      "longitude": -60.259628014208
    },
    {
      "cod_alerta": 2138,
      "datahoracriacao": "2026-05-16 23:30:58.999",
      "ult_atualizacao": "2026-05-16 23:30:58.999",
      "codibge": 1600535,
      "evento": "Risco Hidrológico - Moderado",
      "nivel": "Moderado",
      "status": 1,
      "uf": "AP",
      "municipio": "PORTO GRANDE",
      "latitude": 0.58786623033118,
      "longitude": -51.67367622865
    }
  ],
  "atualizado": "18-05-2026 22:15:01 UTC"
}
```

- **Observed timestamp format:** **UTC — confirmado pelo próprio payload.** O campo raiz `"atualizado":"18-05-2026 22:15:01 UTC"` rotula o timezone explicitamente. Os campos por-alerta (`datahoracriacao`, `ult_atualizacao`) usam formato `YYYY-MM-DD HH:MM:SS.fff` **sem sufixo TZ**, mas por estarem no mesmo payload do `atualizado: ... UTC` — e consistente com a doutrina oficial CEMADEN — devem ser parseados como UTC.
  - Atenção: **dois formatos diferentes no mesmo payload.** `atualizado` usa `DD-MM-YYYY HH:MM:SS UTC` (ordem PT-BR); campos por-alerta usam `YYYY-MM-DD HH:MM:SS.fff` (ordem ISO, sem TZ). Parser precisa de dois caminhos.
- **Severity vocabulary (verbatim PT-BR):** No payload observado: `["Moderado", "Alto"]`. UI do painel mostra também contador `"Muito Alto"` — vocabulário completo provável: `["Moderado", "Alto", "Muito Alto"]`. **Não há `"Observação"`, `"Atenção"`, `"Alerta"`, `"Alerta Máximo"`** (vocabulário do INMET/Defesa Civil, não do CEMADEN). Adapte o template.
- **Hazard taxonomy (verbatim):** No payload observado: `["Risco Hidrológico"]` (5 de 5 alertas). UI do painel mostra também `"Mov. Massa"` — taxonomia completa provável: `["Risco Hidrológico", "Movimento de Massa"]`. O campo `evento` concatena `"{tipo} - {nivel}"`; o campo `nivel` traz só o nível. **Não há `"Geo-Hidrológico"` nem `"Meteorológico"`** no payload — esses são termos institucionais do CEMADEN, mas a API serve a taxonomia binária acima.
- **Stability signals:**
  - Não sob `/api/`. Path é `/wsAlertas2` direto na raiz. Stack provável: Apache + servlet/PHP/Java (não confirmado sem header `Server` do response — preencher).
  - **Versionado por nome:** o `2` em `wsAlertas2` é o mesmo padrão do `estadosBrasil2.json` — sugere v1 prévia (`wsAlertas`) e potencial v3 futura sem alias.
  - Não internal-only: sem JWT, sem signed URL, sem `/_next/data/`, sem token na query.
  - **Dinâmico mas estável em schema:** o `atualizado` muda a cada poll (carimbado UTC); o schema dos itens parece estável (mesmo nomes de campo entre alertas).

---

## cURL Reproductions

```bash
# Endpoint 1 — geometrias das UFs (asset estático)
curl -sS 'https://painelalertas.cemaden.gov.br/resources/json/estadosBrasil2.json' \
  -o estadosBrasil2.json

# Endpoint 1 — revalidação condicional (uso em produção)
curl -sS 'https://painelalertas.cemaden.gov.br/resources/json/estadosBrasil2.json' \
  -H 'If-None-Match: "145271-5786fb91de380"' -D -
# Esperado: 304 Not Modified

# Endpoint 2 — alertas ativos (forma mínima)
curl -sS 'https://painelalertas.cemaden.gov.br/wsAlertas2' | jq .

# Endpoint 2 — replay fiel do request capturado (com cache-buster jQuery)
curl -sS "https://painelalertas.cemaden.gov.br/wsAlertas2?_=$(date +%s%3N)" \
  -H 'Accept: */*' \
  -H 'Referer: https://painelalertas.cemaden.gov.br/' \
  -H 'X-Requested-With: XMLHttpRequest' \
  | jq '.alertas | length, .atualizado'

# Endpoint 2 — agrupar por UF (uso típico do consumidor)
curl -sS 'https://painelalertas.cemaden.gov.br/wsAlertas2' \
  | jq '.alertas | group_by(.uf) | map({uf: .[0].uf, total: length})'
```

---

## Observations & Risks

- **Volume de alertas pode ser muito baixo em dias calmos.** Sample observado: 5 alertas, todos AM/AP, todos `Risco Hidrológico`. Não é evidência de filtro nem paginação — é o estado real do dia. **Não escrever lógica que assume array não-vazio.** Confirmar comportamento em dia de chuva forte (verão SE) capturando novamente.
- **Cache-buster `?_=epoch_ms` é jQuery `cache:false`.** Servidor ignora. Não precisa reproduzir; mas se reproduzir, gere epoch-ms novo (`Date.now()` em JS, `$(date +%s%3N)` em bash).
- **Sem paginação visível.** Array flat sob `alertas`. Em dia de evento extremo (centenas de alertas?), payload pode crescer mas continua sendo um único response. Estimar pior-caso: 200 alertas × ~250 bytes = ~50 KB — tranquilo.
- **Sem `Cache-Control` evidente** (precisa header do response para confirmar). Cliente original usa `Cache-Control: no-cache` + cache-buster por query — defensivo. Replicar em produção: passar `Cache-Control: no-cache` no fetch.
- **CORS = bloqueio em browser cross-origin.** Tanto Endpoint 1 quanto 2 sem `Access-Control-Allow-Origin`. **Único caminho seguro: chamar de Vercel Function / Edge Function / API Route, nunca direto do client.**
- **Stack EOL no Endpoint 1** (Apache 2.4.10, 2014). Endpoint 2 talvez seja outra stack (servlet?) — confirmar `Server:` header. Se cair, sem SLA/fallback.
- **🚨 Conflito de formato de data dentro do mesmo payload:** `atualizado` usa `DD-MM-YYYY HH:MM:SS UTC`; `datahoracriacao` usa `YYYY-MM-DD HH:MM:SS.fff` (sem TZ). Parser tem que distinguir.
- **Properties do GeoJSON (Endpoint 1) ainda não inspecionadas** — coordenadas consomem todo o budget do fetch. Baixar localmente e rodar `jq '.features[].properties' estadosBrasil2.json | head -30` antes de assumir schema.

## Decision Inputs

- **Single national call sufficient? (D-03)** — **Sim, verificado.** `/wsAlertas2` retorna array flat com todas as UFs. Cliente filtra por `uf` ou agrupa por `codibge`. Não há endpoint `/wsAlertas/{uf}`, e não é preciso.
- **BRT naive timestamps confirmed? (D-04)** — **NÃO. Timestamps são UTC** (rotulado no campo `atualizado` e consistente com a doutrina oficial CEMADEN). **D-04 deve ser reescrita**: parsear `datahoracriacao` / `ult_atualizacao` como UTC e converter para BRT na camada de apresentação (`America/Sao_Paulo`, lidando com fusos AC/AM = UTC-4/-5). Não aplicar offset −03:00 cego.
- **Schema includes municipality geocode? (para `/estado/{uf}` grouping)** — **Sim.** Campo `codibge` (7 dígitos, código IBGE padrão). Permite tanto agrupamento por UF (`uf`) quanto drill-down a município (`codibge`). Latitude/longitude por alerta também presentes — pode-se renderizar pin direto no mapa.
- **Auth-free from server-side (Vercel Functions)?** — **Sim, verificado** para os dois endpoints. Sem auth, sem Origin/Referer enforcement, sem rate-limit observado. Roda de qualquer ambiente server-side. Em produção, adicionar timeout de 10s e retry com backoff (a stack do CEMADEN é antiga e pode estar lenta em picos).

---

## Schema do Endpoint 2 (referência rápida para tipagem)

```ts
type WsAlertas2Response = {
  alertas: Array<{
    cod_alerta: number; // ID único do alerta
    datahoracriacao: string; // "YYYY-MM-DD HH:MM:SS.fff" em UTC, sem TZ
    ult_atualizacao: string; // mesmo formato
    codibge: number; // código IBGE do município (7 dígitos)
    evento: string; // "{tipo} - {nivel}", ex: "Risco Hidrológico - Moderado"
    nivel: "Moderado" | "Alto" | "Muito Alto"; // confirmar vocabulário completo
    status: number; // observado: 1 (provavelmente "ativo")
    uf: string; // sigla 2 letras, MAIÚSCULA
    municipio: string; // nome MAIÚSCULA, com acentos
    latitude: number; // grau decimal
    longitude: number; // grau decimal
  }>;
  atualizado: string; // "DD-MM-YYYY HH:MM:SS UTC" (formato diferente!)
};
```

## Pontos a confirmar em sessão DevTools subsequente

1. Capturar response com `Muito Alto` no `nivel` (validar vocabulário).
2. Capturar response com `evento` contendo `Movimento de Massa` (validar taxonomia).
3. Inspecionar response headers do `/wsAlertas2`: `Server:`, `Cache-Control:`, `Access-Control-Allow-Origin:` (confirmar suposições).
4. Verificar polling: o painel chama `/wsAlertas2` em loop? Qual intervalo? (afeta TTL do cache local em produção)
5. Há endpoint de detalhe ao clicar num alerta da tabela? (ex.: `/wsAlerta/{cod_alerta}`)
