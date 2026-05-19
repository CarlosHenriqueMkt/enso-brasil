#!/usr/bin/env tsx
/**
 * Build Brazil UF TopoJSON from IBGE shapefile.
 *
 * Usage: pnpm geo:build
 * Output: src/lib/geo/data/states.json (TopoJSON, ~30-60 KB, properties {uf,name})
 *
 * Source: IBGE Malhas Territoriais (BR_UF_<year>.shp)
 * Simplification: Visvalingam-Weighted 5% retention (tunable)
 *
 * Idempotent. Re-run after IBGE updates and commit the diff.
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const OUT = resolve("src/lib/geo/data/states.json");
const SRC_DIR = resolve("scripts/build/ibge");

// IBGE malha UF — fallback chain by vintage year if a given year 404s.
const IBGE_URLS: Array<{ year: number; url: string }> = [
  {
    year: 2024,
    url: "https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_municipais/municipio_2024/Brasil/BR/BR_UF_2024.zip",
  },
  {
    year: 2023,
    url: "https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_municipais/municipio_2023/Brasil/BR/BR_UF_2023.zip",
  },
  {
    year: 2022,
    url: "https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_municipais/municipio_2022/Brasil/BR/BR_UF_2022.zip",
  },
];

async function fetchFirstAvailable(): Promise<{ year: number; url: string; path: string }> {
  for (const candidate of IBGE_URLS) {
    const zipPath = resolve(SRC_DIR, `BR_UF_${candidate.year}.zip`);
    if (existsSync(zipPath)) {
      console.log(`Cache hit: ${zipPath}`);
      return { ...candidate, path: zipPath };
    }
    console.log(`Trying IBGE ${candidate.year}: ${candidate.url}`);
    try {
      const res = await fetch(candidate.url);
      if (!res.ok) {
        console.log(`  -> ${res.status}, trying next`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      writeFileSync(zipPath, buf);
      console.log(`  -> wrote ${zipPath} (${(buf.length / 1024).toFixed(0)} KB)`);
      return { ...candidate, path: zipPath };
    } catch (err) {
      console.log(`  -> error: ${(err as Error).message}, trying next`);
    }
  }
  throw new Error("All IBGE URLs failed. Network down or IBGE moved.");
}

async function main() {
  if (!existsSync(SRC_DIR)) mkdirSync(SRC_DIR, { recursive: true });

  const { year, url, path: zipPath } = await fetchFirstAvailable();

  if (!existsSync(dirname(OUT))) mkdirSync(dirname(OUT), { recursive: true });

  // mapshaper accepts .zip directly when it contains .shp+.dbf+.prj.
  // IBGE ships in SIRGAS 2000 -> reproject to WGS84 for d3-geo.
  const cmd = [
    "pnpm exec mapshaper",
    `"${zipPath}"`,
    "-proj wgs84",
    "-simplify visvalingam 1% keep-shapes",
    "-filter-fields SIGLA_UF,NM_UF",
    "-rename-fields uf=SIGLA_UF,name=NM_UF",
    `-o format=topojson "${OUT}"`,
  ].join(" ");

  console.log(`\nRunning: ${cmd}\n`);
  execSync(cmd, { stdio: "inherit" });

  const topo = JSON.parse(readFileSync(OUT, "utf8"));
  const objKey = Object.keys(topo.objects)[0];
  if (!objKey) throw new Error("TopoJSON has no objects key");
  const features = topo.objects[objKey].geometries.length;
  if (features !== 27) {
    throw new Error(`Expected 27 features, got ${features}`);
  }
  const firstProps = topo.objects[objKey].geometries[0].properties;
  console.log(`\n[OK] ${OUT}`);
  console.log(`     IBGE vintage: ${year}`);
  console.log(`     Source URL:   ${url}`);
  console.log(`     Features:     ${features}`);
  console.log(`     Object key:   '${objKey}'`);
  console.log(`     First props:  ${JSON.stringify(firstProps)}`);
  console.log(`     Size:         ${(readFileSync(OUT).length / 1024).toFixed(1)} KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
