const admin = require("firebase-admin");

const { email: ADMIN_EMAIL, uid: ADMIN_UID } = require('../data/admin-identity.json');

async function verifyAdmin(req) {
  const authHeader = req.headers.authorization || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!idToken) return { ok: false, status: 401, error: "Missing admin authorization" };

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    if (decoded.email !== ADMIN_EMAIL || decoded.email_verified !== true || decoded.uid !== ADMIN_UID) {
      return { ok: false, status: 403, error: "Admin access required" };
    }
    return { ok: true, user: decoded };
  } catch {
    return { ok: false, status: 401, error: "Invalid admin authorization" };
  }
}

module.exports = { ADMIN_EMAIL, verifyAdmin };
