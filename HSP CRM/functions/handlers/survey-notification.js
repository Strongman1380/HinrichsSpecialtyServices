function escapeHtml(value) {
  return String(value ?? "")
    .slice(0, 3000)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function sendSurveyNotification({ surveyId, surveyTitle, response }) {
  console.log(`[Survey Notification] New response for survey ${surveyId}`);
  const apiKey = process.env.RESEND_API_KEY;
  const notifyEmail = process.env.NOTIFY_EMAIL;
  if (!apiKey || !notifyEmail) return "log-only";

  const rows = Object.entries(response)
    .slice(0, 50)
    .map(([key, value]) => {
      const displayValue = Array.isArray(value) ? value.slice(0, 20).join(", ") : value;
      return `<tr><td style="padding:6px 12px;font-weight:600;color:#374151;white-space:nowrap">${escapeHtml(key)}</td><td style="padding:6px 12px;color:#6b7280">${escapeHtml(displayValue || "Not provided")}</td></tr>`;
    })
    .join("");

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:640px;margin:0 auto"><div style="background:#2563eb;padding:24px 32px;border-radius:12px 12px 0 0"><h1 style="color:#fff;margin:0;font-size:20px">New Survey Response</h1></div><div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:24px 32px;border-radius:0 0 12px 12px"><p style="color:#374151;margin:0 0 24px"><strong>Survey:</strong> ${escapeHtml(surveyTitle)}</p><table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:8px;overflow:hidden"><tbody>${rows}</tbody></table></div></div>`;
  const responseResult = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Survey Platform <onboarding@resend.dev>",
      to: notifyEmail,
      subject: `New Response: ${String(surveyTitle).slice(0, 120)}`,
      html,
    }),
  });
  if (!responseResult.ok) throw new Error(`Survey notification failed with status ${responseResult.status}`);
  return "email";
}

module.exports = { sendSurveyNotification };
