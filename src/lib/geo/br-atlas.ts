/**
 * Server-side TopoJSON loader for Brazil UF features.
 *
 * Source: IBGE Malhas Territoriais BR_UF_2022 (see 05-01-spike-results.md).
 * Built by `pnpm geo:build` → `src/lib/geo/data/states.json` (78.4 KB, 27 features,
 * topology object key `BR_UF_2022`, properties `{uf, name}`).
 *
 * Node-only: uses `node:fs/promises`. Any route consuming `loadBrAtlas()` MUST
 * stay on the Node runtime (do NOT add `export const runtime = "edge"`).
 *
 * Caching: result is memoised in a module-scope promise so the JSON parses once
 * per server process lifetime, even under concurrent first-paint loads.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { feature } from "topojson-client";
import { UF27_PROVISIONAL } from "@/lib/sources/schema";

export type UF = (typeof UF27_PROVISIONAL)[number];

export interface UFProperties {
  uf: UF;
  name: string;
}

/** Minimal GeoJSON geometry surface needed by this loader. */
export type UFGeometry = {
  type: string;
  coordinates: unknown;
};

export interface UFFeature {
  type: "Feature";
  geometry: UFGeometry;
  properties: UFProperties;
}

export interface UFFeatureCollection {
  type: "FeatureCollection";
  features: UFFeature[];
}

const TOPOLOGY_OBJECT_KEY = "BR_UF_2022";
const TOPOJSON_PATH = path.join(process.cwd(), "src/lib/geo/data/states.json");

let cached: Promise<UFFeatureCollection> | null = null;

/**
 * Loads and projects the BR_UF_2022 TopoJSON into a GeoJSON FeatureCollection.
 * Returns the same Promise instance on every subsequent call (module-scope cache).
 */
export function loadBrAtlas(): Promise<UFFeatureCollection> {
  if (cached) return cached;
  cached = (async () => {
    const raw = await readFile(TOPOJSON_PATH, "utf8");
    // topojson-client's typings model `Topology` and `GeometryObject`; we use a
    // local structural cast to avoid pulling `topojson-specification` as a
    // direct devDep (already transitively present via @types/topojson-client).
    const topology = JSON.parse(raw) as {
      objects: Record<string, unknown>;
    };
    const obj = topology.objects[TOPOLOGY_OBJECT_KEY];
    if (!obj) {
      throw new Error(
        `loadBrAtlas: TopoJSON object key "${TOPOLOGY_OBJECT_KEY}" missing — got [${Object.keys(
          topology.objects,
        ).join(", ")}]`,
      );
    }
    // Cast via `unknown` because `topojson-client`'s generics expect the formal
    // `Topology<Objects>` shape and we deliberately keep the loader untyped at
    // that boundary (the runtime contract is asserted by the test suite).
    const fc = feature(
      topology as unknown as Parameters<typeof feature>[0],
      obj as unknown as Parameters<typeof feature>[1],
    ) as unknown as UFFeatureCollection;
    return fc;
  })();
  return cached;
}

/** Test-only: reset the module cache. Not exported from the public surface. */
export function __resetBrAtlasCacheForTests(): void {
  cached = null;
}
