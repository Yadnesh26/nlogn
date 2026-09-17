import * as esbuild from "esbuild";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";

const watch = process.argv.includes("--watch");
const outdir = "dist";

rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir, { recursive: true });

const entries = [
  { in: "src/bridge/index.js", out: "bridge", format: "iife" },
  { in: "src/content/index.js", out: "content", format: "iife" },
  // web-tree-sitter's UMD wrapper has Node-only branches (require("fs")/
  // require("path")) behind a runtime ENVIRONMENT_IS_NODE check that's
  // always false in a service worker — esbuild still tries to statically
  // resolve those requires when bundling, so they're marked external.
  { in: "src/worker/index.js", out: "worker", format: "esm", external: ["fs", "path"] },
  { in: "src/options/index.js", out: "options", format: "iife" },
  { in: "src/onboarding/index.js", out: "onboarding", format: "iife" },
];

const ctxs = await Promise.all(
  entries.map((e) =>
    esbuild.context({
      entryPoints: [e.in],
      outfile: `${outdir}/${e.out}.js`,
      bundle: true,
      format: e.format,
      target: "chrome110",
      sourcemap: true,
      logLevel: "info",
      external: e.external ?? [],
    })
  )
);

const GRAMMAR_LANGS = ["python", "java", "cpp", "javascript"];

function copyStatic() {
  cpSync("manifest.json", `${outdir}/manifest.json`);
  cpSync("src/options/options.html", `${outdir}/options.html`);
  cpSync("src/onboarding/onboarding.html", `${outdir}/onboarding.html`);
  if (existsSync("grammars")) cpSync("grammars", `${outdir}/grammars`, { recursive: true });
  if (existsSync("icons")) cpSync("icons", `${outdir}/icons`, { recursive: true });

  // tree-sitter WASM: the core runtime at the extension root, and each
  // language grammar lazy-loaded from grammars/ (see src/worker/grounding).
  cpSync("node_modules/web-tree-sitter/tree-sitter.wasm", `${outdir}/tree-sitter.wasm`);
  mkdirSync(`${outdir}/grammars`, { recursive: true });
  for (const lang of GRAMMAR_LANGS) {
    cpSync(
      `node_modules/tree-sitter-wasms/out/tree-sitter-${lang}.wasm`,
      `${outdir}/grammars/tree-sitter-${lang}.wasm`
    );
  }
}

if (watch) {
  await Promise.all(ctxs.map((c) => c.watch()));
  copyStatic();
  console.log("watching for changes...");
} else {
  await Promise.all(ctxs.map((c) => c.rebuild()));
  copyStatic();
  await Promise.all(ctxs.map((c) => c.dispose()));
  console.log(`build complete -> ${outdir}/`);
}
