export function call(method, params = {}, timeout = 3000) {
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      window.removeEventListener("message", onMsg);
      reject(new Error(`bridge timeout: ${method}`));
    }, timeout);

    function onMsg(e) {
      if (e.source !== window || e.data?.__nlogn !== "res" || e.data.id !== id) return;
      clearTimeout(t);
      window.removeEventListener("message", onMsg);
      resolve(e.data.payload);
    }
    window.addEventListener("message", onMsg);
    window.postMessage({ __nlogn: "req", id, method, params }, window.origin);
  });
}

export function onNavigate(handler) {
  const listener = (e) => {
    if (e.source !== window || e.data?.__nlogn !== "nav") return;
    handler(e.data.url);
  };
  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}

export function onVerdict(handler) {
  const listener = (e) => {
    if (e.source !== window || e.data?.__nlogn !== "verdict") return;
    handler(e.data.data);
  };
  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}
