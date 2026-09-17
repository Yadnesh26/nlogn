// Runs the dataset through the 4 ablation configs from the plan:
//   A — naive prompt, raw source, free-form output
//   B — + strict JSON schema, no grounding facts
//   C — + tree-sitter GroundingFacts (the production path)
//   D — + self-consistency (2 C-samples; escalate to a stronger model on disagreement)
// Responses are cached to disk by content hash, so re-running costs nothing
// unless the code/prompt/config actually changed.
import Parser from "web-tree-sitter";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { extractFacts } from "../src/worker/grounding/extract.js";
import { GROUNDED_SYSTEM } from "../src/worker/prompt/system.js";
import { buildUserMessage } from "../src/worker/prompt/analysis.js";
import { ANALYSIS_SCHEMA } from "../src/worker/prompt/schema.js";
import { equivalent } from "../src/shared/bigo.js";

const API_KEY = process.env.NLOGN_TEST_KEY;
if (!API_KEY) {
  console.error("Set NLOGN_TEST_KEY env var");
  process.exit(1);
}

const BASE_MODEL = "gemini-flash-lite-latest";
const STRONG_MODEL = "gemini-flash-latest";
const CACHE_DIR = "eval/cache";
const PROMPT_VERSION = "v1";

const NAIVE_SYSTEM = `You analyze algorithmic complexity of source code.
State the worst-case time and space complexity in Big-O notation and give a
short justification. Be concise.`;

mkdirSync(CACHE_DIR, { recursive: true });

function cacheKey(parts) {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 24);
}

// Serializes actual network calls with a fixed gap — free-tier RPM limits
// are low enough (as low as ~15/min on some tiers) that even sequential
// per-entry calls can burst too fast without this.
let lastCallAt = 0;
const MIN_GAP_MS = 4000;
async function throttle() {
  const wait = lastCallAt + MIN_GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
}

async function callGemini({ model, system, user, schema }) {
  await throttle();
  const generationConfig = { maxOutputTokens: 900, temperature: 0.1 };
  if (schema) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = schema;
  }
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig,
      }),
    }
  );
  if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  const usage = data?.usageMetadata ?? {};
  return { text, usage };
}

async function cachedCall(keyParts, fn) {
  const key = cacheKey(keyParts);
  const path = `${CACHE_DIR}/${key}.json`;
  if (existsSync(path)) return JSON.parse(readFileSync(path, "utf8"));
  const result = await fn();
  writeFileSync(path, JSON.stringify(result, null, 2));
  return result;
}

function extractBigO(parsedOrText, side) {
  // Config A returns free text — pull a Big-O-shaped substring for that side.
  if (typeof parsedOrText === "string") {
    const re = new RegExp(`${side}[^.\\n]*?(O\\([^)]*\\)|Θ\\([^)]*\\))`, "i");
    return parsedOrText.match(re)?.[1] ?? null;
  }
  return parsedOrText?.[side]?.big_o ?? null;
}

async function runConfigA(entry) {
  const user = `Language: ${entry.language}\n\nCode:\n${entry.code}`;
  const { text, usage } = await cachedCall(["A", PROMPT_VERSION, entry.id], () =>
    callGemini({ model: BASE_MODEL, system: NAIVE_SYSTEM, user })
  );
  return { time: extractBigO(text, "time"), space: extractBigO(text, "space"), usage, raw: text };
}

async function runConfigB(entry) {
  const user = buildUserMessage({ language: entry.language, code: entry.code, facts: null });
  const { text, usage } = await cachedCall(["B", PROMPT_VERSION, entry.id], () =>
    callGemini({ model: BASE_MODEL, system: GROUNDED_SYSTEM, user, schema: ANALYSIS_SCHEMA })
  );
  const parsed = JSON.parse(text);
  return { time: extractBigO(parsed, "time"), space: extractBigO(parsed, "space"), usage, raw: parsed };
}

async function runConfigC(entry, facts) {
  const user = buildUserMessage({ language: entry.language, code: entry.code, facts });
  const { text, usage } = await cachedCall(["C", PROMPT_VERSION, entry.id], () =>
    callGemini({ model: BASE_MODEL, system: GROUNDED_SYSTEM, user, schema: ANALYSIS_SCHEMA })
  );
  const parsed = JSON.parse(text);
  return { time: extractBigO(parsed, "time"), space: extractBigO(parsed, "space"), usage, raw: parsed };
}

async function runConfigD(entry, facts) {
  const user = buildUserMessage({ language: entry.language, code: entry.code, facts });
  const sample = (n) =>
    cachedCall(["D-sample", PROMPT_VERSION, entry.id, n], () =>
      callGemini({ model: BASE_MODEL, system: GROUNDED_SYSTEM, user, schema: ANALYSIS_SCHEMA })
    );

  const [r1, r2] = await Promise.all([sample(1), sample(2)]);
  const p1 = JSON.parse(r1.text);
  const p2 = JSON.parse(r2.text);
  const agree = equivalent(p1.time.big_o, p2.time.big_o) && equivalent(p1.space.big_o, p2.space.big_o);

  if (agree) {
    return {
      time: p1.time.big_o,
      space: p1.space.big_o,
      usage: r1.usage,
      escalated: false,
      raw: p1,
    };
  }

  const { text: escText, usage: escUsage } = await cachedCall(["D-escalate", PROMPT_VERSION, entry.id], () =>
    callGemini({ model: STRONG_MODEL, system: GROUNDED_SYSTEM, user, schema: ANALYSIS_SCHEMA })
  );
  const escParsed = JSON.parse(escText);
  return {
    time: escParsed.time.big_o,
    space: escParsed.space.big_o,
    usage: escUsage,
    escalated: true,
    raw: escParsed,
  };
}

async function main() {
  await Parser.init();
  const langCache = new Map();
  async function getParser(lang) {
    if (!langCache.has(lang)) {
      langCache.set(lang, await Parser.Language.load(`node_modules/tree-sitter-wasms/out/tree-sitter-${lang}.wasm`));
    }
    const p = new Parser();
    p.setLanguage(langCache.get(lang));
    return p;
  }

  const knownComplexity = JSON.parse(readFileSync("src/worker/grounding/known-complexity.json", "utf8"));
  const files = readdirSync("eval/dataset").filter((f) => f.endsWith(".json"));
  const entries = files.map((f) => JSON.parse(readFileSync(`eval/dataset/${f}`, "utf8")));

  const results = [];
  for (const entry of entries) {
    process.stdout.write(`${entry.id}... `);
    const parser = await getParser(entry.language);
    const facts = extractFacts(parser.parse(entry.code), entry.language, knownComplexity);

    // Sequential, not Promise.all — bursting ~5 concurrent calls per entry
    // across the dataset blew past the free-tier per-minute rate limit.
    // Cached calls resolve instantly so this only slows down actual retries.
    const a = await runConfigA(entry).catch((e) => ({ error: String(e.message) }));
    const b = await runConfigB(entry).catch((e) => ({ error: String(e.message) }));
    const c = await runConfigC(entry, facts).catch((e) => ({ error: String(e.message) }));
    const d = await runConfigD(entry, facts).catch((e) => ({ error: String(e.message) }));

    results.push({ id: entry.id, category: entry.category, ground_truth: entry.ground_truth, A: a, B: b, C: c, D: d });
    console.log("done");
  }

  writeFileSync("eval/results.json", JSON.stringify(results, null, 2));
  console.log(`\nwrote eval/results.json (${results.length} entries)`);
}

main();
