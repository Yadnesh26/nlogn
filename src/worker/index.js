import { getSettings } from "../shared/settings.js";
import { GeminiProvider } from "./providers/gemini.js";
import { getParser, normalizeLang } from "./grounding/parser.js";
import { extractFacts } from "./grounding/extract.js";
import { GROUNDED_SYSTEM } from "./prompt/system.js";
import { buildUserMessage } from "./prompt/analysis.js";
import { ANALYSIS_SCHEMA } from "./prompt/schema.js";
import { DIAGNOSIS_SYSTEM } from "./prompt/diagnosis-system.js";
import { buildDiagnosisMessage } from "./prompt/diagnosis.js";
import { DIAGNOSIS_SCHEMA } from "./prompt/diagnosis-schema.js";
import knownComplexity from "./grounding/known-complexity.json";

function buildProvider(settings) {
  switch (settings.provider) {
    case "gemini":
      return new GeminiProvider({ apiKey: settings.apiKey, model: settings.model });
    default:
      throw new Error(`unsupported provider: ${settings.provider}`);
  }
}

// Parsing is best-effort: an unsupported language, a WASM init failure, or a
// syntax error in a half-written solution should never block analysis —
// just fall back to ungrounded (lower-confidence) analysis instead of
// hard-failing. hasSyntaxError is surfaced separately (rather than just
// silently returning null facts) so the prompt can explicitly warn the
// model off giving a confident complexity verdict for code that doesn't
// actually parse cleanly — tree-sitter's error recovery will still hand
// back loops/calls from broken code, which previously produced a
// confident-looking analysis of a program that doesn't compile.
async function tryGetFacts(code, monacoLangId) {
  const lang = normalizeLang(monacoLangId);
  if (!lang) return { facts: null, hasSyntaxError: false };
  try {
    const parser = await getParser(lang);
    if (!parser) return { facts: null, hasSyntaxError: false };
    const tree = parser.parse(code);
    const hasSyntaxError = tree.rootNode.hasError();
    return { facts: extractFacts(tree, lang, knownComplexity), hasSyntaxError };
  } catch (err) {
    console.warn("[nlogn] grounding failed, falling back to ungrounded analysis:", err);
    return { facts: null, hasSyntaxError: false };
  }
}

// The model doesn't always obey "report low confidence" and "flag this as
// an issue" consistently within the same response — it's been seen naming
// the stub/syntax-error issue correctly while still leaving confidence at
// "high". Rather than hope harder wording fixes that, enforce consistency
// programmatically off the model's own admission in its issues list.
const CONFIDENCE_OVERRIDE_RE = /no (real )?implementation|\bstub\b|empty (function )?body|not implemented|does(n'?t| not) (parse|compile)|syntax error|compile error/i;
function enforceLowConfidenceOnFlaggedIssues(result) {
  const flagged = result?.issues?.some((i) => CONFIDENCE_OVERRIDE_RE.test(i.message ?? ""));
  if (!flagged) return;
  if (result.time) result.time.confidence = "low";
  if (result.space) result.space.confidence = "low";
}

async function handleAnalyze({ code, lang }) {
  const settings = await getSettings();
  if (!settings.apiKey) return { ok: false, error: "NO_API_KEY" };

  const { facts, hasSyntaxError } = await tryGetFacts(code, lang);
  const provider = buildProvider(settings);
  const user = buildUserMessage({ language: lang, code, facts, hasSyntaxError });

  try {
    const { text, usage } = await provider.analyze({
      system: GROUNDED_SYSTEM,
      user,
      schema: ANALYSIS_SCHEMA,
    });
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      return { ok: false, error: "Model returned invalid JSON." };
    }
    enforceLowConfidenceOnFlaggedIssues(result);
    return { ok: true, result, usage, grounded: !!facts };
  } catch (err) {
    return { ok: false, error: String(err?.message ?? err) };
  }
}

