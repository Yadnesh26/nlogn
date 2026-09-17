# nlogn — Implementation Plan

**A BYOK Chrome extension for LeetCode that grounds AI complexity analysis in real AST facts, and diagnoses failed submissions.**

**Name:** `nlogn` — always lowercase, never `NLogN` or `nLogN`. Spoken "en log en."

**Tagline:** *Know why it failed, not just that it did.*

Everything below assumes: no backend, no auth, no billing, $0 running cost.

---

## 0. Scope

### What this is
A Manifest V3 extension that injects a panel into LeetCode and provides:
1. **Grounded complexity analysis** — Big-O for time and space, justified per code block, backed by a real parse rather than a raw prompt.
2. **Failed-submission diagnostics** — when you get TLE/WA/MLE, it explains *why that specific testcase failed*.
3. **Optimality check** — is this the best known approach, and if not, what's the gap.

### What this is not
- Not a Premium-content unlocker. Do not fetch, cache, or display locked problems, official editorials, or company tags. That is redistributing paywalled content and it is the fastest route to a legal takedown.
- Not an interview-cheating tool. No stealth mode, no auto-solve, no invisibility.
- Not a hosted service. Users bring their own API key.

### Non-goals for v1
- Multi-browser (ship Chrome/Edge first; Firefox MV3 differs enough to defer)
- Every LeetCode language (start with 4)
- Mock interviews, flashcards, spaced repetition (LeetCopilot owns that space)

---

## 1. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ leetcode.com page (MAIN world)                              │
│                                                             │
│   window.monaco ──────┐                                     │
│   window.fetch ───────┤                                     │
│                       │                                     │
│   ┌───────────────────▼──────────────────┐                  │
│   │ bridge.js  (world: MAIN)             │                  │
│   │  • reads Monaco models               │                  │
│   │  • patches fetch/XHR for submissions │                  │
│   │  • patches history.pushState         │                  │
│   └───────────────┬──────────────────────┘                  │
│                   │ window.postMessage                      │
│   ┌───────────────▼──────────────────────┐                  │
│   │ content.js  (ISOLATED world)         │                  │
│   │  • mounts Shadow DOM panel           │                  │
│   │  • owns UI state                     │                  │
│   │  • local result cache                │                  │
│   └───────────────┬──────────────────────┘                  │
└───────────────────┼─────────────────────────────────────────┘
                    │ chrome.runtime.sendMessage
       ┌────────────▼─────────────────────────────┐
       │ service-worker.js                        │
       │  • tree-sitter WASM parse → grounding    │
       │  • prompt assembly                       │
       │  • LLMProvider.analyze()  ──────────────────► Gemini / DeepSeek / OpenAI / Anthropic
       │  • chrome.storage (key, settings, cache) │
       └──────────────────────────────────────────┘
