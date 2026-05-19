import { NextResponse, type NextRequest } from "next/server";

const MAINTENANCE_HTML = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>ENSO Brasil — Em manutenção</title>
    <meta name="robots" content="noindex" />
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
        background: #fdfaf3;
        color: #1c1917;
        line-height: 1.55;
      }
      main {
        max-width: 640px;
        margin: 0 auto;
        padding: 48px 24px 80px;
      }
      h1 {
        font-size: 28px;
        margin: 0 0 16px;
        letter-spacing: -0.01em;
      }
      .badge {
        display: inline-block;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        background: #fef7d6;
        color: #6b5006;
        border: 1px solid #d4a017;
        padding: 4px 10px;
        border-radius: 4px;
        margin-bottom: 24px;
      }
      p { margin: 0 0 16px; }
      .callout {
        background: #fff;
        border-left: 4px solid #d4a017;
        padding: 16px 20px;
        margin: 24px 0;
      }
      ul.contacts {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      ul.contacts li {
        padding: 12px 0;
        border-bottom: 1px solid #e7e5e4;
        display: flex;
        justify-content: space-between;
        gap: 16px;
      }
      ul.contacts li:last-child { border-bottom: none; }
      ul.contacts a {
        font-weight: 600;
        font-size: 22px;
        color: #1c1917;
        text-decoration: none;
      }
      ul.contacts .label { color: #44403c; font-size: 16px; }
      footer { margin-top: 40px; font-size: 13px; color: #57534e; }
    </style>
  </head>
  <body>
    <main>
      <span class="badge">Em manutenção</span>
      <h1>ENSO Brasil está temporariamente fora do ar</h1>
      <p>
        Detectamos uma inconsistência entre os alertas oficiais (CEMADEN, INMET)
        e o que estávamos exibindo. Tiramos o painel do ar enquanto
        investigamos. Voltaremos assim que tivermos certeza de que os dados
        refletem a realidade.
      </p>

      <div class="callout">
        <strong>Em emergência, ligue para os sistemas oficiais.</strong>
        Este site é um agregador e nunca substituiu — nem substitui agora —
        a Defesa Civil, o Corpo de Bombeiros ou a Polícia.
      </div>

      <ul class="contacts">
        <li><span class="label">Defesa Civil</span><a href="tel:199">199</a></li>
        <li><span class="label">Bombeiros</span><a href="tel:193">193</a></li>
        <li><span class="label">Polícia Militar</span><a href="tel:190">190</a></li>
      </ul>

      <footer>
        Acompanhe o status em
        <a href="https://github.com/CarlosHenriqueMkt/enso-brasil/issues/12">github.com/CarlosHenriqueMkt/enso-brasil/issues/12</a>
        — código aberto MIT.
      </footer>
    </main>
  </body>
</html>`;

export const config = {
  matcher: [
    // Exclude only static asset paths + the health probe. Everything else
    // — including the home page, all dashboard routes, and the ingest /
    // states APIs that surfaced the bad data — falls back to maintenance.
    "/((?!api/health|_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)",
  ],
};

export function middleware(_req: NextRequest) {
  return new NextResponse(MAINTENANCE_HTML, {
    status: 503,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store, must-revalidate",
      "retry-after": "3600",
    },
  });
}