// Defense in depth for the WA "never show the fix" rule — the model has
// been observed ignoring it and spelling out the exact buggy expression
// despite explicit instructions. Rather than trust wording alone, detect
// likely leaks and replace them with a safe generic message rather than
// send a spoiler to the UI.
const GENERIC_WA_MESSAGE = {
  off_by_one: "The output is off by one from the expected result for the failing input.",
  empty_edge_case: "The output is wrong in a way consistent with an unhandled edge case (empty input, single element, or a boundary condition).",
  duplicate_handling: "The output is wrong in a way consistent with mishandled duplicate values.",
  integer_overflow: "The output is wrong in a way consistent with integer overflow.",
  wrong_data_structure: "The output is wrong in a way consistent with using the wrong data structure for this problem.",
  sort_order: "The output has the right values but in the wrong order.",
  other: "The output doesn't match the expected result for the failing input shown above.",
};

function mentionsCodeIdentifier(text, code) {
  if (!text) return false;
  const identifiers = new Set((code.match(/\b[A-Za-z_]\w{2,}\b/g) ?? []).map((s) => s.toLowerCase()));
  const candidates = text.match(/\b[A-Za-z_]\w*\s*(\[[^\]\n]{0,40}\]|\([^)\n]{0,40}\))/g) ?? [];
  return candidates.some((m) => identifiers.has((m.match(/^[A-Za-z_]\w*/) ?? [""])[0].toLowerCase()));
}

function looksLikeFixPhrasing(text) {
  return !!text && /\binstead of\b|\bshould be\b|\bchange\b[^.]{0,20}\bto\b|\breplace\b[^.]{0,20}\bwith\b/i.test(text);
}

function sanitizeWaDiagnosis(result, code) {
  if (result?.verdict !== "Wrong Answer") return;
  const leaked =
    mentionsCodeIdentifier(result.explanation, code) ||
    mentionsCodeIdentifier(result.summary, code) ||
    looksLikeFixPhrasing(result.explanation) ||
    looksLikeFixPhrasing(result.summary);
  if (!leaked) return;

  const fallback = GENERIC_WA_MESSAGE[result.category] ?? GENERIC_WA_MESSAGE.other;
  result.summary = fallback;
  result.explanation = fallback;
  result.evidence = [];
}

async function handleDiagnose({ code, lang, verdict, problemContext }) {
  const settings = await getSettings();
  if (!settings.apiKey) return { ok: false, error: "NO_API_KEY" };

  const { facts, hasSyntaxError } = await tryGetFacts(code, lang);
  const provider = buildProvider(settings);
  const user = buildDiagnosisMessage({ language: lang, code, facts, hasSyntaxError, verdict, problemContext });

  try {
    const { text, usage } = await provider.analyze({
      system: DIAGNOSIS_SYSTEM,
      user,
      schema: DIAGNOSIS_SCHEMA,
    });
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      return { ok: false, error: "Model returned invalid JSON." };
    }
    sanitizeWaDiagnosis(result, code);
    return { ok: true, result, usage, grounded: !!facts };
  } catch (err) {
    return { ok: false, error: String(err?.message ?? err) };
  }
}

async function handleValidateKey({ provider, apiKey, model }) {
  try {
    const p = buildProvider({ provider, apiKey, model });
    const { text } = await p.analyze({
      system: "Reply with exactly one word.",
      user: "Reply with: ok",
      maxTokens: 5,
    });
    return { ok: true, resolvedModel: model, sample: text.trim() };
  } catch (err) {
    return { ok: false, error: String(err?.message ?? err) };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.__nlogn !== "rpc") return;

  (async () => {
    switch (msg.method) {
      case "analyze":
        sendResponse(await handleAnalyze(msg.params));
        break;
      case "diagnose":
        sendResponse(await handleDiagnose(msg.params));
        break;
      case "validateKey":
        sendResponse(await handleValidateKey(msg.params));
        break;
      case "openOptions":
        // Opening the options page from a content script (running in the
        // leetcode.com page) can silently no-op — this API is meant to be
        // called from the background/service-worker context, which
        // reliably knows which window to attach the new tab to.
        chrome.runtime.openOptionsPage();
        sendResponse({ ok: true });
        break;
      default:
        sendResponse({ ok: false, error: `unknown method: ${msg.method}` });
    }
  })();

  return true; // keep the message channel open for the async response
});

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") });
  }
});