```

**Why the split:** the content script cannot see `window.monaco` (isolated world). The bridge can, but shouldn't hold your API key (page JS could read it). The service worker holds the key and does network + WASM.

---

## 2. Repo structure

```
nlogn/
├── src/
│   ├── bridge/
│   │   ├── index.js              # MAIN world entry
│   │   ├── monaco.js             # editor model extraction
│   │   ├── interceptor.js        # fetch/XHR submission capture
│   │   └── navigation.js         # SPA route change events
│   ├── content/
│   │   ├── index.js              # mount/unmount lifecycle
│   │   ├── panel/                # UI components
│   │   ├── mount-points.js       # DOM anchor strategies + fallback
│   │   └── bridge-client.js      # postMessage RPC wrapper
│   ├── worker/
│   │   ├── index.js              # message router
│   │   ├── grounding/
│   │   │   ├── parser.js         # tree-sitter init + lazy grammar load
│   │   │   ├── extract.js        # AST → GroundingFacts
│   │   │   └── known-complexity.json
│   │   ├── providers/
│   │   │   ├── base.js           # LLMProvider interface
│   │   │   ├── gemini.js
│   │   │   ├── deepseek.js
│   │   │   ├── openai.js
│   │   │   └── anthropic.js
│   │   ├── prompt/
│   │   │   ├── system.txt
│   │   │   ├── analysis.js       # user message assembly
│   │   │   └── schema.json       # AnalysisResult JSON Schema
│   │   └── cache.js              # content-hash result cache
│   ├── options/                  # settings + onboarding wizard
│   └── shared/
│       ├── types.ts
│       └── bigo.js               # canonicalization + comparison
├── grammars/                     # *.wasm, lazy-loaded
├── eval/
│   ├── dataset/                  # labeled solutions
│   ├── run.js
│   └── report.js
├── manifest.json
└── README.md
```

---

## 3. manifest.json

```json
{
  "manifest_version": 3,
  "name": "nlogn",
  "version": "0.1.0",
  "description": "Grounded complexity analysis and failed-submission diagnostics for LeetCode.",
  "permissions": ["storage"],
  "host_permissions": [
    "https://leetcode.com/*",
    "https://generativelanguage.googleapis.com/*",
    "https://api.deepseek.com/*",
    "https://api.openai.com/*",
    "https://api.anthropic.com/*"
  ],
  "background": { "service_worker": "worker.js", "type": "module" },
  "content_scripts": [
    {
      "matches": ["https://leetcode.com/problems/*"],
      "js": ["bridge.js"],
      "world": "MAIN",
      "run_at": "document_start"
    },
    {
      "matches": ["https://leetcode.com/problems/*"],
      "js": ["content.js"],
      "world": "ISOLATED",
      "run_at": "document_idle"
    }
  ],
  "web_accessible_resources": [
    {
      "resources": ["grammars/*.wasm", "tree-sitter.wasm"],
      "matches": ["https://leetcode.com/*"]
    }
  ],
  "content_security_policy": {
    "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
  },
  "options_page": "options.html"
}
```

**Critical:** `wasm-unsafe-eval` is required or tree-sitter will not initialize in the service worker. This is the single most common reason WASM-in-MV3 silently fails.

**Note:** `run_at: document_start` on the bridge is mandatory — you must patch `fetch` before LeetCode's own code captures a reference to it.

---

## 4. Phase plan

| Phase | Duration | Deliverable | Done when |
|---|---|---|---|
| **P1** Skeleton | ~1 week | Panel renders raw model output on a real problem | You can click Analyze and see unstructured text |
| **P2** Grounding | ~1 week | tree-sitter parse → structured JSON result | Analysis returns valid schema-conformant JSON |
| **P3** Eval | ~1 week | Benchmark + ablation table | You have real accuracy numbers for 4 configs |
| **P4** Diagnostics | ~1 week | Submission interception + failure explanation | TLE on a real problem produces a useful diagnosis |
| **P5** Ship | ~1 week | Onboarding, README, store listing | Published on Chrome Web Store |

**Build P3 before P4.** The eval tells you whether grounding actually helped. If you build features first you're guessing, and you'll have nothing to show for the interesting engineering.

---

## 5. P1 — Skeleton

### 5.1 Monaco extraction

Do **not** scrape `.view-lines`. Monaco virtualizes rendering; off-screen lines are not in the DOM and you will silently send truncated code.

```js
// src/bridge/monaco.js
const RPC = new Map();

