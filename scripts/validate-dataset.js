import Parser from "web-tree-sitter";
import { readFileSync, readdirSync } from "node:fs";
import { extractFacts } from "../src/worker/grounding/extract.js";

const knownComplexity = JSON.parse(readFileSync("src/worker/grounding/known-complexity.json", "utf8"));

await Parser.init();
const langCache = new Map();
async function getLang(lang) {
  if (!langCache.has(lang)) {
    langCache.set(lang, await Parser.Language.load(`node_modules/tree-sitter-wasms/out/tree-sitter-${lang}.wasm`));
  }
  return langCache.get(lang);
}

const files = readdirSync("eval/dataset").filter((f) => f.endsWith(".json"));
let ok = 0;
for (const f of files) {
  const entry = JSON.parse(readFileSync(`eval/dataset/${f}`, "utf8"));
  try {
    const parser = new Parser();
    parser.setLanguage(await getLang(entry.language));
    const tree = parser.parse(entry.code);
    const hasError = tree.rootNode.hasError();
    const facts = extractFacts(tree, entry.language, knownComplexity);
    console.log(
      `${hasError ? "SYNTAX-ERR" : "OK"}  ${entry.id.padEnd(24)} loops=${facts.loops.length} recursion=${facts.recursion.length} calls=${facts.library_calls.length}`
    );
    if (!hasError) ok++;
  } catch (err) {
    console.log(`CRASH  ${entry.id}: ${err.message}`);
  }
}
console.log(`\n${ok}/${files.length} parsed cleanly`);
