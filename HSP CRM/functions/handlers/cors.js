const DEFAULT_ALLOWED_ORIGINS = [
  "https://crm.hinrichsspecialtyservices.com",
  "https://hinrichsspecialtyservices.com",
  "https://www.hinrichsspecialtyservices.com",
  "https://hsp-crm.web.app",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://localhost:5173",
];

function applyCors(req, res) {
  const origins = (process.env.ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGINS.join(","))
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const requestOrigin = req.headers.origin;
  const allowedOrigin = requestOrigin && origins.includes(requestOrigin) ? requestOrigin : null;

  if (allowedOrigin) res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  return Boolean(allowedOrigin);
}

module.exports = { applyCors };
