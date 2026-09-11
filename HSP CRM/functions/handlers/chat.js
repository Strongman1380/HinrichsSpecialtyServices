const serviceInfo = require("../data/service-info.json");
const { applyCors } = require("./cors");
const { enforceRateLimit } = require("./rate-limit");
const { rejectOversizedJson } = require("./request-limits");
const { getFaqResponse, getEscalationResponse } = require("./faq-fallback");

function cleanHistory(value) {
  if (!Array.isArray(value)) return [];
  return value
    .slice(-10)
    .map((entry) => ({
      role: entry?.role === "assistant" ? "assistant" : "user",
      content: String(entry?.content || "").trim().slice(0, 1200),
    }))
    .filter((entry) => entry.content);
}

module.exports = async (req, res) => {
  const corsAllowed = applyCors(req, res);
  if (req.method === "OPTIONS") return corsAllowed ? res.status(204).end() : res.status(403).end();
  if (!corsAllowed) return res.status(403).json({ error: "Origin not allowed" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (rejectOversizedJson(req, res, 24_000)) return;

  const allowed = await enforceRateLimit(req, "chat", 20, 10 * 60 * 1000);
  if (!allowed) return res.status(429).json({ error: "Too many chat requests. Please try again shortly." });

  const legacyHistory = cleanHistory(req.body?.messages);
  const history = cleanHistory(req.body?.history || legacyHistory);
  const message = String(req.body?.message || history.at(-1)?.content || "").trim().slice(0, 600);
  if (!message) return res.status(400).json({ error: "A message is required" });

  const faqResponse = getFaqResponse(message, serviceInfo);
  if (faqResponse) return res.json({ content: faqResponse, fallback: true });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.json({ content: getEscalationResponse(serviceInfo), fallback: true });

  const conversation = history.length
    ? history
    : [{ role: "user", content: message }];
  if (conversation.at(-1)?.content !== message) conversation.push({ role: "user", content: message });

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        system: `You are the website assistant for HSST. Use only the business information below. If the answer is not present, offer to connect the visitor with Brandon. Never invent pricing, guarantees, timelines, or account information. When a visitor clearly asks to be contacted and provides a name, email, and need, append [LEAD:{"name":"...","email":"...","interest":"..."}] to the end of the response.\n\n${JSON.stringify(serviceInfo)}`,
        messages: conversation,
      }),
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error("[chat] Anthropic error", upstream.status, data?.error?.type || "unknown");
      return res.json({ content: getEscalationResponse(serviceInfo), fallback: true });
    }

    const content = String(data.content?.[0]?.text || "").trim().slice(0, 2400);
    if (!content) return res.status(502).json({ error: "Assistant returned an empty response" });
    return res.json({ content });
  } catch (error) {
    console.error("[chat] Request failed", error);
    return res.json({ content: getEscalationResponse(serviceInfo), fallback: true });
  }
};
