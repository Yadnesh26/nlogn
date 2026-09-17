# Chrome Web Store listing — draft

Not shipped in the extension bundle; reference material for the Developer Dashboard submission (which only you can do — requires your own Google account and the one-time developer registration fee).

## Title (max ~75 chars for the store, plan targets under that)

```
nlogn — Complexity Analysis & Submission Diagnostics for LeetCode
```

## Summary (short description, ~132 char limit)

```
Grounded Big-O analysis and failed-submission diagnostics for LeetCode. Bring your own API key — your code never touches our servers.
```

## Detailed description

```
nlogn parses your LeetCode solution with a real AST before asking an LLM
anything — so the complexity you get back is grounded in actual code
structure (loop nesting, two-pointer convergence, recursion vs.
memoization, library-call cost), not a guess from raw text.

WHAT IT DOES
• Time and space complexity, with per-block reasoning and calibrated
  confidence — not every answer is asserted as certain.
• Automatic diagnosis when a submission fails: Time Limit Exceeded, Wrong
  Answer, Memory Limit Exceeded, Runtime Error, or Compile Error, each
  explained in terms of what actually happened.
• Optimality check — know when a passing solution isn't the best known
  approach, without being handed the better solution.

WHAT IT WON'T DO
• Never shows you the fix for a Wrong Answer — only the bug category and
  the failing input. If you want the answer, this isn't that.
• Never touches LeetCode Premium content — no locked problems, editorials,
  or company tags.
• No auto-solve, no stealth mode. This explains your own code back to you;
  it doesn't write code for you.

BRING YOUR OWN KEY
There is no nlogn backend. Your code and API key go directly from your
browser to the AI provider you choose (Gemini's free tier works with no
credit card). We have no servers, so we can't see your code even if we
wanted to.

Supported for full AST-grounded analysis: Python, Java, C++, JavaScript.
Other languages still get analyzed, just flagged as lower-confidence
without structural grounding.
```

## Single-purpose description (Chrome Web Store requires this)

```
Analyzes the complexity of LeetCode solutions and explains failed
submissions, using the LeetCode page's own code editor and submission
results as input.
```

## Permission justifications

| Permission | Why |
|---|---|
| `storage` | Stores the user's API key, provider/model choice, and settings locally (`chrome.storage.local`, never `.sync` — so the key never leaves the device via Google's sync). |
| Host: `leetcode.com` | Where the extension's content script and UI run; also used to query LeetCode's own GraphQL endpoint for problem constraints (same-origin, uses the user's existing session). |
| Host: `generativelanguage.googleapis.com`, `api.deepseek.com`, `api.openai.com`, `api.anthropic.com` | Direct BYOK calls to whichever provider the user configures. Only the one they've selected is ever actually called. |

Keyword repetition check: "LeetCode" appears in title + summary + description — stays under the plan's 5-instance ceiling; count before final submission if the description changes.

## Compliance checklist (yours to complete)

- [ ] Privacy policy hosted at a public URL (see `store/privacy-policy.html` — host via GitHub Pages or similar, then paste the URL into the dashboard)
- [ ] Screenshots (1280×800) — needs a real browser session, can't generate these here
- [ ] Short demo GIF/video — same
- [ ] Icon set — done, `icons/16.png` `32.png` `48.png` `128.png`, generated from your logo
- [ ] Chrome Web Store developer registration fee — one-time, paid through your own Google account
- [ ] Confirm the listing explicitly states no LeetCode Premium access (covered in description above)
- [ ] Never imply LeetCode affiliation — no "Pro"/"Premium" naming, no LeetCode logo or brand colors in our icon (already true: icon is the standalone logo mark, no LeetCode branding)
