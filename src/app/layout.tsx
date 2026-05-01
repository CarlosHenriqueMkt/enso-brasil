import "./globals.css";
import { messages } from "@/lib/messages";

export const metadata = {
  title: "ENSO Brasil",
  description:
    "Agregador público de alertas climáticos no Brasil. Não substitui sistemas oficiais de alerta.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-bg text-ink-1 font-sans">
        <a href="#main" className="skip-link">
          {messages.a11y.skipLink}
        </a>

        <main id="main">{children}</main>

        <footer className="border-t border-hairline p-4 text-ink-2">
          <p>{messages.disclaimer.body}</p>
          <p className="font-mono">{messages.emergency.inline}</p>
        </footer>
      </body>
    </html>
  );
}
