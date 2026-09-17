// Seeds eval/dataset/ with hand-authored entries. Labeled by Claude using
// standard CS complexity analysis for well-known patterns — not scraped,
// not guessed. Flagged 'labeled_by: claude' rather than 'manual' for
// honesty; spot-check against editorials before trusting this as ground
// truth for anything high-stakes. This is a ~20-entry seed, not the
// 100-150 the plan calls for — a starting point to validate the eval
// harness itself, not a finished dataset.
import { mkdirSync, writeFileSync } from "node:fs";

const entries = [
  {
    id: "straightforward-01",
    slug: "two-sum",
    language: "python",
    category: "straightforward_single_nested_loops",
    trap: "None — baseline single-pass hash map.",
    ground_truth: { time: "O(n)", space: "O(n)" },
    code: `class Solution:
    def twoSum(self, nums, target):
        seen = {}
        for i, n in enumerate(nums):
            if target - n in seen:
                return [seen[target - n], i]
            seen[n] = i
        return []
`,
  },
  {
    id: "straightforward-02",
    slug: "two-sum-brute-force",
    language: "java",
    category: "straightforward_single_nested_loops",
    trap: "Genuinely quadratic — the nesting is not a false positive here.",
    ground_truth: { time: "O(n^2)", space: "O(1)" },
    code: `class Solution {
    int[] twoSum(int[] nums, int target) {
        for (int i = 0; i < nums.length; i++) {
            for (int j = i + 1; j < nums.length; j++) {
                if (nums[i] + nums[j] == target) return new int[]{i, j};
            }
        }
        return new int[]{};
    }
}
`,
  },
  {
    id: "two-pointer-01",
    slug: "trapping-rain-water",
    language: "python",
    category: "two_pointer_converging",
    trap: "Nested-looking while loop; naive nesting analysis says O(n^2).",
    ground_truth: { time: "O(n)", space: "O(1)" },
    code: `class Solution:
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
  },
  {
    id: "two-pointer-02",
    slug: "container-with-most-water",
    language: "cpp",
    category: "two_pointer_converging",
    trap: "while (l < r) looks like it could be quadratic if misread as nested.",
    ground_truth: { time: "O(n)", space: "O(1)" },
    code: `class Solution {
public:
    int maxArea(vector<int>& height) {
        int l = 0, r = height.size() - 1, best = 0;
        while (l < r) {
            int area = min(height[l], height[r]) * (r - l);
            best = max(best, area);
            if (height[l] < height[r]) l++;
            else r--;
        }
        return best;
    }
};
`,
  },
  {
    id: "monotonic-stack-01",
    slug: "daily-temperatures",
    language: "python",
    category: "monotonic_stack_amortized",
    trap: "Inner while loop looks quadratic; each index is pushed and popped at most once.",
    ground_truth: { time: "O(n)", space: "O(n)" },
    code: `class Solution:
    def dailyTemperatures(self, temps):
        answer = [0] * len(temps)
        stack = []
        for i, t in enumerate(temps):
            while stack and temps[stack[-1]] < t:
                j = stack.pop()
                answer[j] = i - j
            stack.append(i)
        return answer
`,
  },
  {
    id: "monotonic-stack-02",
    slug: "largest-rectangle-in-histogram",
    language: "java",
    category: "monotonic_stack_amortized",
    trap: "Two nested-looking loops (main loop + while pops); amortized linear via the push/pop-once argument.",
    ground_truth: { time: "O(n)", space: "O(n)" },
    code: `class Solution {
    int largestRectangleArea(int[] heights) {
        Deque<Integer> stack = new ArrayDeque<>();
        int best = 0;
        for (int i = 0; i <= heights.length; i++) {
            int h = (i == heights.length) ? 0 : heights[i];
            while (!stack.isEmpty() && heights[stack.peek()] >= h) {
                int height = heights[stack.pop()];
                int width = stack.isEmpty() ? i : i - stack.peek() - 1;
                best = Math.max(best, height * width);
            }
            stack.push(i);
        }
        return best;
    }
}
`,
  },
  {
    id: "memo-recursion-01",
    slug: "fibonacci-memoized",
    language: "python",
    category: "memoized_recursion",
    trap: "Naive recursion analysis says O(2^n); memoization makes each subproblem compute once.",
    ground_truth: { time: "O(n)", space: "O(n)" },
    code: `class Solution:
    def fib(self, n, memo={}):
        if n in memo:
            return memo[n]
        if n <= 1:
            return n
        memo[n] = self.fib(n - 1, memo) + self.fib(n - 2, memo)
        return memo[n]
`,
  },
  {
    id: "memo-recursion-02",
    slug: "climbing-stairs-naive",
    language: "javascript",
    category: "memoized_recursion",
    trap: "No memoization here — genuinely exponential, the negative control for the memoized case above.",
    ground_truth: { time: "O(2^n)", space: "O(n)" },
    code: `var climbStairs = function(n) {
    if (n <= 2) return n;
    return climbStairs(n - 1) + climbStairs(n - 2);
};
`,
  },
  {
    id: "sorting-hidden-01",
    slug: "contains-duplicate-sort",
    language: "python",
    category: "sorting_hidden_in_library_call",
    trap: "The single scan afterward is O(n); the dominant term is the sort, invisible in loop structure.",
    ground_truth: { time: "O(n log n)", space: "O(n)" },
    code: `class Solution:
    def containsDuplicate(self, nums):
        nums = sorted(nums)
        for i in range(1, len(nums)):
            if nums[i] == nums[i - 1]:
                return True
        return False
`,
  },
  {
    id: "sorting-hidden-02",
    slug: "merge-intervals",
    language: "javascript",
    category: "sorting_hidden_in_library_call",
    trap: "Merge pass is linear; sort dominates.",
    ground_truth: { time: "O(n log n)", space: "O(n)" },
    code: `var merge = function(intervals) {
    intervals.sort((a, b) => a[0] - b[0]);
    const out = [intervals[0]];
    for (let i = 1; i < intervals.length; i++) {
        const last = out[out.length - 1];
        if (intervals[i][0] <= last[1]) {
            last[1] = Math.max(last[1], intervals[i][1]);
        } else {
            out.push(intervals[i]);
        }
    }
    return out;
};
`,
  },
  {
    id: "hidden-linear-op-01",
    slug: "quadratic-string-build",
    language: "java",
    category: "hidden_On_ops_in_loops",
    trap: "String += in a loop is O(n) per op due to immutability, making the whole loop O(n^2). StringBuilder would be O(n).",
    ground_truth: { time: "O(n^2)", space: "O(n)" },
    code: `class Solution {
    String buildString(String[] parts) {
        String result = "";
        for (String p : parts) {
            result += p;
        }
        return result;
    }
}
`,
  },
  {
    id: "hidden-linear-op-02",
    slug: "pop-front-in-loop",
    language: "python",
    category: "hidden_On_ops_in_loops",
    trap: "list.pop(0) shifts every remaining element — O(n) per call, O(n^2) overall. deque.popleft() would be O(1).",
    ground_truth: { time: "O(n^2)", space: "O(1)" },
    code: `class Solution:
    def drain(self, queue):
        total = 0
        while queue:
            total += queue.pop(0)
        return total
`,
  },
  {
    id: "recursion-depth-01",
    slug: "max-depth-binary-tree",
    language: "python",
    category: "recursion_depth_vs_space",
    trap: "Space is bounded by call stack depth (tree height), not node count — O(n) only in the worst-case skewed tree.",
    ground_truth: { time: "O(n)", space: "O(h)" },
    code: `class Solution:
    def maxDepth(self, root):
        if not root:
            return 0
        return 1 + max(self.maxDepth(root.left), self.maxDepth(root.right))
`,
  },
  {
    id: "recursion-depth-02",
    slug: "fib-naive-call-stack",
    language: "javascript",
    category: "recursion_depth_vs_space",
    trap: "Exponential call count, but the call *stack* depth at any moment is only O(n) — space and time diverge here.",
    ground_truth: { time: "O(2^n)", space: "O(n)" },
    code: `var fib = function(n) {
    if (n <= 1) return n;
    return fib(n - 1) + fib(n - 2);
};
`,
  },
  {
    id: "graph-traversal-01",
    slug: "number-of-islands",
    language: "python",
    category: "graph_traversal_ambiguous_n",
    trap: "n here is ambiguous — it's the grid cell count (rows*cols), not a single linear dimension.",
    ground_truth: { time: "O(m*n)", space: "O(m*n)" },
    code: `class Solution:
    def numIslands(self, grid):
        rows, cols = len(grid), len(grid[0])
        visited = set()

        def bfs(r, c):
            queue = [(r, c)]
            visited.add((r, c))
            while queue:
                cr, cc = queue.pop()
                for dr, dc in ((1,0),(-1,0),(0,1),(0,-1)):
                    nr, nc = cr + dr, cc + dc
                    if (0 <= nr < rows and 0 <= nc < cols
                            and (nr, nc) not in visited and grid[nr][nc] == "1"):
                        visited.add((nr, nc))
                        queue.append((nr, nc))

        count = 0
        for r in range(rows):
            for c in range(cols):
                if grid[r][c] == "1" and (r, c) not in visited:
                    bfs(r, c)
                    count += 1
        return count
`,
  },
  {
    id: "graph-traversal-02",
    slug: "course-schedule-topo-sort",
    language: "java",
    category: "graph_traversal_ambiguous_n",
    trap: "n is V+E (vertices and edges), not just the course count.",
    ground_truth: { time: "O(V+E)", space: "O(V+E)" },
    code: `class Solution {
    boolean canFinish(int numCourses, int[][] prerequisites) {
        List<List<Integer>> graph = new ArrayList<>();
        for (int i = 0; i < numCourses; i++) graph.add(new ArrayList<>());
        int[] indegree = new int[numCourses];
        for (int[] p : prerequisites) {
            graph.get(p[1]).add(p[0]);
            indegree[p[0]]++;
        }
        Deque<Integer> queue = new ArrayDeque<>();
        for (int i = 0; i < numCourses; i++) if (indegree[i] == 0) queue.add(i);
        int seen = 0;
        while (!queue.isEmpty()) {
            int node = queue.poll();
            seen++;
            for (int next : graph.get(node)) {
                if (--indegree[next] == 0) queue.add(next);
            }
        }
        return seen == numCourses;
    }
}
`,
  },
  {
    id: "bit-manip-01",
    slug: "single-number-xor",
    language: "cpp",
    category: "bit_manipulation_constant_bounds",
    trap: "None — clean linear XOR scan, included as a baseline for the bit-manipulation category.",
    ground_truth: { time: "O(n)", space: "O(1)" },
    code: `class Solution {
public:
    int singleNumber(vector<int>& nums) {
        int result = 0;
        for (int n : nums) result ^= n;
        return result;
    }
};
`,
  },
  {
    id: "output-dominated-01",
    slug: "subsets",
    language: "python",
    category: "output_dominated_space",
    trap: "Space is dominated by the 2^n output itself, not the working set — the 'exclude the output' convention doesn't apply here since output IS the point.",
    ground_truth: { time: "O(2^n)", space: "O(2^n)" },
    code: `class Solution:
    def subsets(self, nums):
        result = [[]]
        for n in nums:
            result += [curr + [n] for curr in result]
        return result
`,
  },
  {
    id: "union-find-01",
    slug: "union-find-path-compression",
    language: "python",
    category: "union_find_path_compression",
    trap: "Looks like it could be O(n log n) or worse; path compression + union by rank gives near-linear (inverse-Ackermann) amortized cost per operation.",
    ground_truth: { time: "O(n α(n))", space: "O(n)" },
    code: `class UnionFind:
    def __init__(self, n):
        self.parent = list(range(n))
        self.rank = [0] * n

    def find(self, x):
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])
        return self.parent[x]

    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra == rb:
            return
        if self.rank[ra] < self.rank[rb]:
            ra, rb = rb, ra
        self.parent[rb] = ra
        if self.rank[ra] == self.rank[rb]:
            self.rank[ra] += 1
`,
  },
];

mkdirSync("eval/dataset", { recursive: true });
for (const entry of entries) {
  const full = { ...entry, labeled_by: "claude" };
  writeFileSync(`eval/dataset/${entry.id}.json`, JSON.stringify(full, null, 2) + "\n");
}
console.log(`wrote ${entries.length} entries to eval/dataset/`);

const counts = {};
for (const e of entries) counts[e.category] = (counts[e.category] ?? 0) + 1;
console.log("category distribution:", counts);
