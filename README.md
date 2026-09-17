# nlogn

*Know why it failed, not just that it did.*

A BYOK Chrome extension for LeetCode that grounds AI complexity analysis in real AST facts, and diagnoses failed submissions. No backend, no auth, no billing — your code and API key go straight from your browser to your chosen provider.

## Does grounding actually help?

Every competing extension pipes source text at a cheap model and prints whatever Big-O comes back. nlogn parses the code with tree-sitter first and hands the model verified structural facts (loop nesting, two-pointer convergence, recursion/memoization, library-call complexity) instead of asking it to infer structure from text.

Measured on a 19-entry labeled dataset (seed set — the plan targets 100–150; see [`eval/`](eval/)) across 4 ablation configs, judged on real Gemini Flash Lite calls:

| Config | Time (exact) | Time (family) | Space (exact) | Avg cost/call |
|---|---|---|---|---|
| A — naive prompt | 74% | 74% | 84% | $0.00005 |
| B — + structured output | 95% | 100% | 95% | $0.00012 |
| C — + AST grounding | 95% | 100% | 95% | $0.00014 |
| D — + self-consistency | 94% | 100% | 94% | $0.00014 |

*"Exact" = canonical string match (`O(N)` ≡ `O(n)` ≡ `Θ(n)` ≡ `O(2n)`). "Family" = same growth class ignoring variable naming (`O(n)` ≡ `O(V+E)`).*

The number that actually matters is per-category, not the aggregate — three traps went from **0% → 100%** once structured output + grounding replaced the naive baseline:

| Category | Naive (A) | Grounded (C) |
|---|---|---|
| Sorting hidden in a library call (`sorted()` dominates a linear scan) | 0% | 100% |
| Output-dominated space (subset generation, `2^n` outputs) | 0% | 100% |
| Union-Find with path compression (inverse-Ackermann notation) | 0% | 100% |

Honest finding: B and C are *tied* at n=19 — grounding facts didn't measurably beat schema-constraint alone on this seed. That could mean Gemini reads loop/call patterns well enough from raw code without hand-fed facts, or it's noise at this sample size (one entry ≈ 5 points). Resolving that needs the full dataset, not a bigger claim than the data supports.

Full methodology, per-category breakdown, and calibration check: [`eval/run.js`](eval/run.js) and [`eval/report.js`](eval/report.js). Re-run it yourself: `NLOGN_TEST_KEY=<your-gemini-key> npm run eval && npm run eval:report`.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ leetcode.com page (MAIN world)                               │
│                                                                │
│   window.monaco ──────┐                                      │
│   window.fetch ───────┤                                      │
│                        │                                      │
│   ┌────────────────────▼──────────────────┐                  │
│   │ bridge.js  (world: MAIN)               │                  │
│   │  • reads Monaco models                 │                  │
│   │  • patches fetch/XHR for submissions    │                  │
│   │  • patches history.pushState            │                  │
│   └────────────────────┬──────────────────┘                  │
│                        │ window.postMessage                   │
│   ┌────────────────────▼──────────────────┐                  │
│   │ content.js  (ISOLATED world)           │                  │
│   │  • mounts Shadow DOM panel              │                  │
│   │  • owns UI state                        │                  │
│   │  • fetches problem context via GraphQL  │                  │
│   └────────────────────┬──────────────────┘                  │
└────────────────────────┼─────────────────────────────────────┘
                          │ chrome.runtime.sendMessage
             ┌────────────▼─────────────────────────────┐
             │ worker.js (service worker)                │
             │  • tree-sitter WASM parse → GroundingFacts │
             │  • prompt assembly (analysis / diagnosis)  │
             │  • LLMProvider.analyze()  ──────────────────► Gemini (DeepSeek/OpenAI/Anthropic scaffolded)
             │  • chrome.storage (key, settings)          │
             └────────────────────────────────────────────┘
```

The content script can't see `window.monaco` (isolated world). The bridge can, but shouldn't hold the API key (page JS could read it). The service worker holds the key and does WASM parsing + network calls.

## Features

- **Grounded complexity analysis** — Big-O for time and space, justified per code block against real parsed structure, with calibrated confidence (not every answer is asserted as certain).
- **Failed-submission diagnostics** — auto-triggers on TLE/WA/MLE/RE/Compile Error/Accepted, explains *why*, and for Wrong Answer specifically **never shows the fix** — only the bug category and the failing input, enforced both at the prompt level and programmatically (a leak-detector redacts responses that slip past the prompt).
- **Optimality check** — flags when a passing solution isn't the best known approach, as a hint only, never as code.

Supported languages for grounding: Python, Java, C++, JavaScript. Other languages still get analyzed, just without AST facts (lower confidence, clearly labeled "ungrounded" in the UI).

## Install (unpacked, for testing)

```
npm install
npm run build
```

Then in Chrome: `chrome://extensions` → enable Developer mode → Load unpacked → select `dist/`.

Open any `leetcode.com/problems/*` page, paste a Gemini API key (free tier, no credit card) into the nlogn settings, and click the pill next to Submit.

## What this isn't

- Not a Premium-content unlocker — never fetches or displays locked problems, editorials, or company tags.
- Not an interview-cheating tool — no stealth mode, no auto-solve, and the WA diagnosis path is deliberately designed to never hand over the fix.
- Not a hosted service — BYOK only; there is no nlogn backend and there is nothing to sign up for.

## Status

Built through the plan's P1–P4 (skeleton, grounding, eval harness, diagnostics). P5 (store shipping) in progress — see [`nlogn-implementation-plan.md`](nlogn-implementation-plan.md) for the full phased plan this was built against.
