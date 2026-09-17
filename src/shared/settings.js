// Settings live in chrome.storage.local, never .sync — sync would push the
// API key through Google's servers to every signed-in device.
const KEY = "nlogn_settings";

const DEFAULTS = {
  provider: "gemini",
  apiKey: "",
  model: "gemini-flash-lite-latest",
  validatedAt: null,
};

export async function getSettings() {
  const stored = await chrome.storage.local.get(KEY);
  return { ...DEFAULTS, ...stored[KEY] };
}

export async function setSettings(patch) {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await chrome.storage.local.set({ [KEY]: next });
  return next;
}
