# Fontes — fixtures

Fixtures para testes de integração e contrato. Cada arquivo `*.json` é um array de `Alert`
validado contra `AlertSchema` (`src/lib/sources/schema.ts`). Fixtures inválidas falham com
erro do zod **antes** de qualquer persistência (REQ-S2.05).

## Fixtures atuais

- `_stub/inmet-list-stub.json` — lista mínima de avisos INMET (`[{"id":"AVISO_STUB_001"}]`). Usado pelo `--dry-run` do script `pnpm fixtures:refresh:inmet`.
- `_stub/inmet-cap-stub.xml` — CAP XML mínimo válido com `<info xml:lang="pt-BR">`. Usado pelo `--dry-run`.
- `inmet-<ISO>.list.json` — lista de avisos capturada do endpoint INMET (`pnpm fixtures:refresh:inmet`).
- `inmet-<ISO>.xml` — documento CAP capturado do INMET para o primeiro aviso ativo.
- `all-red.json` — 27 alertas (1 por UF, severity=red, hazard_kind=queimada). Para teste de stress + revalidatePath.

## Como atualizar fixtures INMET

```bash
# Captura ao vivo (requer rede + INMET disponível):
pnpm fixtures:refresh:inmet

# Dry-run a partir dos stubs locais (sem rede):
pnpm fixtures:refresh:inmet --dry-run
```

Códigos de saída:

- `0` — sem fixture anterior ou apenas mudança de valores folha (leaf-only)
- `1` — deriva estrutural detectada (estrutura da resposta INMET mudou)

Revisar o diff gerado antes de commitar a fixture. CEMADEN será adicionado na Fase 5.

## Como calcular `payload_hash` manualmente

```bash
pnpm tsx -e "
import('./src/lib/sources/hash').then(({computePayloadHash}) => {
  const a = {
    source_key: 'inmet',
    hazard_kind: 'inundacao',
    state_uf: 'SP',
    severity: 'high',
    headline: 'Alerta de inundação',
    fetched_at: '2026-05-01T00:00:00.000Z',
  };
  console.log(computePayloadHash(a));
})
"
```

## Schema canônico

| Campo          | Tipo                                               | Obrigatório | Notas                                                                |
| -------------- | -------------------------------------------------- | ----------- | -------------------------------------------------------------------- |
| `source_key`   | string                                             | sim         | identificador da fonte (`"inmet"`, futuramente `"cemaden"`, etc.)    |
| `hazard_kind`  | enum `queimada\|enchente\|estiagem\|incendio\|...` | sim         | vocabulário CEMADEN/INMET verbatim — use `queimada` (NÃO `incêndio`) |
| `state_uf`     | enum 27 UFs                                        | sim         | sigla 2-letras                                                       |
| `severity`     | enum `low\|moderate\|high\|extreme`                | sim         | severidade do alerta individual                                      |
| `headline`     | string                                             | sim         | texto curto                                                          |
| `body`         | string                                             | não         | descrição longa                                                      |
| `source_url`   | URL                                                | não         | link para a fonte oficial                                            |
| `fetched_at`   | ISO datetime                                       | sim         | quando o adapter coletou                                             |
| `valid_from`   | ISO datetime                                       | não         | início da validade                                                   |
| `valid_until`  | ISO datetime                                       | não         | fim da validade                                                      |
| `payload_hash` | sha256 hex (64 chars)                              | sim         | `computePayloadHash(alert)` — determinístico, exclui `raw`           |
| `raw`          | unknown                                            | sim         | passthrough do payload upstream (jsonb)                              |

## Limites

- `payload_hash` deve ser sha256 hex 64 chars.
- `severity` ∈ `{ low, moderate, high, extreme }`.
- `hazard_kind` ∈ `{ queimada, enchente, estiagem, incendio, inundacao, seca }`.
- `state_uf` ∈ uma das 27 UFs válidas.
