/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "risk-engine-isolation",
      severity: "error",
      comment:
        "src/lib/risk/calculate.ts must only import from ./types (RISK-01)",
      from: { path: "^src/lib/risk/calculate\\.ts$" },
      to: { pathNot: "^src/lib/risk/types\\.ts$" },
    },
    {
      name: "risk-engine-no-node",
      severity: "error",
      comment: "src/lib/risk/** must not import node:* (edge-safe)",
      from: { path: "^src/lib/risk/" },
      to: { path: "^node:" },
    },
  ],
  options: {
    tsConfig: { fileName: "tsconfig.json" },
    doNotFollow: { path: "node_modules" },
  },
};
