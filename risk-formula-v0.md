# Fórmula de Nível de Risco — v0 (para o v1 do ENSO Brasil)

> Esta é a fórmula proposta para o **v1**. É deliberadamente simples, transparente e conservadora. Pode (e deve) evoluir em marcos posteriores conforme o projeto aprende com uso real.

---

## Princípios da v0

1. **Espelhar a fonte, não inventar análise própria.** No v1, o ENSO Brasil é um agregador. O nível de risco mostrado para um estado deve refletir o que as fontes oficiais já estão dizendo, não uma síntese estatística nova que precise de validação científica.
2. **Errar para o lado seguro.** Se duas fontes discordam, o site mostra o nível mais alto.
3. **Explicável em uma frase.** Qualquer pessoa deve conseguir ler "por que este estado está em laranja" sem precisar entender estatística.
4. **Auditável.** O cálculo precisa ser reproduzível: dada uma lista de alertas ativos em um momento, qualquer pessoa chega ao mesmo nível.

---

## Definição dos níveis

| Nível | Cor | Significado |
|---|---|---|
| **Verde** | `#16a34a` | Sem alertas ativos de fontes oficiais para o estado. |
| **Amarelo** | `#eab308` | Pelo menos 1 alerta de severidade *baixa* ativo. |
| **Laranja** | `#ea580c` | Pelo menos 1 alerta de severidade *moderada* ativo, OU 3+ alertas de severidade baixa simultâneos. |
| **Vermelho** | `#dc2626` | Pelo menos 1 alerta de severidade *alta* ou *muito alta* ativo. |

**Cor é informação secundária.** Cada nível é exibido também com:
- Ícone distintivo (✓ verde, ⚠ amarelo, ⚠⚠ laranja, ⛔ vermelho)
- Rótulo textual ("Sem alertas", "Atenção", "Alerta", "Perigo")
- Garantia de acessibilidade para daltônicos

---

## Como mapear severidade vinda das fontes

Cada fonte usa terminologia própria. A v0 normaliza para 4 categorias internas: `low` / `moderate` / `high` / `extreme`. Tudo desconhecido vai para `low` por padrão (postura conservadora: nunca silenciar um alerta, mas também não inflar).

### CEMADEN (alertas de desastres naturais)
| Termo da fonte | Categoria interna |
|---|---|
| Observação / Atenção | `low` |
| Alerta | `moderate` |
| Alerta Máximo | `high` |
| Cessado / Encerrado | (não conta — alerta não está ativo) |

### INMET (avisos meteorológicos)
INMET classifica avisos em quatro níveis nominais. Mapeamento direto:
| Termo da fonte | Categoria interna |
|---|---|
| Aviso de Perigo Potencial (amarelo) | `low` |
| Aviso de Perigo (laranja) | `moderate` |
| Aviso de Grande Perigo (vermelho) | `high` |

### INPE / Programa Queimadas
Não publica "alertas" no sentido de Defesa Civil — publica focos detectados. Para o v1, traduzir densidade de focos em severidade *apenas se* a fonte de research confirmar que existe um endpoint estável. Proposta inicial (a ser confirmada na fase de research do GSD):
| Critério | Categoria interna |
|---|---|
| Estado tem foco ativo nos últimos 7 dias | `low` |
| Estado está nos 5 com mais focos no mês | `moderate` |
| Estado está em situação anômala (3x mediana histórica) | `high` |

Se na pesquisa não houver dado consistente para classificar com confiança, **não usar INPE como fonte de severidade no v1** — apenas mostrar a contagem informativa.

### NASA FIRMS
Fonte secundária, complementar ao INPE para queimadas. Mesmas regras. Se INPE estiver disponível, FIRMS é só backup.

### NOAA / CPC
Não gera severidade por estado. Usado apenas para o status global do ENSO (que entra em M5, não no v1). **Não influencia o nível de risco no v1.**

---

## Algoritmo (pseudocódigo)

