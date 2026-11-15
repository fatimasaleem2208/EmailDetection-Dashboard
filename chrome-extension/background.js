"use strict";
// Short-lived, single-use handoff; only readable by this extension.
const APP_ORIGIN = "https://emaildetection-dashboard.vercel.app";
const MAX_AGE_MS = 5 * 60 * 1000;
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "ED_STORE_GMAIL" && sender.url?.startsWith(`chrome-extension://${chrome.runtime.id}/`)) {
    (async () => {
      const email = message.email;
      if (!email || typeof email !== "object" || typeof email.body !== "string" || email.body.length > 120000) throw Error("Invalid email input.");
      const token = crypto.randomUUID();
      await chrome.storage.session.set({ ["gmail_" + token]: { email, at: Date.now() } });
      return { token };
    })().then(sendResponse).catch(err => sendResponse({ error: err.message }));
    return true;
  }
  if (message?.type === "ED_RECEIVE_GMAIL" && sender.url?.startsWith(APP_ORIGIN + "/scanner")) {
    (async () => {
      const token = message.token;
      if (typeof token !== "string" || !/^[a-f0-9-]{36}$/i.test(token)) return {error:"Invalid handoff identifier."};
      const key = "gmail_" + token;
      const result = await chrome.storage.session.get(key);
      if (!result[key]) return {error:"No pending Gmail import. Open the extension again."};
      await chrome.storage.session.remove(key);
      if (Date.now() - result[key].at > MAX_AGE_MS) return {error:"The import expired. Please try again."};
      return { email: result[key].email };
    })().then(sendResponse).catch(err => sendResponse({error:err.message}));
    return true;
  }
});
