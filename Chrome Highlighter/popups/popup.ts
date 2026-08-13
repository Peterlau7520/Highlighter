import { getSession, signInInteractive, signOut } from "../lib/auth.js";

const statusEl = document.getElementById("status") as HTMLElement;
const signinBtn = document.getElementById("signin-btn") as HTMLButtonElement;
const signoutBtn = document.getElementById("signout-btn") as HTMLButtonElement;

async function render(): Promise<void> {
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

async function closeIfOnboardingTab(): Promise<void> {
  const win = await chrome.windows.getCurrent();
  if (win.type === "normal") {
    const tab = await chrome.tabs.getCurrent();
    if (tab && tab.id !== undefined) chrome.tabs.remove(tab.id);
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
