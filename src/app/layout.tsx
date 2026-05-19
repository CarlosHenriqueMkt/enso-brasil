import "./globals.css";
import { messages } from "@/lib/messages";
import { EmergencyButton } from "@/components/emergency/EmergencyButton";

export const metadata = {
  title: "ENSO Brasil",
  description:
    "Agregador público de alertas climáticos no Brasil. Não substitui sistemas oficiais de alerta.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-bg text-ink-1 font-sans h-screen flex flex-col overflow-hidden">
        <a href="#main" className="skip-link">
          {messages.a11y.skipLink}
        </a>

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">{children}</div>

        <footer className="border-t border-hairline px-s-3 py-s-1 text-card-meta text-ink-3 shrink-0">
          <p>{messages.disclaimer.body}</p>
        </footer>
        <EmergencyButton />
      </body>
    </html>
  );
}
