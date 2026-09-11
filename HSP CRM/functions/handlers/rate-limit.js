const crypto = require("node:crypto");
const admin = require("firebase-admin");

function getClientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  // Google Cloud appends the actual client and proxy hops. Ignore any caller-supplied prefix.
  return forwarded.at(-2) || forwarded.at(-1) || req.ip || req.socket?.remoteAddress || "unknown";
}

async function enforceRateLimit(req, scope, limit, windowMs) {
  const now = Date.now();
  const bucket = Math.floor(now / windowMs);
  const identity = crypto.createHash("sha256").update(getClientIp(req)).digest("hex").slice(0, 24);
  const ref = admin.firestore().collection("_rateLimits").doc(`${scope}_${identity}_${bucket}`);

  return admin.firestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const count = snapshot.exists ? Number(snapshot.data().count || 0) : 0;
    if (count >= limit) return false;

    transaction.set(
      ref,
      {
        scope,
        count: count + 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: new Date((bucket + 2) * windowMs),
      },
      { merge: true },
    );
    return true;
  });
}

module.exports = { enforceRateLimit };
