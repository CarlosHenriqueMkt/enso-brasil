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
];
