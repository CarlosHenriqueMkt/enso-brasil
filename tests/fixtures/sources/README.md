# Fontes — fixtures

Cada arquivo `*.json` neste diretório é um array de `Alert` validado contra
`AlertSchema` (`src/lib/sources/schema.ts`) no momento do load pelo
`stubAdapter`. Fixtures inválidas falham com erro do zod **antes** de qualquer
persistência (REQ-S2.05).

## Como autorar uma nova fixture

1. Copie `stub-default.json` como template.
2. Edite os campos. Para cada Alert, calcule `payload_hash` rodando uma vez:
   ```bash
   pnpm tsx -e "import('./src/lib/sources/schema').then(({computePayloadHash})=>{const a={source_key:'stub',hazard_kind:'queimada',state_uf:'SP',severity:'yellow',headline:'...',fetched_at:'2026-05-01T00:00:00.000Z'};console.log(computePayloadHash(a))})"
   ```
3. Cole o hash no campo `payload_hash` do objeto.
4. Aponte `STUB_FIXTURE_PATH=tests/fixtures/sources/<seu-arquivo>.json` para usar.

## Fixtures atuais

- `stub-default.json` — 3 alertas (SP queimada, RJ enchente, AM estiagem). Default do `stubAdapter`.
- `all-red.json` — 27 alertas (1 por UF, severity=red, hazard_kind=queimada). Para teste de stress + revalidatePath.

## Schema canônico

| Campo          | Tipo                                                 | Obrigatório | Notas                                                                |
| -------------- | ---------------------------------------------------- | ----------- | -------------------------------------------------------------------- |
| `source_key`   | string                                               | sim         | identificador da fonte (`"stub"`, futuramente `"cemaden"`, etc.)     |
| `hazard_kind`  | enum `queimada\|enchente\|estiagem\|incendio\|...`   | sim         | vocabulário CEMADEN/INMET verbatim — use `queimada` (NÃO `incêndio`) |
| `state_uf`     | enum 27 UFs                                          | sim         | sigla 2-letras                                                       |
| `severity`     | enum `green\|yellow\|orange\|red\|unknown`           | sim         | bate com `messages.severity` (PT-BR SoT)                             |
| `headline`     | string                                               | sim         | texto curto                                                          |
| `body`         | string                                               | não         | descrição longa                                                      |
| `source_url`   | URL                                                  | não         | link para a fonte oficial                                            |
| `fetched_at`   | ISO datetime                                         | sim         | quando o adapter coletou                                             |
| `valid_from`   | ISO datetime                                         | não         | início da validade                                                   |
| `valid_until`  | ISO datetime                                         | não         | fim da validade                                                      |
| `payload_hash` | sha256 hex (64 chars)                                | sim         | `computePayloadHash(alert)` — determinístico, exclui `raw`           |
| `raw`          | unknown                                              | sim         | passthrough do payload upstream (jsonb)                              |

## Limites

- `payload_hash` deve ser sha256 hex 64 chars; o stub não recomputa, confia no valor do arquivo.
- `severity` ∈ `{ green, yellow, orange, red, unknown }`.
- `hazard_kind` ∈ `{ queimada, enchente, estiagem, incendio, inundacao, seca }`.
- `state_uf` ∈ uma das 27 UFs válidas.
- `gray` é severidade da UI para estado-fonte desconhecido — **não** é severidade de alerta.
