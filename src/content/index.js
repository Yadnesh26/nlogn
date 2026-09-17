import { createPanel } from "./panel/panel.js";
import { findToolbarInsertionPoint, extractSlug } from "./mount-points.js";
import { onNavigate } from "./bridge-client.js";

let current = null; // { slug, panel }

function mount(slug) {
  // createPanel handles its own DOM placement: a tiny trigger inserted
  // inline next to Submit (or floating as a fallback), and a popup card
  // that's always portaled to document.body so it's unaffected by whatever
  // container the trigger ends up in.
  const panel = createPanel(findToolbarInsertionPoint() ?? {});
  current = { slug, panel };
}

function unmount() {
  current?.panel.destroy();
  current = null;
}

function sync() {
  const slug = extractSlug();
  if (!slug) {
    unmount();
    return;
  }
  if (current?.slug === slug && document.getElementById("nlogn-trigger")) return;
  unmount();
  mount(slug);
}

sync();
onNavigate(() => sync());

// Safety net: some route changes don't go through pushState/replaceState/popstate.
let debounceTimer;
new MutationObserver(() => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(sync, 300);
}).observe(document.body, { childList: true, subtree: true });
