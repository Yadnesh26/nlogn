// You can't string-compare Big-O: "O(N)", "O(n)", "Θ(n)", "O(n^1)", and
// "O(2n)" all mean the same thing. `canonical` normalizes surface-level
// differences (case, whitespace, notation, constant coefficients) into one
// form. `family` goes further, treating any variable name as interchangeable
// (O(n) vs O(V+E)) — useful when the "correct" answer's variable naming is
// convention-dependent.

export function canonical(bigO) {
  if (!bigO) return "";

  let s = String(bigO)
    .replace(/[ΘΩ]/g, "O")
    .replace(/[αΑ]/g, "alpha")
    .toLowerCase()
    .replace(/amortized|average\b|avg\.?|worst[\s-]?case/g, "")
    .replace(/\s+/g, "")
    .replace(/[·×]/g, ""); // stylistic join for compound single terms (n·logn) — a literal
    // "*" is left alone: it usually denotes two distinct multiplied factors
    // (e.g. "2^n * n"), and stripping it previously collapsed that into the
    // same bucket as "2^n" alone, hiding a real complexity difference.

  const wrapped = s.match(/^o\((.*)\)$/);
  let inner = wrapped ? wrapped[1] : s;

  inner = inner
    .replace(/log\((\w+)\)/g, "log$1") // log(n) -> logn
    .replace(/\^1(?![0-9])/g, "") // n^1 -> n
    .replace(/^(\d+\.?\d*)(?=[a-z(])/, "") // drop one leading numeric coefficient: 2n -> n
    .replace(/\^0(?![0-9])/g, "0"); // n^0 -> 0, collapsed to "1" below

  // Multiplication is commutative — "2^n*n" and "n*2^n" are the same value.
  // Only reorder when it's a single multiplicative term (no "+"), so an
  // actual sum of two products isn't blindly resorted into nonsense.
  if (inner.includes("*") && !inner.includes("+")) {
    inner = inner.split("*").sort().join("*");
  }

  if (inner === "" || inner === "0") inner = "1";

  return `o(${inner})`;
}

// Same growth class regardless of what the variable is called: replaces
// identifier letters with a generic placeholder while preserving "log" as
// a structural keyword (so "vlogv" and "nlogn" both become "xlogx", but
// "n^2" and "nlogn" stay distinct).
export function family(bigO) {
  const c = canonical(bigO);
  const inner = c.slice(2, -1);
  const placeholder = "@@LOG@@";
  const protectedLog = inner.split("log").join(placeholder);
  const generic = protectedLog.replace(/[a-z]+/g, "x").split(placeholder).join("log");
  return `o(${generic})`;
}

const ALIAS_SETS = [
  new Set(["o(a(n))", "o(alpha(n))", "o(invackermann(n))"]), // inverse Ackermann spellings
];

function aliased(a, b) {
  return ALIAS_SETS.some((set) => set.has(a) && set.has(b));
}

export function equivalent(a, b) {
  const ca = canonical(a);
  const cb = canonical(b);
  return ca === cb || aliased(ca, cb);
}

export function familyEquivalent(a, b) {
  return equivalent(a, b) || family(a) === family(b);
}
