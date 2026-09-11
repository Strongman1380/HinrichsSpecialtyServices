const { applyCors } = require("./cors");
const { enforceRateLimit } = require("./rate-limit");
const { rejectOversizedJson } = require("./request-limits");

function cleanText(value, maxLength = 500) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function escapeHtml(value) {
  return cleanText(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

module.exports = async (req, res) => {
  const corsAllowed = applyCors(req, res);
  if (req.method === "OPTIONS") return corsAllowed ? res.status(204).end() : res.status(403).end();
  if (!corsAllowed) return res.status(403).json({ error: "Origin not allowed" });
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (rejectOversizedJson(req, res, 64_000)) return;

  try {
    const allowed = await enforceRateLimit(req, "survey-notify", 10, 60 * 60 * 1000);
    if (!allowed) return res.status(429).json({ error: "Too many requests. Please try again later." });
  } catch (error) {
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }

  const { surveyTitle, surveyId, submittedAt, response } = req.body || {};
  const safeTitle = cleanText(surveyTitle, 120);
  const safeId = cleanText(surveyId, 120);
  const submittedDate = new Date(submittedAt);

  if (!safeTitle || !safeId || Number.isNaN(submittedDate.getTime()) || !response || typeof response !== "object" || Array.isArray(response)) {
    return res.status(400).json({ error: "Invalid notification data" });
  }

  const responseEntries = Object.entries(response).slice(0, 50);
  console.log(`[Survey Notification] New response for survey ${safeId}`);

  const apiKey = process.env.RESEND_API_KEY;
  const notifyEmail = process.env.NOTIFY_EMAIL;

  if (!apiKey || !notifyEmail) {
    return res.json({ success: true, method: "log-only" });
  }

  const rows = responseEntries
    .map(([key, value]) => {
      const displayValue = Array.isArray(value) ? value.slice(0, 20).join(", ") : value;
      return `<tr><td style="padding:6px 12px;font-weight:600;color:#374151;white-space:nowrap">${escapeHtml(key)}</td><td style="padding:6px 12px;color:#6b7280">${escapeHtml(displayValue || "Not provided")}</td></tr>`;
    })
    .join("");

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:640px;margin:0 auto">
      <div style="background:#2563eb;padding:24px 32px;border-radius:12px 12px 0 0">
        <h1 style="color:#fff;margin:0;font-size:20px">New Survey Response</h1>
      </div>
      <div style="background:#ffffff;border:1px solid #e5e7eb;border-top:none;padding:24px 32px;border-radius:0 0 12px 12px">
        <p style="color:#374151;margin:0 0 8px"><strong>Survey:</strong> ${escapeHtml(safeTitle)}</p>
        <p style="color:#6b7280;font-size:14px;margin:0 0 24px">Submitted: ${escapeHtml(submittedDate.toLocaleString())}</p>
        <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:8px;overflow:hidden">
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;

  try {
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Survey Platform <onboarding@resend.dev>",
        to: notifyEmail,
        subject: `New Response: ${safeTitle}`,
        html,
      }),
    });

    if (!emailRes.ok) {
      console.error("Resend notification failed with status", emailRes.status);
      return res.status(502).json({ error: "Notification could not be sent" });
    }

    return res.json({ success: true, method: "email" });
  } catch (error) {
    console.error("Notify error:", error);
    return res.status(500).json({ error: "Notification could not be sent" });
  }
};
