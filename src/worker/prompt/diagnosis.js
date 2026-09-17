function verdictSection(verdict) {
  const lines = [`Verdict: ${verdict.status_msg}`];
  if (verdict.total_correct != null && verdict.total_testcases != null) {
    lines.push(`Passed ${verdict.total_correct}/${verdict.total_testcases} testcases.`);
  }
  if (verdict.last_testcase) lines.push(`Failing input: ${verdict.last_testcase}`);
  if (verdict.expected_output != null) lines.push(`Expected output: ${verdict.expected_output}`);
  if (verdict.code_output != null) lines.push(`Actual output: ${verdict.code_output}`);
  if (verdict.status_runtime) lines.push(`Runtime: ${verdict.status_runtime}`);
  if (verdict.status_memory) lines.push(`Memory: ${verdict.status_memory}`);
  if (verdict.runtime_percentile != null) lines.push(`Runtime percentile: ${verdict.runtime_percentile}`);
  if (verdict.full_runtime_error) lines.push(`Error: ${verdict.full_runtime_error}`);
  if (verdict.full_compile_error) lines.push(`Compile error: ${verdict.full_compile_error}`);
  return lines.join("\n");
}

export function buildDiagnosisMessage({ language, code, facts, hasSyntaxError = false, verdict, problemContext }) {
  const lines = code.split("\n").map((l, i) => `${i + 1}: ${l}`).join("\n");
  const parts = [];

  if (hasSyntaxError) {
    parts.push(
      "NOTE: this code does not parse cleanly (likely a syntax/compile error) — any structural facts below come from error-recovery parsing and may not reflect a coherent program.",
      ""
    );
  }

  if (problemContext) {
    parts.push(
      `Problem: ${problemContext.title} (${problemContext.difficulty})`,
      problemContext.tags?.length ? `Tags: ${problemContext.tags.join(", ")}` : "",
      `Description (constraints live here):\n${problemContext.description}`,
      ""
    );
  } else {
    parts.push("No problem context available (constraints unknown) — lower confidence on TLE/MLE reasoning that depends on n's bound.", "");
  }

  parts.push(`Language: ${language}`, "", "Code (line-numbered):", lines, "");

  if (facts) {
    parts.push("VERIFIED STRUCTURAL FACTS:", JSON.stringify(facts, null, 2), "");
  } else {
    parts.push("No structural facts available for this language.", "");
  }

  parts.push(verdictSection(verdict));

  return parts.filter(Boolean).join("\n");
}
