import type { Session } from "../types.js";

const BACKEND_URL = "http://localhost:3000";
const SESSION_KEY = "session";
const REFRESH_SKEW_MS = 5 * 60 * 1000;

export async function getSession(): Promise<Session | null> {
  const { [SESSION_KEY]: session } =
    await chrome.storage.local.get(SESSION_KEY);
  return (session as Session) ?? null;
}

export async function saveSession(session: Session): Promise<void> {
  await chrome.storage.local.set({ [SESSION_KEY]: session });
}

export async function clearSession(): Promise<void> {
  await chrome.storage.local.remove(SESSION_KEY);
}

async function exchangeGoogleToken(
  googleAccessToken: string,
): Promise<Session> {
  const response = await fetch(`${BACKEND_URL}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken: googleAccessToken }),
  });
  if (!response.ok) throw new Error(`/auth/google failed: ${response.status}`);
  const session = (await response.json()) as Session;
  await saveSession(session);
  return session;
}

function getGoogleAuthToken(interactive: boolean): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.identity.getAuthToken({ interactive }, (result) => {
      if (chrome.runtime.lastError || !result?.token) {
        resolve(null);
        return;
      }
      resolve(result.token);
    });
  });
}

export async function ensureFreshSession(): Promise<Session | null> {
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

export async function signInInteractive(): Promise<Session> {
  const googleToken = await getGoogleAuthToken(true);
  if (!googleToken) throw new Error("Google sign-in was cancelled or failed");
  return exchangeGoogleToken(googleToken);
}

export async function signOut(): Promise<void> {
  await new Promise<void>((resolve) =>
    chrome.identity.clearAllCachedAuthTokens(() => resolve()),
  );
  await clearSession();
}