export function initMonacoBridge() {
  window.addEventListener("message", (e) => {
    if (e.source !== window || e.data?.__nlogn !== "req") return;
    if (e.data.method !== "getCode") return;

    let payload;
    try {
      const models = window.monaco?.editor?.getModels?.() ?? [];
      // LeetCode creates extra models (diff views, hidden buffers).
      // The user's editor is reliably the largest non-empty one.
      const model = models
        .filter((m) => m.getValueLength() > 0)
        .sort((a, b) => b.getValueLength() - a.getValueLength())[0];

      payload = model
        ? { ok: true, code: model.getValue(), lang: model.getLanguageId() }
        : { ok: false, error: "NO_MODEL" };
    } catch (err) {
      payload = { ok: false, error: String(err) };
    }

    window.postMessage({ __nlogn: "res", id: e.data.id, payload }, window.origin);
  });
}
```

Client side:

```js
// src/content/bridge-client.js
export function call(method, params = {}, timeout = 3000) {
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      window.removeEventListener("message", onMsg);
      reject(new Error(`bridge timeout: ${method}`));
    }, timeout);

    function onMsg(e) {
      if (e.source !== window || e.data?.__nlogn !== "res" || e.data.id !== id) return;
      clearTimeout(t);
      window.removeEventListener("message", onMsg);
      resolve(e.data.payload);
    }
    window.addEventListener("message", onMsg);
    window.postMessage({ __nlogn: "req", id, method, params }, window.origin);
  });
}
```

**Fallback if `window.monaco` is absent** (they could stop exposing it): read from the editor's `textarea.inputarea` value, or fall back to DOM scraping with an explicit "code may be truncated" warning in the UI. Never fall back silently.

### 5.2 SPA navigation

LeetCode is a React SPA. Navigating problems does not reload the page.

```js
// src/bridge/navigation.js
export function initNavigationEvents() {
  const emit = () => window.postMessage({ __nlogn: "nav", url: location.href }, window.origin);

  for (const m of ["pushState", "replaceState"]) {
    const orig = history[m];
    history[m] = function (...args) {
      const r = orig.apply(this, args);
      queueMicrotask(emit);
      return r;
    };
  }
  window.addEventListener("popstate", emit);
}
```

Content script listens, extracts the slug, and if it changed: unmount, clear state, wait for the editor to exist, remount. Add a `MutationObserver` on `document.body` as a safety net in case a route change slips through — debounce it to ~300ms or you'll thrash.

### 5.3 Mount point + Shadow DOM

LeetCode's class names are generated and churn. Use a strategy chain:

```js
const STRATEGIES = [
  () => document.querySelector('[data-e2e-locator="console-submit-button"]')?.parentElement,
  () => [...document.querySelectorAll("button")].find((b) => /submit/i.test(b.textContent))?.closest("div"),
  () => null, // → floating panel fallback
];
```

Always render into a shadow root:

```js
const host = document.createElement("div");
host.id = "nlogn-root";
const shadow = host.attachShadow({ mode: "open" });
shadow.append(styleEl, appEl);
```

This isolates you from LeetCode's Tailwind and vice versa. Mirror their dark/light mode by reading `document.documentElement.classList.contains("dark")`.

### 5.4 BYOK settings

Store in `chrome.storage.local`, **never** `chrome.storage.sync` — sync pushes the key through Google's servers to every signed-in device.

```js
{
  provider: "gemini",           // gemini | deepseek | openai | anthropic
  apiKey: "...",
  model: "gemini-flash-lite",   // provider-specific default
  validatedAt: 1724300000000
}
```

Validate on paste with a real 1-token call. Show a green check plus the resolved model name. Never let someone discover a bad key at the moment they wanted an answer.

**Anthropic gotcha:** direct browser calls require the header `anthropic-dangerous-direct-browser-access: true` or CORS blocks you.

---

## 6. P2 — Grounding (the differentiator)

### 6.1 Why

Every competing extension pipes source text at a cheap model and prints whatever Big-O comes back. That setup confidently mislabels two-pointer `while (l < r)` as O(n²), misses that `sorted()` dominates an O(n) scan, and can't tell memoized recursion from exponential recursion.

Fix: parse first, and hand the model **facts** instead of asking it to infer structure from text.

### 6.2 tree-sitter in MV3

Run it in the **service worker**. Content-script WASM is subject to LeetCode's page CSP, which you don't control.

```js
// src/worker/grounding/parser.js
import Parser from "web-tree-sitter";

let ready, langCache = new Map();

async function init() {
  if (!ready) {
    ready = Parser.init({
      locateFile: (f) => chrome.runtime.getURL(f),
    });
  }
  return ready;
}

