"use strict";
// Executed only when the user clicks Analyze in the extension popup.
(() => {
  if (location.hostname !== "mail.google.com") return { error:"Open a message in Gmail first." };
  const visible = el => Boolean(el && el.getClientRects().length && getComputedStyle(el).visibility !== "hidden");
  const blocks = [...document.querySelectorAll(".adn")].filter(visible);
  const expanded = blocks.filter(block => [...block.querySelectorAll(".a3s")].some(visible));
  const item = expanded.at(-1);
  const bodyEl = item && [...item.querySelectorAll(".a3s")].find(visible);
  const subject = document.querySelector("h2.hP, .hP")?.textContent?.trim() || "";
  const from = item?.querySelector(".gD[email]") || item?.querySelector("[email]");
  const sender = from ? `${from.getAttribute("name") || from.textContent?.trim() || "Sender"} <${from.getAttribute("email") || ""}>` : "";
  if (!bodyEl || !bodyEl.innerText?.trim()) return { error:"Open and expand a Gmail message, then try again." };
  const body = bodyEl.innerText.trim().slice(0, 110000);
  const urls = [...bodyEl.querySelectorAll("a[href]")].map(a => a.href).filter(href=>/^https?:\/\//i.test(href)).slice(0,35);
  return { subject:subject.slice(0,500),sender:sender.slice(0,500),body,urls };
})();
