import { LLMProvider } from "./base.js";

const DEFAULT_MODEL = "gemini-flash-lite-latest";

export class GeminiProvider extends LLMProvider {
  constructor({ apiKey, model = DEFAULT_MODEL }) {
    super();
    this.apiKey = apiKey;
    this.model = model;
  }

  async analyze({ system, user, maxTokens = 900, temperature = 0.1, schema = null }) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const generationConfig = { maxOutputTokens: maxTokens, temperature };
    if (schema) {
      generationConfig.responseMimeType = "application/json";
      generationConfig.responseSchema = schema;
    }
    const body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig,
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`gemini ${res.status}: ${errText.slice(0, 300)}`);
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const usage = {
      inputTokens: data?.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: data?.usageMetadata?.candidatesTokenCount ?? 0,
    };
    return { text, usage };
  }
}