export async function getParser(lang) {
  await init();
  if (!langCache.has(lang)) {
    const wasm = chrome.runtime.getURL(`grammars/tree-sitter-${lang}.wasm`);
    langCache.set(lang, await Parser.Language.load(wasm));
  }
  const p = new Parser();
  p.setLanguage(langCache.get(lang));
  return p;
}
```

**Language scope for v1:** Python, Java, C++, JavaScript. That covers the large majority of LeetCode submissions. Lazy-load grammars — the C++ grammar alone is multiple MB, and bundling all four eagerly will bloat your package past what reviewers like to see.

**Fallback:** if WASM init fails, set `grounding: null` and send the prompt ungrounded, with a UI badge showing reduced confidence. Never hard-fail the analysis.

**Service worker lifetime:** MV3 workers terminate after ~30s idle, discarding your parser cache. Re-init is a few hundred ms. Acceptable — do not fight it with keepalive hacks, which get flagged in review.

### 6.3 GroundingFacts shape

This is what the extractor produces and what goes into the prompt:

```json
{
  "language": "python",
  "n_hint": "len(nums)",
  "loops": [
    { "id": "L1", "lines": [4, 11], "kind": "while", "depth": 1,
      "condition": "l < r",
      "induction": { "vars": ["l", "r"], "converging": true },
      "body_contains": ["L2"] },
    { "id": "L2", "lines": [6, 9], "kind": "for", "depth": 2,
      "iterable": "range(i+1, n)", "trip_count_expr": "n - i - 1" }
  ],
  "recursion": [
    { "fn": "dfs", "call_sites": [[14, 14]], "self_recursive": true,
      "branching_factor": 2, "memo_structure": "self.memo (dict)" }
  ],
  "library_calls": [
    { "name": "sorted", "line": 3, "known": "O(n log n)", "note": "Timsort" },
    { "name": "list.insert", "line": 8, "known": "O(n)", "note": "shifts elements" }
  ],
  "allocations": [
    { "line": 2, "expr": "[[0]*m for _ in range(n)]", "kind": "list2d", "size_expr": "n*m" }
  ],
  "early_exits": [{ "line": 9, "kind": "break", "in_loop": "L2" }],
  "amortization_hints": ["monotonic_stack_pattern", "each_element_pushed_popped_once"]
}
```

### 6.4 known-complexity.json

Hand-maintained, per language. This is boring to write and disproportionately valuable — it's where most of your accuracy gain lives.

```json
{
  "python": {
    "sorted":        { "time": "O(n log n)", "space": "O(n)" },
    "list.sort":     { "time": "O(n log n)", "space": "O(1)" },
    "list.insert":   { "time": "O(n)" },
    "list.pop(0)":   { "time": "O(n)", "note": "shifts; deque.popleft is O(1)" },
    "in (list)":     { "time": "O(n)" },
    "in (set)":      { "time": "O(1) avg" },
    "heapq.heappush":{ "time": "O(log n)" },
    "str +=":        { "time": "O(n) per op", "note": "quadratic in a loop" }
  },
  "java": {
    "Arrays.sort(int[])":    { "time": "O(n log n)", "note": "dual-pivot quicksort" },
    "Arrays.sort(Object[])": { "time": "O(n log n)", "note": "TimSort, stable" },
    "String.concat in loop": { "time": "O(n^2)", "note": "use StringBuilder" },
    "ArrayList.contains":    { "time": "O(n)" }
  }
}
```

Start with ~40 entries per language covering the traps people actually hit. Grow it as your eval surfaces failures — every eval miss should either add an entry here or a rule to the prompt.

### 6.5 AnalysisResult schema

```json
{
  "schema_version": 1,
  "time": {
    "big_o": "O(n log n)",
    "confidence": "high",
    "dominant_source": "lib:sorted@L3",
    "blocks": [
      { "ref": "lib:sorted@L3", "bound": "O(n log n)", "reason": "Timsort dominates the linear scan below." },
      { "ref": "L1", "bound": "O(n)", "reason": "Two pointers converge; each index advances at most once." }
    ]
  },
  "space": {
    "big_o": "O(n)",
    "confidence": "high",
    "excludes_output": true,
    "blocks": [{ "ref": "alloc@L2", "bound": "O(n)", "reason": "Hash map holds up to n entries." }]
  },
  "optimality": {
    "is_optimal": false,
    "best_known": "O(n)",
    "gap": "Sorting is unnecessary — a single hash-map pass achieves linear time.",
    "hint_only": true
  },
  "issues": [
    { "severity": "warn", "line": 8, "message": "list.insert(0, x) is O(n); collections.deque gives O(1)." }
  ]
}
```

`confidence` drives UI treatment: `high` shows the Big-O plainly, `medium` adds a caveat, `low` shows "uncertain — here's the reasoning" and refuses to state a single answer. **Being honestly uncertain is your brand.** Every competitor is confidently wrong; being calibrated is the thing worth having.

`hint_only: true` means the optimality section never contains code. Nudge toward the insight, don't hand over the solution.

### 6.6 Prompt design

System prompt rules that matter:

```
You analyze algorithmic complexity. You are given VERIFIED STRUCTURAL FACTS
extracted from a real parse of the code. Treat those facts as ground truth.
Do not contradict them. If the facts are insufficient, lower your confidence
rather than guessing.

