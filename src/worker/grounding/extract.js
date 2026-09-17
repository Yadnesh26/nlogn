// Turns a tree-sitter parse into GroundingFacts: structured signals about
// loops, recursion, and library calls that the prompt treats as ground
// truth instead of asking the model to infer structure from raw text.
//
// This is intentionally syntactic, not semantic — there's no type
// inference, so a call like `x.pop()` is matched by method name alone and
// can't tell a list from a dict. Ambiguous cases are flagged with a note
// rather than guessed at silently; amortization-hint detection (e.g.
// recognizing a monotonic-stack pattern) and n_hint inference are not yet
// implemented and are left as empty/absent rather than faked.

const LANG = {
  python: {
    loopTypes: new Set(["for_statement", "while_statement"]),
    whileType: "while_statement",
    functionTypes: new Set(["function_definition"]),
    callTypes: new Set(["call"]),
    memberWrapperTypes: new Set(["attribute"]),
    updateTypes: new Set(["augmented_assignment"]),
    breakTypes: new Set(["break_statement"]),
    allocationHint: (node) => {
      if (node.type === "list_comprehension" || node.type === "dictionary_comprehension") return true;
      if (node.type === "binary_operator" && node.text.includes("*")) {
        const kids = node.namedChildren;
        return kids.some((k) => k.type === "list");
      }
      return false;
    },
  },
  java: {
    loopTypes: new Set(["for_statement", "while_statement", "enhanced_for_statement"]),
    whileType: "while_statement",
    functionTypes: new Set(["method_declaration", "constructor_declaration"]),
    callTypes: new Set(["method_invocation"]),
    memberWrapperTypes: new Set(), // method_invocation is flat, handled specially
    updateTypes: new Set(["update_expression"]),
    breakTypes: new Set(["break_statement"]),
    allocationHint: (node) =>
      node.type === "array_creation_expression" || node.type === "object_creation_expression",
  },
  cpp: {
    loopTypes: new Set(["for_statement", "while_statement", "for_range_loop"]),
    whileType: "while_statement",
    functionTypes: new Set(["function_definition"]),
    callTypes: new Set(["call_expression"]),
    memberWrapperTypes: new Set(["field_expression"]),
    updateTypes: new Set(["update_expression"]),
    breakTypes: new Set(["break_statement"]),
    allocationHint: (node) => node.type === "new_expression",
  },
  javascript: {
    loopTypes: new Set(["for_statement", "while_statement", "for_in_statement", "for_of_statement"]),
    whileType: "while_statement",
    functionTypes: new Set(["function_declaration", "function_expression", "arrow_function", "method_definition"]),
    callTypes: new Set(["call_expression"]),
    memberWrapperTypes: new Set(["member_expression"]),
    updateTypes: new Set(["update_expression"]),
    breakTypes: new Set(["break_statement"]),
    allocationHint: (node) => node.type === "array" || node.type === "new_expression",
  },
};

function lineRange(node) {
  return [node.startPosition.row + 1, node.endPosition.row + 1];
}

function calleeName(node, lang, config) {
  if (lang === "java") {
    // method_invocation is flat: [identifier?, ".", identifier(name), argument_list]
    const kids = node.namedChildren;
    const argIdx = kids.findIndex((k) => k.type === "argument_list");
    return argIdx > 0 ? kids[argIdx - 1].text : null;
  }

  const first = node.firstNamedChild;
  if (!first) return null;
  if (config.memberWrapperTypes.has(first.type)) {
    const propKids = first.namedChildren;
    return propKids.length ? propKids[propKids.length - 1].text : null;
  }
  if (first.type === "identifier") return first.text;
  return null;
}

function findFunctionName(node, lang) {
  if (lang === "cpp") {
    const declarator = node.namedChildren.find((n) => n.type === "function_declarator");
    const id = declarator?.namedChildren.find((n) => n.type === "identifier");
    if (id) return id.text;
  }

  const direct = node.namedChildren.find((n) => n.type === "identifier");
  if (direct) return direct.text;

  // Anonymous function/arrow-function assigned to a variable: the name
  // lives on the parent binding (`const fib = (n) => ...`), not the
  // function node itself.
  const parent = node.parent;
  if (parent && (parent.type === "variable_declarator" || parent.type === "assignment")) {
    const id = parent.namedChildren.find((n) => n.type === "identifier");
    if (id) return id.text;
  }
  return null;
}

function argCount(node) {
  const args = node.namedChildren.find((k) => /argument|arguments/.test(k.type));
  return args ? args.namedChildCount : 0;
}

function collectIdentifiers(node, out) {
  if (node.type === "identifier") out.add(node.text);
  for (const child of node.namedChildren) collectIdentifiers(child, out);
}

