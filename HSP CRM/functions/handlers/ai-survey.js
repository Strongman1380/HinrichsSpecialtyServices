const { applyCors } = require("./cors");
const { verifyAdmin } = require("./auth");

module.exports = async (req, res) => {
  const corsAllowed = applyCors(req, res);
  if (req.method === "OPTIONS") return corsAllowed ? res.status(204).end() : res.status(403).end();
  if (!corsAllowed) return res.status(403).json({ error: "Origin not allowed" });
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const administrator = await verifyAdmin(req);
  if (!administrator.ok) return res.status(administrator.status).json({ error: administrator.error });

  const { description } = req.body || {};
  const cleanDescription = String(description || "").trim().slice(0, 2000);
  if (!cleanDescription) {
    return res.status(400).json({ error: "Description is required" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
  }

  const systemPrompt = `You are an expert survey designer. Given a description, create a professional survey.
Return ONLY valid JSON (no markdown, no code blocks) with this exact structure:
{
  "title": "Survey Title",
  "description": "One sentence describing the survey",
  "questions": [
    {
      "id": "q1",
      "type": "text",
      "label": "Question text here",
      "required": true
    },
    {
      "id": "q2",
      "type": "radio",
      "label": "Question text here",
      "required": true,
      "options": ["Option A", "Option B", "Option C"]
    }
  ]
}
Types available: text, email, number, textarea, radio, checkbox
Use radio for single-choice, checkbox for multi-select.
Create 8-15 thoughtful, specific questions appropriate for the described purpose.
Make IDs like q1, q2, q3 etc.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: `Create a survey for: ${cleanDescription}` }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic error:", err);
      return res.status(500).json({ error: "AI generation failed" });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "";

    let survey;
    try {
      // Strip any accidental markdown fences
      const clean = text
        .replace(/^```[a-z]*\n?/m, "")
        .replace(/```$/m, "")
        .trim();
      survey = JSON.parse(clean);
    } catch {
      console.error("Failed to parse AI response:", text);
      return res.status(500).json({ error: "AI returned invalid JSON. Try again." });
    }

    return res.json({ survey });
  } catch (err) {
    console.error("ai-survey error:", err);
    return res.status(500).json({ error: err.message });
  }
};
