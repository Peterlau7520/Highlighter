const jwt = require("jsonwebtoken");

const SESSION_TTL = "7d";

/**
 * Verifies a Google OAuth access token by asking Google's userinfo endpoint
 * who it belongs to. Throws if the token is missing/invalid/expired.
 *
 * @param {string} accessToken - Google access token from chrome.identity.getAuthToken
 * @returns {Promise<{sub: string, email: string, name?: string, picture?: string}>}
 */
async function verifyGoogleToken(accessToken) {
  const response = await fetch(
    "https://www.googleapis.com/oauth2/v3/userinfo",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok) {
    throw new Error("Invalid Google access token");
  }
  return response.json();
}

/**
 * Signs a backend session JWT for the given Google user, valid for
 * SESSION_TTL. Payload is intentionally minimal (sub, email) — full profile
 * data lives in the `users` collection, not the token.
 *
 * @param {{sub: string, email: string}} user
 * @returns {{sessionToken: string, expiresAt: number}}
 */
function issueSession(user) {
  const sessionToken = jwt.sign(
    { sub: user.sub, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: SESSION_TTL },
  );
  const { exp } = jwt.decode(sessionToken);
  return { sessionToken, expiresAt: exp * 1000 };
}

/**
 * Express middleware. Reads `Authorization: Bearer <sessionToken>`, verifies
 * it against JWT_SECRET, and sets `req.userId` to the Google account id
 * (`sub`). Responds 401 if missing/invalid/expired.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Missing session token" });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired session" });
  }
}

module.exports = { verifyGoogleToken, issueSession, requireAuth };
