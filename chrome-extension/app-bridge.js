"use strict";
// Runs on our app domain only. No Gmail access and no automatic scanning.
(() => {
  if (location.pathname !== "/scanner") return;
  let requested = false;
  window.addEventListener("message", async (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    if (event.data?.type !== "EMAILDETECTION_SCANNER_READY") return;
    if (requested) return;
    const token = new URL(location.href).searchParams.get("gmail_import");
    if (!token) return;
    requested = true;
    try {
      const response = await chrome.runtime.sendMessage({ type:"ED_RECEIVE_GMAIL", token });
      window.postMessage({ type:"EMAILDETECTION_GMAIL_IMPORT", token, email:response?.email || null, error:response?.error || null }, location.origin);
    } catch {
      window.postMessage({ type:"EMAILDETECTION_GMAIL_IMPORT", token, email:null, error:"Unable to connect to the extension. Reload it and try again." }, location.origin);
    }
  });
})();