// Two-pointer heuristic: a while-loop whose condition compares two
// identifiers (e.g. `l < r`), where both identifiers are also modified
// (incremented/decremented/reassigned) somewhere in the body. This is what
// tells a converging `while (l < r)` apart from a genuinely quadratic loop
// that merely *looks* similar in raw text.
function detectConvergence(loopNode, config) {
  const condCandidates = loopNode.namedChildren.filter(
    (n) => n.type === "comparison_operator" || n.type === "binary_expression" || n.type === "parenthesized_expression" || n.type === "condition" || n.type === "condition_clause"
  );
  let comparison = condCandidates.find((n) => n.type === "comparison_operator" || n.type === "binary_expression");
  if (!comparison) {
    for (const c of condCandidates) {
      comparison = c.namedChildren.find((n) => n.type === "comparison_operator" || n.type === "binary_expression");
      if (comparison) break;
    }
  }
  if (!comparison || comparison.namedChildCount < 2) return { vars: [], converging: false };

  const left = comparison.namedChild(0);
  const right = comparison.namedChild(comparison.namedChildCount - 1);
  if (left?.type !== "identifier" || right?.type !== "identifier") return { vars: [], converging: false };

  const vars = [left.text, right.text];
  const body = loopNode.namedChildren[loopNode.namedChildCount - 1];
  const modified = new Set();
  (function scan(n) {
    if (config.updateTypes.has(n.type) && n.namedChildCount > 0) modified.add(n.namedChild(0).text);
    if (n.type === "assignment" && n.namedChildCount > 0) modified.add(n.namedChild(0).text);
    for (const c of n.namedChildren) scan(c);
  })(body ?? loopNode);

  const converging = vars.every((v) => modified.has(v));
  return { vars, converging };
}

export function extractFacts(tree, lang, knownComplexity) {
  const config = LANG[lang];
  if (!config) return null;

  const loops = [];
  const recursion = [];
  const libraryCalls = [];
  const earlyExits = [];
  const allocations = [];

  let loopCounter = 0;
  const loopStack = [];
  const funcStack = [];
  const known = knownComplexity[lang] ?? {};

  function walk(node) {
    if (config.loopTypes.has(node.type)) {
      loopCounter += 1;
      const id = `L${loopCounter}`;
      const kind = node.type === config.whileType ? "while" : "for";
      const fact = { id, lines: lineRange(node), kind, depth: loopStack.length + 1, body_contains: [] };

      if (kind === "while") {
        const { vars, converging } = detectConvergence(node, config);
        if (vars.length) fact.induction = { vars, converging };
      }

      if (loopStack.length) loops[loopStack[loopStack.length - 1]].body_contains.push(id);
      loops.push(fact);
      loopStack.push(loops.length - 1);
      for (const child of node.namedChildren) walk(child);
      loopStack.pop();
      return;
    }

    if (config.functionTypes.has(node.type)) {
      const name = findFunctionName(node, lang);
      funcStack.push({ name, node, calls: [] });
      for (const child of node.namedChildren) walk(child);
      const fn = funcStack.pop();
      if (fn.name && fn.calls.length) {
        const memoHint = /\b(memo|cache)\b/i.test(node.text) || /lru_cache/.test(node.text);
        recursion.push({
          fn: fn.name,
          call_sites: fn.calls,
          self_recursive: true,
          branching_factor: fn.calls.length,
          memo_structure: memoHint ? "detected (memo/cache reference in body)" : null,
        });
      }
      return;
    }

    if (config.callTypes.has(node.type)) {
      const name = calleeName(node, lang, config);
      if (name) {
        const enclosing = funcStack[funcStack.length - 1];
        if (enclosing && name === enclosing.name) {
          enclosing.calls.push(lineRange(node));
        }

        let entry = known[name];
        let note;
        if (name === "pop") {
          const n = argCount(node);
          entry = n === 0 ? known["pop()"] : known["pop(i)"];
        }
        if (entry) {
          libraryCalls.push({ name, line: node.startPosition.row + 1, known: entry.time, note: entry.note });
        }
      }
    }

    if (config.breakTypes.has(node.type) && loopStack.length) {
      earlyExits.push({ line: node.startPosition.row + 1, kind: "break", in_loop: loops[loopStack[loopStack.length - 1]].id });
    }
    if (node.type === "return_statement" && loopStack.length) {
      earlyExits.push({ line: node.startPosition.row + 1, kind: "return", in_loop: loops[loopStack[loopStack.length - 1]].id });
    }

    if (config.allocationHint(node)) {
      allocations.push({ line: node.startPosition.row + 1, expr: node.text.slice(0, 80) });
    }

    for (const child of node.namedChildren) walk(child);
  }

  walk(tree.rootNode);

  return {
    language: lang,
    loops: loops.map(({ id, lines, kind, depth, induction, body_contains }) => ({
      id,
      lines,
      kind,
      depth,
      ...(induction ? { induction } : {}),
      body_contains,
    })),
    recursion,
    library_calls: libraryCalls,
    allocations,
    early_exits: earlyExits,
  };
}
