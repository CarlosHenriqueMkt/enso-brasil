# Política de segurança

ENSO Brasil é um projeto adjacente à segurança pública. Vulnerabilidades de segurança são tratadas com prioridade e disclosure responsável.

## Como reportar uma vulnerabilidade

**NÃO abra um issue público para vulnerabilidades de segurança.** Issues públicos expõem o problema antes que possa ser corrigido.

Reporte por **DM no LinkedIn** (canal único de contato em v1, conforme decisão D-05):

`https://www.linkedin.com/in/carloshenriquerp/`

Inclua na mensagem:

- Descrição da vulnerabilidade
- Passos para reproduzir (URL afetada, payload, comportamento esperado vs. observado)
- Impacto potencial (vazamento de dados, execução de código, negação de serviço, etc.)
- Sua recomendação de mitigação, se houver

## SLA de resposta

- **Resposta inicial:** em até 7 dias úteis após o recebimento da DM.
- **Atualização de status:** a cada 14 dias até resolução ou decisão documentada de não-mitigação.
- **Disclosure coordenado:** após patch disponível, créditos serão dados ao reporter (a menos que prefira anonimato).

## Escopo

**Em escopo:**
- A aplicação web pública hospedada (rotas Next.js, APIs internas, endpoints `/api/*`).
- O código deste repositório.
- Configuração de infraestrutura (Vercel, Upstash, Neon, GitHub Actions) sob nosso controle.

**Fora de escopo:**
- Vulnerabilidades nas **fontes oficiais** (CEMADEN, INMET, INPE/FIRMS, NOAA) — devem ser reportadas diretamente ao órgão correspondente.
- Ataques de engenharia social contra mantenedores ou usuários.
- Vulnerabilidades em dependências de terceiros que já tenham CVE público (use o canal upstream).
- Issues de UX ou bugs funcionais não-críticos — use [`.github/ISSUE_TEMPLATE/bug_report.md`](./.github/ISSUE_TEMPLATE/bug_report.md).

## Transição futura

Quando um endereço de e-mail dedicado existir (a partir do P7, com domínio próprio), este canal será atualizado e este documento será revisado. Até lá, **DM no LinkedIn** é o canal autoritativo.
