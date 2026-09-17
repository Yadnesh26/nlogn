import { readFileSync, readdirSync } from "node:fs";
import { equivalent, familyEquivalent } from "../src/shared/bigo.js";

const results = JSON.parse(readFileSync("eval/results.json", "utf8"));

// acceptable_alternates live in the dataset source, not results.json —
// cross-reference by id rather than re-running the (cached, free) eval.
const alternatesById = Object.fromEntries(
  readdirSync("eval/dataset")
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(`eval/dataset/${f}`, "utf8")))
    .map((e) => [e.id, e.acceptable_alternates ?? {}])
);

function matchesAny(predicted, side, entry, matcher) {
  if (!predicted) return false;
  if (matcher(predicted, entry.ground_truth[side])) return true;
  const alts = alternatesById[entry.id]?.[side] ?? [];
  return alts.some((alt) => matcher(predicted, alt));
}
const CONFIGS = ["A", "B", "C", "D"];
const CONFIG_LABEL = {
  A: "A  naive prompt",
  B: "B  + structured output",
  C: "C  + AST grounding",
  D: "D  + self-consistency",
};

function tokenCost(usage) {
  // Gemini Flash Lite list pricing at time of writing — treat as a rough
  // estimate, not billed fact; rates change and are worth re-checking
  // against the current pricing page before quoting this externally.
  const inTok = usage?.promptTokenCount ?? usage?.promptTokensDetails?.[0]?.tokenCount ?? 0;
  const outTok = usage?.candidatesTokenCount ?? 0;
  return (inTok / 1_000_000) * 0.075 + (outTok / 1_000_000) * 0.3;
}

function score(entries, config) {
  let timeExact = 0,
    timeFamily = 0,
    spaceExact = 0,
    spaceFamily = 0,
    errors = 0,
    totalCost = 0,
    n = 0;

  for (const e of entries) {
    const r = e[config];
    if (!r || r.error) {
      errors++;
      continue;
    }
    n++;
    if (matchesAny(r.time, "time", e, equivalent)) timeExact++;
    if (matchesAny(r.time, "time", e, familyEquivalent)) timeFamily++;
    if (matchesAny(r.space, "space", e, equivalent)) spaceExact++;
    if (matchesAny(r.space, "space", e, familyEquivalent)) spaceFamily++;
    totalCost += tokenCost(r.usage);
  }

  const pct = (x) => (n ? ((x / n) * 100).toFixed(0) + "%" : "—");
  return {
    timeExact: pct(timeExact),
    timeFamily: pct(timeFamily),
    spaceExact: pct(spaceExact),
    spaceFamily: pct(spaceFamily),
    errors,
    avgCost: n ? `$${(totalCost / n).toFixed(6)}` : "—",
  };
}

console.log(`Dataset: ${results.length} entries\n`);
console.log("| Config                  | Time (exact) | Time (family) | Space (exact) | Avg cost/call | Errors |");
console.log("|--------------------------|--------------|----------------|----------------|----------------|--------|");
for (const cfg of CONFIGS) {
  const s = score(results, cfg);
  console.log(
    `| ${CONFIG_LABEL[cfg].padEnd(24)} | ${s.timeExact.padStart(12)} | ${s.timeFamily.padStart(14)} | ${s.spaceExact.padStart(14)} | ${s.avgCost.padStart(14)} | ${String(s.errors).padStart(6)} |`
  );
}

// Per-category, config C only — this is the number that actually tells you
// whether grounding helped, per-pattern (section 8.3: "grounding took
// two-pointer from 40% to 95%" is more useful than any aggregate). Shows
// both exact and family match — exact-only can look like a miss when it's
// really just a variable-naming difference (O(r*c) vs O(m*n)).
console.log("\nPer-category (config C, AST grounding) — exact / family:\n");
const categories = [...new Set(results.map((e) => e.category))];
for (const cat of categories) {
  const subset = results.filter((e) => e.category === cat);
  const cScore = score(subset, "C");
  const aScore = score(subset, "A");
  console.log(
    `  ${cat.padEnd(38)} A: ${aScore.timeExact.padStart(4)}/${aScore.timeFamily.padStart(4)} -> C: ${cScore.timeExact.padStart(4)}/${cScore.timeFamily.padStart(4)}  (n=${subset.length})`
  );
}

// Calibration: does config C's stated confidence actually predict accuracy?
// If "high" isn't meaningfully better than "low", the confidence signal is
// noise and the UI shouldn't display it.
console.log("\nCalibration (config C, time confidence vs actual accuracy):\n");
const buckets = { high: [], medium: [], low: [] };
for (const e of results) {
  const r = e.C;
  const conf = r?.raw?.time?.confidence;
  if (conf && buckets[conf]) {
    buckets[conf].push(matchesAny(r.time, "time", e, equivalent));
  }
}
for (const [level, arr] of Object.entries(buckets)) {
  const correct = arr.filter(Boolean).length;
  const rate = arr.length ? ((correct / arr.length) * 100).toFixed(0) + "%" : "—";
  console.log(`  ${level.padEnd(8)} n=${String(arr.length).padEnd(4)} accuracy=${rate}`);
}
