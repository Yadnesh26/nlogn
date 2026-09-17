import Parser from "web-tree-sitter";
import { readFileSync } from "node:fs";
import { extractFacts } from "../src/worker/grounding/extract.js";
import { GROUNDED_SYSTEM } from "../src/worker/prompt/system.js";
import { buildUserMessage } from "../src/worker/prompt/analysis.js";
import { ANALYSIS_SCHEMA } from "../src/worker/prompt/schema.js";

const apiKey = process.env.NLOGN_TEST_KEY;
if (!apiKey) {
  console.error("Set NLOGN_TEST_KEY env var");
  process.exit(1);
}

const knownComplexity = JSON.parse(readFileSync("src/worker/grounding/known-complexity.json", "utf8"));

const code = `class Solution:
    def trap(self, height):
        l, r = 0, len(height) - 1
        left_max = right_max = 0
        water = 0
        while l < r:
            if height[l] < height[r]:
                l += 1
                left_max = max(left_max, height[l])
                water += left_max - height[l]
            else:
                r -= 1
                right_max = max(right_max, height[r])
                water += right_max - height[r]
        return water
`;

await Parser.init();
const language = await Parser.Language.load("node_modules/tree-sitter-wasms/out/tree-sitter-python.wasm");
const parser = new Parser();
parser.setLanguage(language);
const tree = parser.parse(code);
const facts = extractFacts(tree, "python", knownComplexity);

console.log("=== facts ===");
console.log(JSON.stringify(facts, null, 2));

const user = buildUserMessage({ language: "python", code, facts });
const model = "gemini-flash-lite-latest";
const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

const body = {
  systemInstruction: { parts: [{ text: GROUNDED_SYSTEM }] },
  contents: [{ role: "user", parts: [{ text: user }] }],
  generationConfig: {
    maxOutputTokens: 900,
    temperature: 0.1,
    responseMimeType: "application/json",
    responseSchema: ANALYSIS_SCHEMA,
  },
};

console.log("\n=== calling Gemini ===");
const res = await fetch(url, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

console.log("status:", res.status);
const data = await res.json();

if (!res.ok) {
  console.error("ERROR RESPONSE:", JSON.stringify(data, null, 2));
  process.exit(1);
}

const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
console.log("\n=== raw text ===");
console.log(text);

console.log("\n=== parsed ===");
try {
  const parsed = JSON.parse(text);
  console.log(JSON.stringify(parsed, null, 2));
  console.log("\nJSON.parse: OK, schema-shaped:", !!(parsed.time && parsed.space && parsed.optimality && parsed.issues));
} catch (e) {
  console.error("JSON.parse FAILED:", e.message);
}

console.log("\nusage:", data.usageMetadata);
