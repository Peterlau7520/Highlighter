// Chrome Highlighter/lib/auth.js
// Shared session helper, imported by background.js (service worker) and
// popups/popup.js. Not used by content scripts — they never talk to auth
// directly, they only ask background.js via chrome.runtime.sendMessage.

const BACKEND_URL = "http://localhost:3000";
const SESSION_KEY = "session";
// Treat a session as expired slightly before its real expiry so a request
// in flight doesn't get rejected mid-air by the backend.
const REFRESH_SKEW_MS = 5 * 60 * 1000;

/**
 * Reads the stored session ({ sessionToken, expiresAt, user }) from
 * chrome.storage.local, or null if none is stored.
 *
 * @returns {Promise<{sessionToken: string, expiresAt: number, user: object}|null>}
 */
export async function getSession() {
  const { [SESSION_KEY]: session } = await chrome.storage.local.get(
    SESSION_KEY,
  );
  return session ?? null;
}

/**
 * Persists a session returned by POST /auth/google.
 *
 * @param {{sessionToken: string, expiresAt: number, user: object}} session
 */
export async function saveSession(session) {
  await chrome.storage.local.set({ [SESSION_KEY]: session });
}

/** Clears the stored session (used on sign-out or unrecoverable auth failure). */
export async function clearSession() {
  await chrome.storage.local.remove(SESSION_KEY);
}

/**
 * Exchanges a Google OAuth access token for a backend-issued session JWT by
 * calling POST /auth/google, and persists the result.
 *
 * @param {string} googleAccessToken
 * @returns {Promise<{sessionToken: string, expiresAt: number, user: object}>}
 */
async function exchangeGoogleToken(googleAccessToken) {
  const response = await fetch(`${BACKEND_URL}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken: googleAccessToken }),
  });
  if (!response.ok) {
    throw new Error(`/auth/google failed: ${response.status}`);
  }
  const session = await response.json();
  await saveSession(session);
  return session;
}

/**
 * Wraps chrome.identity.getAuthToken in a promise (it's callback-based).
 *
 * @param {boolean} interactive - whether Google's consent UI may be shown
 * @returns {Promise<string|null>} the Google access token, or null if unavailable
 */
function getGoogleAuthToken(interactive) {
  return new Promise((resolve) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError || !token) {
        resolve(null);
        return;
      }
      resolve(token);
    });
  });
}

/**
 * Returns a valid session, refreshing silently (no UI) if the stored one is
 * missing or close to expiry. Call this before every authenticated backend
 * request.
 *
 * @returns {Promise<{sessionToken: string, expiresAt: number, user: object}|null>}
 *   null means silent refresh failed — the caller must fall back to
 *   `signInInteractive()` from a real user gesture (e.g. the popup button).
 */
export async function ensureFreshSession() {
  const existing = await getSession();
  if (existing && existing.expiresAt - Date.now() > REFRESH_SKEW_MS) {
    return existing;
  }

  const googleToken = await getGoogleAuthToken(false);
  if (!googleToken) {
    await clearSession();
    return null;
  }

  try {
    return await exchangeGoogleToken(googleToken);
  } catch (e) {
    console.log("silent session refresh failed:", e);
    await clearSession();
    return null;
  }
}

/**
 * Runs the interactive Google sign-in flow (shows Google's consent screen).
 * Must be called from a real user gesture (e.g. a button click in the popup).
 *
 * @returns {Promise<{sessionToken: string, expiresAt: number, user: object}>}
 */
export async function signInInteractive() {
  const googleToken = await getGoogleAuthToken(true);
  if (!googleToken) {
    throw new Error("Google sign-in was cancelled or failed");
  }
  return exchangeGoogleToken(googleToken);
}

/** Signs the user out: revokes the cached Google token and clears the session. */
export async function signOut() {
  await new Promise((resolve) => chrome.identity.clearAllCachedAuthTokens(resolve));
  await clearSession();
}
