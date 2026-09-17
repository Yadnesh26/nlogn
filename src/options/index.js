import { getSettings, setSettings } from "../shared/settings.js";

const DEFAULT_MODELS = {
  gemini: "gemini-flash-lite-latest",
  deepseek: "deepseek-chat",
  openai: "gpt-4o-mini",
  anthropic: "claude-haiku-4-5",
};

const providerEl = document.getElementById("provider");
const modelEl = document.getElementById("model");
const apiKeyEl = document.getElementById("apiKey");
const validateBtn = document.getElementById("validate");
const statusEl = document.getElementById("status");

const CHECK_ICON =
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

function setStatus(text, kind) {
  statusEl.className = kind ?? "";
  statusEl.innerHTML = "";
  if (kind === "ok") {
    const icon = document.createElement("span");
    icon.innerHTML = CHECK_ICON;
    statusEl.append(icon);
  }
  statusEl.append(document.createTextNode(text));
}

async function init() {
  const settings = await getSettings();
  providerEl.value = settings.provider;
  modelEl.value = settings.model || DEFAULT_MODELS[settings.provider];
  apiKeyEl.value = settings.apiKey;
  if (settings.validatedAt) {
    setStatus(`Validated ${new Date(settings.validatedAt).toLocaleString()}`, "ok");
  }
}

providerEl.addEventListener("change", () => {
  modelEl.value = DEFAULT_MODELS[providerEl.value];
  setStatus("", "");
});

validateBtn.addEventListener("click", async () => {
  const provider = providerEl.value;
  const model = modelEl.value.trim();
  const apiKey = apiKeyEl.value.trim();

  if (!apiKey) {
    setStatus("Enter an API key first.", "err");
    return;
  }

  validateBtn.disabled = true;
  setStatus("validating...", "");

  const result = await chrome.runtime.sendMessage({
    __nlogn: "rpc",
    method: "validateKey",
    params: { provider, apiKey, model },
  });

  validateBtn.disabled = false;

  if (!result.ok) {
    setStatus(`Validation failed: ${result.error}`, "err");
    return;
  }

  const saved = await setSettings({ provider, model, apiKey, validatedAt: Date.now() });
  setStatus(`Validated against ${saved.model}. Saved.`, "ok");
});

init();
