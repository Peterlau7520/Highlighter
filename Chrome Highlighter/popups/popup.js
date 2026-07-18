// popups/popup.js
import { getSession, signInInteractive, signOut } from "../lib/auth.js";

const statusEl = document.getElementById("status");
const signinBtn = document.getElementById("signin-btn");
const signoutBtn = document.getElementById("signout-btn");

/**
 * Renders the popup UI based on the currently stored session: shows
 * "Signed in as {email}" + Sign out when signed in, or a Sign in button
 * otherwise. Used both as the toolbar popup and as the one-time onboarding
 * tab opened by background.js on install.
 */
async function render() {
  const session = await getSession();
  const isSignedIn = session && session.expiresAt > Date.now();

  if (isSignedIn) {
    statusEl.textContent = `Signed in as ${session.user.email}`;
    signinBtn.hidden = true;
    signoutBtn.hidden = false;
  } else {
    statusEl.textContent = "Not signed in";
    signinBtn.hidden = false;
    signoutBtn.hidden = true;
  }
}

/**
 * Closes this tab if the popup was opened as a full onboarding tab (rather
 * than as the toolbar's default_popup), so a successful first-time sign-in
 * doesn't leave a stray tab around.
 */
async function closeIfOnboardingTab() {
  const win = await chrome.windows.getCurrent();
  if (win.type === "normal") {
    const tab = await chrome.tabs.getCurrent();
    if (tab) chrome.tabs.remove(tab.id);
  }
}

signinBtn.addEventListener("click", async () => {
  signinBtn.disabled = true;
  statusEl.textContent = "Signing in…";
  try {
    await signInInteractive();
    await render();
    await closeIfOnboardingTab();
  } catch (e) {
    console.log("sign-in failed:", e);
    statusEl.textContent = "Sign-in failed — try again";
  } finally {
    signinBtn.disabled = false;
  }
});

signoutBtn.addEventListener("click", async () => {
  signoutBtn.disabled = true;
  await signOut();
  await render();
  signoutBtn.disabled = false;
});

render();
