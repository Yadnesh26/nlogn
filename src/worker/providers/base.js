// request:  { system, user, maxTokens, temperature, schema }
//   schema, when given, requests structured JSON output conforming to it
//   (provider-specific dialect — see providers/gemini.js).
// returns:  { text, usage: { inputTokens, outputTokens } }
// Only implementation today is BYOK (key comes from chrome.storage.local).
// A future HostedProvider is one new class here, not a rewrite.
export class LLMProvider {
  async analyze(_request) {
    throw new Error("not implemented");
  }
}
