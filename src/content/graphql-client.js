// Reuses LeetCode's own GraphQL endpoint from the content script — cookies
// ride along automatically, so this only ever returns what the signed-in
// user could already see in their browser. Never attempt locked/Premium
// content; this endpoint naturally refuses it the same way the site does.
const QUERY = `
query questionData($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    title
    difficulty
    content
    exampleTestcases
    topicTags { name }
  }
}`;

const cache = new Map(); // per-slug, cleared on full page reload — good enough for a session

function stripHtml(html) {
  return String(html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchProblemContext(titleSlug) {
  if (cache.has(titleSlug)) return cache.get(titleSlug);

  try {
    const res = await fetch("https://leetcode.com/graphql/", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: QUERY, variables: { titleSlug } }),
    });
    if (!res.ok) throw new Error(`graphql ${res.status}`);

    const { data, errors } = await res.json();
    if (errors?.length || !data?.question) throw new Error(errors?.[0]?.message ?? "no question data");

    const q = data.question;
    const context = {
      title: q.title,
      difficulty: q.difficulty,
      description: stripHtml(q.content).slice(0, 2000),
      exampleTestcases: q.exampleTestcases,
      tags: (q.topicTags ?? []).map((t) => t.name),
    };
    cache.set(titleSlug, context);
    return context;
  } catch (err) {
    console.warn("[nlogn] problem context fetch failed, continuing without it:", err);
    return null;
  }
}
