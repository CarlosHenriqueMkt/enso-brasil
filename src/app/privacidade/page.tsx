import { messages } from "@/lib/messages";
import { SourceLink } from "@/components/SourceLink";

export const metadata = {
  title: "Privacidade · ENSO Brasil",
  description: "Política de privacidade conforme a LGPD.",
};

export default function PrivacyPage() {
  const s = messages.privacy.sections;
  return (
    <article className="mx-auto max-w-2xl p-4">
      <h1>Privacidade · LGPD</h1>

      <section>
        <h2>{s.coletamos}</h2>
        <p>
          Logs de servidor: endereço IP, user-agent, URL acessada, timestamp. Esses dados são padrão
          de qualquer servidor web e nos ajudam a identificar erros e abuso.
        </p>
      </section>

      <section>
        <h2>{s.retencao}</h2>
        <p>
          Logs operacionais são retidos por 30 dias e então descartados automaticamente. Métricas
          agregadas (sem identificação individual) podem ser mantidas por mais tempo para
          acompanhamento de uso.
        </p>
      </section>

      <section>
        <h2>{s.paraQue}</h2>
        <p>
          Debug de erros, métricas agregadas de uso, segurança (mitigação de abuso e ataques). Nada
          é compartilhado com terceiros para fins comerciais.
        </p>
      </section>

      <section>
        <h2>{s.naoColetamos}</h2>
        <ul>
          <li>Cookies de tracking ou analytics que identifiquem usuários individualmente</li>
          <li>Identificadores cross-site</li>
          <li>Dados pessoais voluntários (não há cadastro, login, ou formulários de contato)</li>
          <li>Localização precisa via GPS ou similar</li>
        </ul>
      </section>

      <section>
        <h2>{s.direitos}</h2>
        <p>
          Sob a LGPD (Lei 13.709/2018), você tem direito a: acesso aos seus dados, correção,
          exclusão, portabilidade, revogação de consentimento, e informação sobre uso. Como o ENSO
          Brasil não coleta dados pessoais identificáveis além de logs operacionais limitados, o
          exercício desses direitos no v1 se limita a solicitar a exclusão antecipada de logs
          associados ao seu IP via o canal de contato abaixo.
        </p>
      </section>

      <section>
        <h2>{s.contato}</h2>
        <p>
          Para todas as questões — solicitações LGPD, disclosure de segurança, dúvidas gerais —
          entre em contato com {messages.privacy.contactName} via:{" "}
          <SourceLink href={messages.privacy.contactUrl} name="LinkedIn" />. Quando o domínio
          próprio for adquirido (previsto na fase de lançamento), este canal será atualizado para um
          e-mail dedicado.
        </p>
      </section>

      <section>
        <h2>{s.versao}</h2>
        <p>{messages.privacy.version}</p>
      </section>
    </article>
  );
}