```ts
type Severity = 'low' | 'moderate' | 'high' | 'extreme'
type RiskLevel = 'green' | 'yellow' | 'orange' | 'red'

interface Alert {
  source: string         // 'cemaden' | 'inmet' | 'inpe' | ...
  hazardType: string     // 'drought' | 'flood' | 'heatwave' | 'landslide' | 'fire'
  severity: Severity
  state: string          // sigla UF
  activeUntil: Date | null
  sourceUrl: string
  publishedAt: Date
}

function calculateRiskLevel(alerts: Alert[]): RiskLevel {
  const active = alerts.filter(a =>
    !a.activeUntil || a.activeUntil > new Date()
  )

  if (active.length === 0) return 'green'

  const hasHighOrExtreme = active.some(a =>
    a.severity === 'high' || a.severity === 'extreme'
  )
  if (hasHighOrExtreme) return 'red'

  const hasModerate = active.some(a => a.severity === 'moderate')
  if (hasModerate) return 'orange'

  const lowCount = active.filter(a => a.severity === 'low').length
  if (lowCount >= 3) return 'orange'

  return 'yellow'
}
```

### Regras complementares importantes

**Deduplicação.** Se INMET e CEMADEN emitem alertas para o mesmo perigo no mesmo estado no mesmo período (ex: ambos avisam de chuva forte em Minas Gerais), conta como **um** alerta para fins de cálculo, mas as duas fontes são exibidas na UI. Critério de deduplicação: mesmo `hazardType` + mesmo `state` + janelas de tempo sobrepostas.

**Janela de validade.** Um alerta sem `activeUntil` é considerado ativo por 24 horas a partir de `publishedAt`, depois expira automaticamente. Isso evita alertas "fantasma" de fontes que esquecem de emitir o "encerrado".

**Falha de fonte.** Se uma fonte está fora do ar há mais de 30 minutos, o cálculo continua usando o último snapshot conhecido, e a UI mostra um aviso "Dados de [fonte] desatualizados há X minutos". Não rebaixar nível por causa de fonte indisponível.

**Confiança mínima.** Se *todas* as fontes integradas estão fora há mais de 1 hora, o estado é exibido como "Dados indisponíveis" (cinza), não verde. Verde tem que ser uma afirmação positiva de "verificamos e não há alertas", não "não conseguimos verificar".

---

## Modo de falha "under-warning" (issue #12, 2026-06)

Documentado retroativamente após o incidente #12 de 2026-06-02. O ENSO Brasil ficou exibindo "Sem alertas" em todos os 27 UFs apesar de CEMADEN e INMET terem alertas vigentes — exatamente o oposto da postura "errar para o lado seguro" travada acima.

**Causa-raiz.** Três bugs compostos:

1. **INMET — endpoint CAP legacy morto.** O subdomínio `alertas2.inmet.gov.br/{id}` parou de responder; o adapter chamava-o por id dentro de `Promise.allSettled`, então cada fetch falhava silenciosamente e o tick retornava `[]` sem nunca lançar erro global. `consecutiveFailures` permanecia em 0.
2. **CEMADEN — regex de hazard rejeitando plural.** Live data emitia `Movimentos de Massa - Moderado` (plural); o regex `^Movimento de Massa` (singular) descartava 33% dos alertas dentro do mesmo `Promise.allSettled`.
3. **CEMADEN — `valid_until` sintético de 24h.** `datahoracriacao` é momento de criação, não janela de validade; o adapter sintetizava `valid_until = creation + 24h`, então alertas com mais de um dia eram filtrados pela consulta `valid_until > now` do `/api/ingest`. Resultado: mesmo os 8 alertas que sobreviviam ao bug 2 sumiam do snapshot.

**Por que CI não pegou.** Fixtures golden congeladas em 2026-05-18/19 não continham as variantes problemáticas (sem "Movimentos" plural, com CAP XML stub local). O teste de health verifica HTTP 200, não cardinalidade — adapter retornando `[]` continua sendo um "sucesso".