Rules:
- n refers to the primary input size stated in the problem constraints.
- Report worst case unless the problem explicitly asks otherwise.
- Amortized bounds must be labeled as amortized and justified by a counting
  argument, not asserted.
- Nesting depth alone does not determine complexity. A nested loop whose
  pointers converge monotonically is linear, not quadratic.
- Space excludes the required output unless the output is larger than the
  working set. State which convention you used.
- Every block bound must cite a fact id from the provided facts.
- Never output code. Never output the solution.
- Output ONLY JSON matching the given schema. No prose, no markdown fences.
```

User message assembly order (most important last — recency helps):
1. Problem title + constraints (from GraphQL, see 7.1)
2. Language
3. Source code, line-numbered
4. GroundingFacts JSON
5. Submission verdict, if present
6. Schema reminder

Set `max_tokens: 900` and `temperature: 0.1`. Output is where the cost is; a capped structured response is both cheaper and more accurate than a rambling one.

### 6.7 Caching

Key: `sha256(problemSlug + normalizedCode + language + analysisType + promptVersion)`.

Normalize by stripping comments and collapsing whitespace so cosmetic edits hit cache. Store in `chrome.storage.local` with LRU eviction at ~200 entries. Bump `promptVersion` whenever you change the prompt or schema — this invalidates the whole cache, which is what you want.

---

## 7. P4 — Submission diagnostics

### 7.1 Problem context via GraphQL

Parse the description DOM only as a last resort. LeetCode's own frontend uses a GraphQL endpoint; reuse it from the content script (cookies ride along, so it works for whatever the user can already see).

Query the standard `questionData` operation by `titleSlug` and take `content`, `difficulty`, `exampleTestcases`, and topic tags. Cache per slug for the session.

**Only ever request problems the user already has access to.** Never attempt locked content.

### 7.2 Verdict interception

```js
// src/bridge/interceptor.js
const origFetch = window.fetch;
window.fetch = async function (...args) {
  const res = await origFetch.apply(this, args);
  try {
    const url = typeof args[0] === "string" ? args[0] : args[0]?.url ?? "";
    if (/\/submissions\/detail\/\d+\/check\//.test(url)) {
      res.clone().json().then((d) => {
        if (d?.state === "SUCCESS") {
          window.postMessage({ __nlogn: "verdict", data: d }, window.origin);
        }
      }).catch(() => {});
    }
  } catch {}
  return res;
};
```

Patch `XMLHttpRequest.prototype.open/send` the same way — LeetCode has used both. Wrap everything in try/catch: **if your interceptor throws, you break the user's ability to submit code.** That is the worst possible bug in this extension. Test it deliberately.

The check response gives you `status_msg`, `total_correct`, `total_testcases`, `last_testcase`, `expected_output`, `code_output`, `status_runtime`, `status_memory`, and `runtime_percentile`.

### 7.3 Diagnosis by verdict type

| Verdict | Available signal | What you tell them |
|---|---|---|
| **TLE** | Testcase index, input size, your computed complexity, problem constraints | "Constraints allow n up to 10⁵. Your O(n²) from the nested scan at L6–L9 gives ~10¹⁰ operations. The nesting at L6 is the cause." |
| **WA** | `last_testcase`, `expected_output`, `code_output` | Compare shapes. Off-by-one? Empty input? Duplicate handling? Integer overflow (flag for Java/C++ when values approach 2³¹)? |
| **MLE** | Allocation facts, constraints | "The 2D table at L2 is n×m = 10¹⁰ cells. This problem wants a rolling 1D array." |
| **RE** | Error text | Map common messages: index out of range, null deref, stack overflow → likely unbounded recursion depth. |
| **AC** | Runtime percentile, your complexity | If percentile is low but complexity is optimal, it's constant factors. If complexity is suboptimal, show the gap. |

**Critical rule for WA:** never show the fixed code. Show the *category* of failure and the failing input. If someone wanted the answer they'd already have it — the value here is learning why you were wrong.

---

## 8. P3 — Eval harness (portfolio centerpiece)

This is the part that makes the project worth talking about. Build it early.

### 8.1 Dataset

100–150 entries, JSON, deliberately weighted toward cases that break naive tools:

```json
{
  "id": "ts-042",
  "slug": "trapping-rain-water",
  "language": "python",
  "code": "...",
  "ground_truth": { "time": "O(n)", "space": "O(1)" },
  "category": "two_pointer_converging",
  "trap": "Nested-looking while loops; naive nesting analysis says O(n^2).",
  "labeled_by": "manual",
  "notes": "Each pointer moves at most n times total."
}
```

Category distribution to aim for:

| Category | Count | Why it's included |
|---|---|---|
| Straightforward single/nested loops | 20 | Baseline — everyone gets these |
| Two-pointer converging | 15 | Naive nesting → wrong O(n²) |
| Monotonic stack / amortized | 15 | Requires counting argument |
| Memoized recursion | 15 | Exponential vs polynomial |
| Sorting hidden in library call | 12 | Dominant term is invisible in loop structure |
| Hidden O(n) ops in loops (`insert(0)`, `str +=`) | 12 | Silent quadratic |
| Union-Find with path compression | 8 | Inverse Ackermann |
| Recursion depth vs space | 10 | Call stack counted or not |
| Graph traversal, O(V+E) | 10 | n is ambiguous |
| Bit manipulation / constant bounds | 8 | O(32n) is O(n) |
| Output-dominated space | 8 | Convention edge case |

Label by hand. Cross-check against LeetCode editorial complexity where you have legitimate access. Where genuine ambiguity exists (is the output counted in space?), record both acceptable answers.

### 8.2 Canonicalization

You cannot string-compare Big-O. `O(N)`, `O(n)`, `Θ(n)`, `O(n^1)`, and `O(2n)` are all the same answer.

```js
// src/shared/bigo.js
export function canonical(s) {
  return s
    .replace(/[ΘΩ]/g, "O")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[nmkv]/g, (m) => m)   // keep variable identity
    .replace(/\*/g, "")
    .replace(/o\((\d+)([a-z])/g, "o($2")  // drop constant coefficients
    .replace(/\^1(?![0-9])/g, "");
}

