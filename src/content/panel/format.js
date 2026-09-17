import { ICON_CLOCK, ICON_LAYERS, ICON_TARGET, ICON_ALERT, ICON_CHECK, ICON_VERIFIED } from "./icons.js";

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function confidenceBadge(confidence) {
  const label = escapeHtml(confidence ?? "low");
  return `<span class="nlogn-badge nlogn-badge-${label}">${label}</span>`;
}

function renderBlocks(blocks) {
  if (!blocks?.length) return "";
  const items = blocks
    .map(
      (b) =>
        `<div class="nlogn-block"><code>${escapeHtml(b.bound)}</code><span>${escapeHtml(b.reason)}</span></div>`
    )
    .join("");
  return `<div class="nlogn-blocks">${items}</div>`;
}

function renderSide(label, icon, side) {
  if (!side) return "";
  return `
    <div class="nlogn-section">
      <div class="nlogn-side-head">
        <span class="nlogn-side-label">${icon}${label}</span>
        <span class="nlogn-bigo">${escapeHtml(side.big_o)}</span>
        ${confidenceBadge(side.confidence)}
      </div>
      ${renderBlocks(side.blocks)}
    </div>`;
}

function renderOptimality(opt) {
  if (!opt) return "";
  const body = opt.is_optimal
    ? `<div class="nlogn-optimal">${ICON_CHECK}Optimal approach</div>`
    : `
      <div class="nlogn-suboptimal">
        <div class="nlogn-suboptimal-head">Best known <code>${escapeHtml(opt.best_known)}</code></div>
        <p>${escapeHtml(opt.gap)}</p>
      </div>`;
  return `
    <div class="nlogn-section">
      <span class="nlogn-section-label">${ICON_TARGET}Optimality</span>
      ${body}
    </div>`;
}

function renderIssues(issues) {
  if (!issues?.length) return "";
  const items = issues
    .map(
      (i) =>
        `<div class="nlogn-issue nlogn-issue-${escapeHtml(i.severity)}">${
          i.line ? `<code>L${i.line}</code>` : ""
        }<span>${escapeHtml(i.message)}</span></div>`
    )
    .join("");
  return `
    <div class="nlogn-section">
      <span class="nlogn-section-label">${ICON_ALERT}Issues</span>
      <div class="nlogn-issues">${items}</div>
    </div>`;
}

function groundedIndicator(grounded) {
  return grounded
    ? `<span class="nlogn-grounded" title="Backed by a real parse of your code">${ICON_VERIFIED}grounded</span>`
    : `<span class="nlogn-grounded ungrounded" title="No structural parse available for this language yet — lower-confidence, text-only analysis">${ICON_VERIFIED}ungrounded</span>`;
}

export function renderResult(result, grounded) {
  return `
    <div class="nlogn-status-row">${groundedIndicator(grounded)}</div>
    ${renderSide("Time", ICON_CLOCK, result.time)}
    ${renderSide("Space", ICON_LAYERS, result.space)}
    ${renderOptimality(result.optimality)}
    ${renderIssues(result.issues)}
  `;
}

const VERDICT_TONE = {
  "Time Limit Exceeded": "warn",
  "Memory Limit Exceeded": "warn",
  "Runtime Error": "warn",
  "Compile Error": "warn",
  "Wrong Answer": "bad",
  Accepted: "good",
};

// The failing-input/expected/actual triple comes straight from LeetCode's
// own response, not from the model — safe to render verbatim regardless of
// what the model's prose says, and useful on its own for WA even when the
// explanation gets sanitized below.
function renderTestcaseCompare(verdict) {
  if (verdict?.last_testcase == null) return "";
  return `
    <div class="nlogn-section">
      <span class="nlogn-section-label">Failing case</span>
      <div class="nlogn-testcase">
        <div><span>Input</span><code>${escapeHtml(verdict.last_testcase)}</code></div>
        <div><span>Expected</span><code>${escapeHtml(verdict.expected_output)}</code></div>
        <div><span>Actual</span><code>${escapeHtml(verdict.code_output)}</code></div>
      </div>
    </div>`;
}

export function renderDiagnosis(result, grounded, verdict) {
  const tone = VERDICT_TONE[result.verdict] ?? "warn";
  const evidence = result.evidence?.length
    ? `<div class="nlogn-blocks">${result.evidence
        .map(
          (e) =>
            `<div class="nlogn-block">${e.ref ? `<code>${escapeHtml(e.ref)}</code>` : ""}<span>${escapeHtml(e.note)}</span></div>`
        )
        .join("")}</div>`
    : "";

  return `
    <div class="nlogn-status-row">${groundedIndicator(grounded)}</div>
    <div class="nlogn-verdict nlogn-verdict-${tone}">${escapeHtml(result.verdict)}</div>
    <div class="nlogn-diag-summary">${escapeHtml(result.summary)}</div>
    <div class="nlogn-diag-explanation">${escapeHtml(result.explanation)}</div>
    ${evidence}
    ${result.verdict === "Wrong Answer" ? renderTestcaseCompare(verdict) : ""}
  `;
}
