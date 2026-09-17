import Parser from "web-tree-sitter";

const SUPPORTED = new Set(["python", "java", "cpp", "javascript"]);

// LeetCode's Monaco language ids don't always match tree-sitter grammar
// names 1:1.
const LANG_ALIASES = {
  python: "python",
  python3: "python",
  java: "java",
  cpp: "cpp",
  "c++": "cpp",
  javascript: "javascript",
  typescript: "javascript", // close enough structurally for our purposes
};

let readyPromise = null;
const langCache = new Map();

function init() {
  if (!readyPromise) {
    readyPromise = Parser.init({
      locateFile: (f) => chrome.runtime.getURL(f),
    });
  }
  return readyPromise;
}

export function normalizeLang(monacoLangId) {
  return LANG_ALIASES[monacoLangId?.toLowerCase()] ?? null;
}

export function isSupported(lang) {
  return SUPPORTED.has(lang);
}

// Service workers get discarded after ~30s idle, which drops this cache —
// that's fine, re-init is a few hundred ms and not worth fighting with
// keepalive hacks.
export async function getParser(lang) {
  if (!isSupported(lang)) return null;
  await init();

  if (!langCache.has(lang)) {
    const wasmUrl = chrome.runtime.getURL(`grammars/tree-sitter-${lang}.wasm`);
    langCache.set(lang, await Parser.Language.load(wasmUrl));
  }

  const parser = new Parser();
  parser.setLanguage(langCache.get(lang));
  return parser;
}
