export function initNavigationEvents() {
  const emit = () => window.postMessage({ __nlogn: "nav", url: location.href }, window.origin);

  for (const m of ["pushState", "replaceState"]) {
    const orig = history[m];
    history[m] = function (...args) {
      const r = orig.apply(this, args);
      queueMicrotask(emit);
      return r;
    };
  }
  window.addEventListener("popstate", emit);
}
