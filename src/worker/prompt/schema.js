// Gemini structured-output schema (their OpenAPI-subset dialect, not raw
// JSON Schema — uppercase type names, no $ref/oneOf). Forcing the model
// into this shape is cheaper and more reliable than parsing free-form
// prose, and lets the UI render confidence/reasoning instead of just text.
const BLOCK = {
  type: "OBJECT",
  properties: {
    ref: { type: "STRING", description: "fact id this bound is justified by, e.g. 'L1' or 'lib:sort@L3'" },
    bound: { type: "STRING" },
    reason: { type: "STRING" },
  },
  required: ["ref", "bound", "reason"],
};

const COMPLEXITY_SIDE = {
  type: "OBJECT",
  properties: {
    big_o: { type: "STRING" },
    confidence: { type: "STRING", enum: ["high", "medium", "low"] },
    blocks: { type: "ARRAY", items: BLOCK },
  },
  required: ["big_o", "confidence", "blocks"],
};

export const ANALYSIS_SCHEMA = {
  type: "OBJECT",
  properties: {
    time: COMPLEXITY_SIDE,
    space: {
      ...COMPLEXITY_SIDE,
      properties: { ...COMPLEXITY_SIDE.properties, excludes_output: { type: "BOOLEAN" } },
      required: [...COMPLEXITY_SIDE.required, "excludes_output"],
    },
    optimality: {
      type: "OBJECT",
      properties: {
        is_optimal: { type: "BOOLEAN" },
        best_known: { type: "STRING" },
        gap: { type: "STRING" },
      },
      required: ["is_optimal", "best_known", "gap"],
    },
    issues: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          severity: { type: "STRING", enum: ["warn", "info"] },
          line: { type: "INTEGER" },
          message: { type: "STRING" },
        },
        required: ["severity", "message"],
      },
    },
  },
  required: ["time", "space", "optimality", "issues"],
};
