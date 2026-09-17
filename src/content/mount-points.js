// Submit usually sits in a small wrapper alongside the run/play buttons;
// that narrow wrapper is often exactly full (no slack), which is what broke
// when we inserted *inside* it. The note/AI icons live in a sibling group
// one level up. We insert our trigger as a new sibling *between* those two
// groups, in the wider outer row, which has more room to absorb one extra
// small item.
export function findToolbarInsertionPoint() {
  const submitBtn =
    document.querySelector('[data-e2e-locator="console-submit-button"]') ??
    [...document.querySelectorAll("button")].find((b) => /submit/i.test(b.textContent));
  if (!submitBtn) return null;

  const submitGroup = submitBtn.parentElement;
  if (!submitGroup?.parentElement) return null;

  return { insertAfter: submitGroup, sampleEl: submitBtn };
}

export function extractSlug(url = location.href) {
  const m = url.match(/\/problems\/([^/]+)/);
  return m ? m[1] : null;
}
