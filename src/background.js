import { loginStep1, loginStep2 } from "./auth.js";
import { generate, reserve } from "./api.js";
import { encryptSession, decryptSession } from "./crypto.js";

let currentSession = null;

// Ensure session storage can only be accessed by trusted extension contexts (e.g., popup, background)
// and not by content scripts.
chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });

async function getSession() {
  // First, check in-memory session storage
  const sessionData = await chrome.storage.session.get(["activeSession"]);
  if (sessionData.activeSession) {
    return { session: sessionData.activeSession };
  }
  
  // If not in session, check local storage
  const localData = await chrome.storage.local.get(["encryptedSession"]);
  if (localData.encryptedSession) {
    return { locked: true };
  }

  return null;
}

async function setSession(session, passphrase) {
  // Store plain session in memory (lost on browser close)
  await chrome.storage.session.set({ activeSession: session });
  
  // Store encrypted session to disk
  const encrypted = await encryptSession(session, passphrase);
  await chrome.storage.local.set({ encryptedSession: encrypted });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Security Verification: Only allow specific commands if the message originated from a content script
  if (sender.tab && request.type !== "GENERATE_HME" && request.type !== "CHECK_SESSION") {
    sendResponse({ success: false, error: "Unauthorized command from content script." });
    return false;
  }

  (async () => {
    try {
      if (request.type === "CHECK_SESSION") {
        const state = await getSession();
        if (state && state.session) {
          sendResponse({ success: true, loggedIn: true });
        } else if (state && state.locked) {
          sendResponse({ success: true, locked: true });
        } else {
          sendResponse({ success: true, loggedIn: false });
        }
      } else if (request.type === "LOGIN_STEP_1") {
        const { appleId, password, passphrase } = request.payload;
        const result = await loginStep1(appleId, password);
        if (!result.requires2FA) {
          await setSession(result.session, passphrase);
        }
        sendResponse({ success: true, ...result });
      } else if (request.type === "LOGIN_STEP_2") {
        const { code, sessionHeaders, passphrase } = request.payload;
        const result = await loginStep2(code, sessionHeaders);
        if (!result.requires2FA) {
          await setSession(result.session, passphrase);
        }
        sendResponse({ success: true, ...result });
      } else if (request.type === "UNLOCK_SESSION") {
        const { passphrase } = request.payload;
        const localData = await chrome.storage.local.get(["encryptedSession"]);
        if (!localData.encryptedSession) {
          throw new Error("No encrypted session found.");
        }
        const session = await decryptSession(localData.encryptedSession, passphrase);
        await chrome.storage.session.set({ activeSession: session });
        sendResponse({ success: true });
      } else if (request.type === "LOGOUT") {
        await chrome.storage.session.remove(["activeSession"]);
        await chrome.storage.local.remove(["encryptedSession"]);
        sendResponse({ success: true });
      } else if (request.type === "GENERATE_HME") {
        const state = await getSession();
        if (!state || !state.session) throw new Error("Not logged in");
        const generated = await generate(state.session);
        const { hme } = generated;
        const host = request.payload?.host || "Web Extension";
        await reserve(state.session, hme, host, "Generated via browser extension");
        sendResponse({ success: true, email: hme });
      } else {
        sendResponse({ success: false, error: "Unknown command" });
      }
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
  })();
  
  return true;
});
