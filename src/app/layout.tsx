import "./globals.css";

export const metadata = {
  title: "ENSO Brasil",
  description: "Agregador público de alertas climáticos no Brasil.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