export function equivalent(a, b) {
  if (canonical(a) === canonical(b)) return true;
  return ALIASES.some((set) => set.has(canonical(a)) && set.has(canonical(b)));
}

const ALIASES = [
  new Set(["o(nlogn)", "o(nlog(n))", "o(n·logn)"]),
  new Set(["o(α(n))", "o(alpha(n))", "o(1)amortized"]),
];
```

Score two ways: **exact** (canonical match) and **family** (same growth class, ignoring variable naming — `O(n)` vs `O(V+E)` where the problem defines them equivalently). Report both.

### 8.3 Ablation configs

Run the full dataset through four configurations:

| Config | Description |
|---|---|
| A | Naive prompt, raw source text, free-form output |
| B | + strict JSON schema, capped output |
| C | + tree-sitter GroundingFacts |
| D | + self-consistency (2 samples; escalate to a stronger model on disagreement) |

Output the table in your README:

```
| Config                  | Time (exact) | Time (family) | Space (exact) | Avg cost/call |
|-------------------------|--------------|---------------|---------------|---------------|
| A  naive prompt         |          — % |           — % |           — % |       $0.000— |
| B  + structured output  |          — % |           — % |           — % |       $0.000— |
| C  + AST grounding      |          — % |           — % |           — % |       $0.000— |
| D  + self-consistency   |          — % |           — % |           — % |       $0.000— |
```

Measure the real numbers. Do not invent them — if grounding turns out to give a smaller lift than you expect, publishing that honestly is *still* a stronger portfolio signal than a fake table, and it tells you where to spend effort next.

Also report **per-category accuracy**. "Grounding took two-pointer from 40% to 95%" is a far more compelling sentence than any aggregate.

### 8.4 Calibration check

Bucket predictions by the model's stated `confidence` and measure actual accuracy in each bucket. If `high` confidence isn't meaningfully more accurate than `low`, your confidence signal is noise and the UI shouldn't display it. This is the kind of check almost nobody does, and it reads extremely well.

### 8.5 Cost

Running the full dataset across 4 configs is roughly 600 calls. On a cheap model that's well under a dollar total, and free within Gemini's daily quota if you pace it. Cache eval responses to disk so re-running the report costs nothing.

---

## 9. P5 — Ship

### Onboarding wizard
BYOK dropoff is your main funnel risk. Treat it as a UX problem:
1. Screen 1: what this does, 15 seconds, one screenshot
2. Screen 2: pick provider — **"Gemini — free, no credit card"** as the default, visually preselected
3. Screen 3: deep-link to the key page, with a screenshot of exactly what to click
4. Screen 4: paste → live validation → green check → "Analyze your first problem"

Add a **demo mode**: one pre-canned analysis viewable with no key at all, so people see the output quality before deciding whether to bother.

### Naming and discoverability

`nlogn` is unique enough to own every search result for the bare word — but nobody hunting for a LeetCode tool will ever type it. The store title has to carry the keywords:

> **nlogn — Complexity Analysis & Submission Diagnostics for LeetCode**

Keep keyword repetition under five instances across the description; more than that invites spam scrutiny. Never imply affiliation with LeetCode — no "Pro," no "Premium," no LeetCode logo or brand colors in the icon.

**Brand rules:**
- Lowercase everywhere, including sentence-initial position
- Monospace wordmark; the logo can space it as `n log n` while the identifier stays `nlogn`
- Icon: the three glyphs, or a single `n` with a log-curve stroke. No magnifying glasses, no brackets.

**Namespaces to claim now** (before writing more code): GitHub repo and org, the `.dev` domain. `nlogn.dev` is a common CS term and may be gone — fall back to `nlogn.tools` or `getnlogn.dev`.

### Store listing checklist
- [ ] Privacy policy URL (required — you transmit code to third-party APIs). State plainly: code goes directly from the user's browser to their chosen provider, never to your servers, because you have none.
- [ ] Single-purpose description
- [ ] Justification for every permission (`storage` = settings/cache; host permissions = the provider endpoints)
- [ ] Screenshots (1280×800) and a short demo GIF
- [ ] Explicitly confirm you do not access LeetCode Premium content
- [ ] Chrome Web Store developer registration fee — check the current amount when you register

### README
Lead with the eval table. Then the architecture diagram. Then install. The table is the headline; the extension is the demo.

---

## 10. Keeping the product door open

One decision preserves the paid path without any work now:

```js
// src/worker/providers/base.js
export class LLMProvider {
  async analyze(request) { throw new Error("not implemented"); }
  //   request:  { system, user, schema, maxTokens }
  //   returns:  { json, usage: { inputTokens, outputTokens } }
}
```

`BYOKProvider` is the only implementation today. If it takes off, `HostedProvider` is one new class plus a backend — not a rewrite. Track `usage` from day one even though nothing consumes it; that's your future credit-metering, and retrofitting it later is annoying.

Same logic for the content-hash cache: it becomes server-side dedupe later, unchanged.

---

## 11. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Interceptor breaks submissions | Low, catastrophic | Wrap in try/catch, always return the original response, test submit flow every build |
| `window.monaco` stops being exposed | Low | Documented fallback chain with explicit truncation warning |
| DOM anchors break on a LeetCode redesign | High | Strategy chain + floating-panel fallback; never hard-depend on one selector |
| tree-sitter WASM blocked | Medium | Ungrounded fallback path with confidence badge |
| Store review rejection | Medium | Tight permissions, clear privacy policy, no Premium-content features |
| Model gives wrong Big-O | Certain sometimes | Calibrated confidence, per-block reasoning shown, eval-driven iteration |
| Free-tier quota shifts under users | Medium | Provider is a dropdown; document DeepSeek as the ~20¢/month paid alternative |

---

## 12. First three tasks

1. Load an unpacked extension with only `bridge.js` + `content.js` that logs Monaco's model content to console on a real LeetCode problem. Confirm you get the *full* code with the editor scrolled to the bottom.
2. Build the strategy-chain mount point and render an empty shadow-DOM panel that survives navigating between three different problems.
3. Write 20 dataset entries by hand before writing any prompt. Knowing exactly what you're trying to get right shapes everything downstream.
