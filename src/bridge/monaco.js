export function initMonacoBridge() {
  window.addEventListener("message", (e) => {
    if (e.source !== window || e.data?.__nlogn !== "req") return;
    if (e.data.method !== "getCode") return;

    let payload;
    try {
      const models = window.monaco?.editor?.getModels?.() ?? [];
      // LeetCode creates extra models (diff views, hidden buffers).
      // The user's editor is reliably the largest non-empty one.
      const model = models
        .filter((m) => m.getValueLength() > 0)
        .sort((a, b) => b.getValueLength() - a.getValueLength())[0];

      payload = model
        ? { ok: true, code: model.getValue(), lang: model.getLanguageId() }
        : { ok: false, error: "NO_MODEL" };
    } catch (err) {
      payload = { ok: false, error: String(err) };
    }

    window.postMessage({ __nlogn: "res", id: e.data.id, payload }, window.origin);
  });
}
