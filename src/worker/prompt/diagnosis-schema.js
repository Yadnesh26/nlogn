export const DIAGNOSIS_SCHEMA = {
  type: "OBJECT",
  properties: {
    verdict: { type: "STRING" },
    summary: { type: "STRING", description: "one-line headline" },
    explanation: { type: "STRING" },
    category: {
      type: "STRING",
      enum: [
        "off_by_one",
        "empty_edge_case",
        "duplicate_handling",
        "integer_overflow",
        "wrong_data_structure",
        "sort_order",
        "complexity_exceeds_constraints",
        "unbounded_recursion",
        "excessive_allocation",
        "constant_factors",
        "compile_error",
        "optimal",
        "other",
      ],
    },
    evidence: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          ref: { type: "STRING", description: "fact id this evidence cites, e.g. 'L1', if applicable" },
          note: { type: "STRING" },
        },
        required: ["note"],
      },
    },
  },
  required: ["verdict", "summary", "explanation"],
};