**Guardrails adicionados na correção (PR #12 closes #12/#11/#4):**

- **Cardinality test** (`tests/contract/cardinality.test.ts`) — dado um fixture com N ≥ 1 alertas upstream, o adapter precisa emitir N ≥ 1 alertas. Pega o cenário "tudo dropado".
- **`outputCount` por SourceReport** — `/api/ingest` agora reporta `outputCount` (saída do adapter) além de `alertCount` (linhas novas pós-dedup). Observável via futuro `/api/health` rico ou downstream alerting; o caso `outputCount === 0 && upstream tem entradas` é a regressão de under-warning.
- **Drift sentinel** (`.github/workflows/drift-sentinel.yml`) — workflow gated a 72h que compara o shape canônico de cada API contra um shape congelado em `tests/fixtures/sources/_shapes/`. Abre issue com label `drift` se quebrar. Pega mudanças estruturais (chaves novas, tipos diferentes) antes que elas degenerem em fail-silent.
- **Default de hazard mais permissivo no INMET.** `descricao` não mapeada agora cai em `enchente` (over-warning) em vez de throw + silent drop. Risco de classificação imprecisa, mas o alerta aparece — fiel ao CLAUDE.md.

**Lição.** Nenhum adapter pode retornar `[]` silenciosamente quando o upstream traz dados. Cardinalidade > correção: melhor classificar errado e aparecer do que classificar certo e sumir. Toda nova fonte deve ser coberta pelo cardinality test e pelo drift sentinel desde o D1.

---

## O que a UI mostra junto com a cor

Para cada estado, junto do badge de cor, mostrar:

1. **Frase explicativa de uma linha:** "Laranja: 1 alerta de Perigo do INMET para chuva forte"
2. **Lista dos alertas ativos** com fonte, tipo de perigo e link para a publicação original
3. **Timestamp:** "Atualizado há 8 minutos"
4. **Link discreto:** "Como calculamos isso?" → leva para a página de Metodologia (M3)

Se a página de Metodologia ainda não existe (ela é M3, não v1), o link aponta para uma seção do README no GitHub explicando o cálculo. **Transparência não pode esperar M3.**

---

## O que esta v0 explicitamente NÃO faz

- **Não calcula anomalias estatísticas** (déficit de chuva, anomalia de temperatura). Isso entra em M4 e exige metodologia mais cuidadosa.
- **Não pondera risco por exposição populacional.** Um alerta vermelho em estado pequeno e populoso é tratado igual a um em estado grande e despovoado. Refinar isso é complexo e fora do escopo do v1.
- **Não prevê risco futuro.** Mostra só o que está ativo agora.
- **Não combina ENSO global com alertas locais.** O status ENSO entra como informação separada em M5.
- **Não cria níveis de severidade próprios.** Se a fonte oficial diz "Alerta", não promovemos para "Alerta Máximo" nem rebaixamos.

---

## Riscos conhecidos desta v0 (documentar no README)

1. **Dependente da qualidade dos alertas oficiais.** Se Defesa Civil tarda a emitir, o site também tarda.
2. **Pode subdimensionar risco crônico.** Um estado em seca prolongada pode não ter "alerta ativo" todo dia, mesmo com situação grave. Isso será resolvido em M4 com anomalias estatísticas.
3. **Pode superdimensionar em alertas preventivos.** Uma "Atenção" do CEMADEN pode pintar o estado de amarelo mesmo sem nada acontecendo. Aceitável: melhor um falso positivo no amarelo do que falso negativo no vermelho.
4. **Vermelho acumula tudo de severo.** Não distingue "1 alerta vermelho" de "5 alertas vermelhos simultâneos em regiões diferentes". Aceitável no v1; refinar no M4.

Estes riscos devem ser **listados explicitamente** na seção de Metodologia (quando ela for criada em M3) e mencionados no README desde o v1.

---

## Versionamento da fórmula

- Esta é a versão **v0 (2026-04)**
- Toda mudança no algoritmo ou no mapeamento de severidade gera nova versão (v1, v2…)
- Histórico de versões fica em `/docs/risk-formula-history.md` no repo
- A página de Metodologia exibe qual versão da fórmula está em produção

---

## Checklist para implementação no v1

- [ ] Tipos `Severity` e `RiskLevel` definidos em `src/lib/risk/types.ts`
- [ ] Função `calculateRiskLevel()` implementada e com testes unitários cobrindo cada nível
- [ ] Mapeamentos por fonte em `src/lib/risk/sources/{cemaden,inmet,inpe}.ts` (um arquivo por fonte para fácil manutenção)
- [ ] Deduplicação testada com casos sintéticos
- [ ] Tratamento de fonte indisponível testado
- [ ] Estado "Dados indisponíveis" implementado
- [ ] Frase explicativa gerada dinamicamente para cada estado
- [ ] Versão da fórmula (v0) exibida em algum lugar discreto da UI
- [ ] Documentação no README com exemplo concreto
