const admin = require("firebase-admin");
const { applyCors } = require("./cors");
const { enforceRateLimit } = require("./rate-limit");
const { rejectOversizedJson } = require("./request-limits");
const { sendSurveyNotification } = require("./survey-notification");

function cleanAnswer(value) {
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => String(item || "").trim().slice(0, 500));
  return String(value || "").trim().slice(0, 3000);
}

module.exports = async (req, res) => {
  const corsAllowed = applyCors(req, res);
  if (req.method === "OPTIONS") return corsAllowed ? res.status(204).end() : res.status(403).end();
  if (!corsAllowed) return res.status(403).json({ error: "Origin not allowed" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (rejectOversizedJson(req, res, 64_000)) return;
  if (String(req.body?.website || "").trim()) return res.json({ success: true });

  const allowed = await enforceRateLimit(req, "survey", 5, 60 * 60 * 1000);
  if (!allowed) return res.status(429).json({ error: "Too many submissions. Please try again later." });

  const surveyId = String(req.body?.surveyId || "").trim().slice(0, 160);
  if (!surveyId) return res.status(400).json({ error: "Survey ID is required" });

  const firestore = admin.firestore();
  let snapshot = await firestore.collection("surveys").where("id", "==", surveyId).limit(1).get();
  let surveyDoc = snapshot.docs[0];
  if (!surveyDoc) {
    const direct = await firestore.collection("surveys").doc(surveyId).get();
    if (direct.exists) surveyDoc = direct;
  }
  if (!surveyDoc) return res.status(404).json({ error: "Survey not found" });

  const survey = surveyDoc.data();
  if (survey.active !== true || survey.archivedAt) return res.status(410).json({ error: "Survey is closed" });

  const submitted = req.body?.data && typeof req.body.data === "object" ? req.body.data : {};
  const cleanData = {};
  for (const question of Array.isArray(survey.questions) ? survey.questions.slice(0, 50) : []) {
    const answer = cleanAnswer(submitted[question.id]);
    const missing = Array.isArray(answer) ? answer.length === 0 : !answer;
    if (question.required && missing) {
      return res.status(400).json({ error: `A required answer is missing: ${String(question.label || question.id).slice(0, 120)}` });
    }
    if (["select", "radio", "checkbox"].includes(question.type) && (Array.isArray(answer) ? answer : [answer]).filter(Boolean).some(value => !question.options?.includes(value))) return res.status(400).json({ error: "Choose one of the available answers." });
    if (answer && question.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answer)) return res.status(400).json({ error: "Enter a valid email." });
    if (answer && question.type === "number" && !Number.isFinite(Number(answer))) return res.status(400).json({ error: "Enter a valid number." });
    cleanData[String(question.id).slice(0, 120)] = answer;
  }

  const response = await firestore.collection("responses").add({
    surveyId: survey.id || surveyDoc.id,
    surveyTitle: String(survey.title || "Survey").slice(0, 200),
    submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    data: cleanData,
  });

  let notification = "not-configured";
  try {
    notification = await sendSurveyNotification({
      surveyId: survey.id || surveyDoc.id,
      surveyTitle: String(survey.title || "Survey").slice(0, 200),
      response: cleanData,
    });
  } catch (error) {
    console.error("[submit-survey] Notification failed", error.message);
    notification = "failed";
  }

  return res.json({ success: true, id: response.id, notification });
};
