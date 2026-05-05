import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    files: [
      "src/app/api/states/**/*.{ts,tsx}",
      "src/app/api/health/**/*.{ts,tsx}",
      "src/db/edge.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "pino",
              message:
                "pino is Node-only — use src/lib/log/edge.ts in edge routes (D-03).",
            },
            {
              name: "pino-pretty",
              message:
                "pino-pretty is Node-only — use src/lib/log/edge.ts in edge routes (D-03).",
            },
            {
              name: "@/lib/log/node",
              message: "Edge routes must import from src/lib/log/edge.ts.",
            },
          ],
          patterns: [
            {
              group: ["**/lib/log/node", "../**/log/node"],
              message: "Edge routes must import from src/lib/log/edge.ts.",
            },
          ],
        },
      ],
    },
  },
  // BLOCK A — production code under src/lib/risk/ (edge-safe; pure)
  {
    files: ["src/lib/risk/**/*.ts"],
    ignores: ["src/lib/risk/**/*.test.ts", "src/lib/risk/**/*.type-test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "pino", message: "Pure module — no logging in risk engine." },
            { name: "@/lib/log", message: "Pure module — no logging in risk engine." },
            { name: "fs", message: "Edge-safe — no Node built-ins in risk engine." },
            { name: "path", message: "Edge-safe — no Node built-ins in risk engine." },
            { name: "crypto", message: "Edge-safe — no Node built-ins in risk engine." },
            { name: "os", message: "Edge-safe — no Node built-ins in risk engine." },
          ],
          patterns: [
            {
              group: ["node:*"],
              message: "Edge-safe — no node:* imports in risk engine.",
            },
            {
              group: ["pino-*", "@/lib/log/*", "fs/*", "node:fs/*"],
              message: "Edge-safe — no Node built-ins / no logging in risk engine.",
            },
          ],
        },
      ],
    },
  },
  // BLOCK B — test files under src/lib/risk/: re-allow node:* + Node built-ins.
  //   Tests run only in Node (Vitest pool=forks); Node imports here do not leak
  //   into the edge-safe production graph.
  {
    files: ["src/lib/risk/**/*.test.ts", "src/lib/risk/**/*.type-test.ts"],
    rules: {
      // Disable the restriction set above. ESLint flat-config cascades:
      // later override wins for matching files.
      "no-restricted-imports": "off",
    },
  },
];
