import { setSettings } from "../shared/settings.js";

const DEFAULT_MODELS = {
  gemini: "gemini-flash-lite-latest",
  deepseek: "deepseek-chat",
  openai: "gpt-4o-mini",
  anthropic: "claude-haiku-4-5",
};

const PROVIDER_INFO = {
  gemini: {
    name: "Gemini",
    url: "https://aistudio.google.com/apikey",
    steps: ["Sign in with your Google account.", 'Click "Create API key".', "Copy the key."],
  },
  deepseek: {
    name: "DeepSeek",
    url: "https://platform.deepseek.com/api_keys",
    steps: ["Sign in or create an account.", 'Click "Create new API key".', "Copy it immediately — it's shown only once."],
  },
  openai: {
    name: "OpenAI",
    url: "https://platform.openai.com/api-keys",
    steps: ["Sign in to your OpenAI account.", 'Click "Create new secret key".', "Copy it immediately — it's shown only once."],
  },
  anthropic: {
    name: "Anthropic",
    url: "https://console.anthropic.com/settings/keys",
    steps: ["Sign in to the Anthropic console.", 'Click "Create Key".', "Copy the key."],
  },
};

let screen = 0;
let provider = "gemini";

const screens = [...document.querySelectorAll(".screen")];
const dots = [...document.querySelectorAll(".dot")];

function showScreen(n) {
  screen = n;
  screens.forEach((s) => s.classList.toggle("active", Number(s.dataset.screen) === n));
  dots.forEach((d) => d.classList.toggle("active", Number(d.dataset.dot) === n));
}

document.querySelectorAll("[data-next]").forEach((btn) => btn.addEventListener("click", () => showScreen(screen + 1)));
document.querySelectorAll("[data-back]").forEach((btn) => btn.addEventListener("click", () => showScreen(screen - 1)));

document.querySelectorAll(".provider").forEach((el) => {
  el.addEventListener("click", () => {
    document.querySelectorAll(".provider").forEach((p) => p.classList.remove("selected"));
    el.classList.add("selected");
    provider = el.dataset.provider;
  });
});

// Populate screen 2 (get key) whenever we arrive, based on the selected provider.
document.querySelector('[data-screen="1"] [data-next]').addEventListener("click", () => {
  const info = PROVIDER_INFO[provider];
  document.getElementById("providerNameLabel").textContent = info.name;
  document.getElementById("deepLink").href = info.url;
  const stepsEl = document.getElementById("keySteps");
  stepsEl.innerHTML = "";
  for (const step of info.steps) {
    const li = document.createElement("li");
    li.textContent = step;
    stepsEl.append(li);
  }
});

document.querySelector('[data-screen="2"] [data-next]').addEventListener("click", () => {
  document.getElementById("model").value = DEFAULT_MODELS[provider];
});

function setStatus(text, kind) {
  const el = document.getElementById("status");
  el.textContent = text;
  el.className = `status ${kind ?? ""}`;
}

document.getElementById("validateBtn").addEventListener("click", async () => {
  const apiKey = document.getElementById("apiKey").value.trim();
  const model = document.getElementById("model").value.trim();
  if (!apiKey) {
    setStatus("Enter an API key first.", "err");
    return;
  }

  const btn = document.getElementById("validateBtn");
  btn.disabled = true;
  setStatus("validating...", "");

  const result = await chrome.runtime.sendMessage({
    __nlogn: "rpc",
    method: "validateKey",
    params: { provider, apiKey, model },
  });

  btn.disabled = false;

  if (!result.ok) {
    setStatus(`Validation failed: ${result.error}`, "err");
    return;
  }

  await setSettings({ provider, model, apiKey, validatedAt: Date.now() });
  setStatus(`Validated against ${result.resolvedModel}.`, "ok");
  document.getElementById("doneRow").style.display = "flex";
});

document.getElementById("finishBtn").addEventListener("click", () => {
  chrome.tabs.create({ url: "https://leetcode.com/problems/two-sum/" });
  window.close();
});

function toggleDemo() {
  const el = document.getElementById("demoResult");
  el.style.display = el.style.display === "none" ? "block" : "none";
}
document.getElementById("showDemo0").addEventListener("click", toggleDemo);
document.getElementById("showDemo3").addEventListener("click", toggleDemo);
