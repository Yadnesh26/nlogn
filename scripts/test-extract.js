import Parser from "web-tree-sitter";
import { readFileSync } from "node:fs";

// Minimal standalone port of extract.js's import surface for a Node test
// harness (the real module imports chrome.runtime, unavailable here).
const extractMod = await import("../src/worker/grounding/extract.js");
const knownComplexity = JSON.parse(readFileSync("src/worker/grounding/known-complexity.json", "utf8"));

await Parser.init();

async function run(lang, code, label) {
  const language = await Parser.Language.load(`node_modules/tree-sitter-wasms/out/tree-sitter-${lang}.wasm`);
  const parser = new Parser();
  parser.setLanguage(language);
  const tree = parser.parse(code);
  const facts = extractMod.extractFacts(tree, lang, knownComplexity);
  console.log(`\n=== ${label} (${lang}) ===`);
  console.log(JSON.stringify(facts, null, 2));
}

await run(
  "python",
  `class Solution:
    def trap(self, height):
        l, r = 0, len(height) - 1
        left_max = right_max = 0
        water = 0
        while l < r:
            if height[l] < height[r]:
                l += 1
                left_max = max(left_max, height[l])
                water += left_max - height[l]
            else:
                r -= 1
                right_max = max(right_max, height[r])
                water += right_max - height[r]
        return water
`,
  "two-pointer converging"
);

await run(
  "python",
  `class Solution:
    def fib(self, n, memo={}):
        if n in memo:
            return memo[n]
        if n <= 1:
            return n
        memo[n] = self.fib(n - 1, memo) + self.fib(n - 2, memo)
        return memo[n]
`,
  "memoized recursion"
);

await run(
  "java",
  `class Solution {
    boolean containsDuplicate(int[] nums) {
        Arrays.sort(nums);
        for (int i = 1; i < nums.length; i++) {
            if (nums[i] == nums[i-1]) return true;
        }
        return false;
    }
}
`,
  "sort + loop"
);

await run(
  "cpp",
  `class Solution {
public:
    int trap(vector<int>& height) {
        int l = 0, r = height.size() - 1;
        while (l < r) {
            l++;
            r--;
        }
        sort(height.begin(), height.end());
        return l;
    }
};
`,
  "two-pointer + sort"
);

await run(
  "javascript",
  `var fib = function(n) {
    if (n <= 1) return n;
    return fib(n - 1) + fib(n - 2);
};
`,
  "naive exponential recursion"
);
