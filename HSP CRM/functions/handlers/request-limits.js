function rejectOversizedJson(req, res, maxBytes = 32_000) {
  const declaredLength = Number(req.headers["content-length"] || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    res.status(413).json({ error: "Request is too large" });
    return true;
  }

  try {
    if (Buffer.byteLength(JSON.stringify(req.body || {}), "utf8") > maxBytes) {
      res.status(413).json({ error: "Request is too large" });
      return true;
    }
  } catch {
    res.status(400).json({ error: "Invalid request data" });
    return true;
  }

  return false;
}

module.exports = { rejectOversizedJson };
