import { build } from "esbuild";
await build({
  entryPoints: ["src/cli.ts"],
  outfile: "bin/agent-evals.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  legalComments: "none",
});
await build({
  entryPoints: ["src/library.ts"],
  outfile: "bin/library.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  legalComments: "none",
});
