// User-message assembly. Order matters less for structured output than
// free-form prompting, but facts are still placed right before the code so
// they're the freshest context the model sees before it has to commit to
// per-line reasoning.
export function buildUserMessage({ language, code, facts, hasSyntaxError = false }) {
  const lines = code.split("\n").map((l, i) => `${i + 1}: ${l}`).join("\n");

  const parts = [`Language: ${language}`, "", "Code (line-numbered):", lines];

  if (hasSyntaxError) {
    parts.push(
      "",
      "NOTE: this code does not parse cleanly — it likely has a syntax error and would fail to compile as-is. The structural facts below (if any) come from tree-sitter's error-recovery parse and may not reflect a coherent program. Flag this plainly as an issue and report low confidence rather than asserting a confident complexity."
    );
  }

  if (facts) {
    parts.push("", "VERIFIED STRUCTURAL FACTS (ground truth — see system rules):", JSON.stringify(facts, null, 2));
  } else {
    parts.push("", "No structural facts available for this language yet — analyze from the code directly and report lower confidence.");
  }

  return parts.join("\n");
}
