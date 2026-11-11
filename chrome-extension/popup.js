"use strict";
const $ = (id) => document.getElementById(id);
let currentURL = null;
let appAddress = "http://localhost:3000";

function inspect(raw) {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol)) return { blocked: true, findings: ['Only HTTP/HTTPS URLs can be inspected.'], score: null };
  const host = url.hostname.toLowerCase();
  const findings = [];
  let score = 0;
  function flag(message, weight) { findings.push(message); score += weight; }
  if (url.protocol === 'http:') flag('Connection does not use HTTPS.', 18);
  if (url.username || url.password) flag('URL contains an embedded username/password.', 40);
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.startsWith('[')) flag('Website uses an IP address instead of a domain.', 23);
  if (host.includes('xn--')) flag('Domain contains punycode; check for a lookalike name.', 22);
  if (/\b(?:login|verify|reset|secure|account|wallet|bank|payment|support)\b/i.test(host.replace(/[.-]/g,' '))) flag('Domain contains account/security terms; verify the sender.', 12);
  if (host.split('.').length > 4) flag('Unusually many subdomains.', 13);
  if (raw.length > 250) flag('Very long URL; inspect the complete destination.', 12);
  if (url.port && !['80','443'].includes(url.port)) flag('Unusual port in URL.', 12);
  if (/(?:@|%40)/i.test(url.pathname + url.search)) flag('URL path or query includes an @ sign.', 9);
  if (/\.(?:exe|scr|bat|cmd|ps1|js|vbs|msi)(?:$|[?#])/i.test(url.pathname)) flag('URL points to a potentially executable file.', 28);
  return { blocked: false, findings, score: Math.min(score, 100), hostname:host };
}
function showResult(data) {
  const box = $('result'); box.className = 'result';
  const ul = $('findings'); ul.replaceChildren();
  data.findings.forEach((finding) => { const li = document.createElement('li'); li.textContent = finding; ul.appendChild(li); });
  if (data.blocked) {
    $('headline').textContent = 'Cannot inspect this page';
    $('summary').textContent = 'Switch to an ordinary HTTP or HTTPS website.';
  } else if (data.score >= 40) {
    box.classList.add('danger'); $('headline').textContent = 'Multiple URL warning signs';
    $('summary').textContent = 'Structural indicator score: ' + data.score + '/100. Consider a deeper reputation check.';
  } else if (data.score > 0) {
    box.classList.add('warn'); $('headline').textContent = 'Some URL warning signs';
    $('summary').textContent = 'Structural indicator score: ' + data.score + '/100. No malware lookup performed.';
  } else {
    box.classList.add('neutral'); $('headline').textContent = 'No obvious structural warning signs';
    $('summary').textContent = 'No structural flags found. This does NOT mean the website is safe.';
  }
}
async function init() {
  const stored = await chrome.storage.local.get('appAddress');
  if (typeof stored.appAddress === 'string') appAddress = stored.appAddress;
  $('app-base').value = appAddress;
  const tabs = await chrome.tabs.query({ active:true, currentWindow:true });
  const tabURL = tabs?.[0]?.url;
  try {
    if (!tabURL) throw new Error('No URL available');
    const parsed = new URL(tabURL);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Not a website URL');
    currentURL = parsed.toString();
    $('target').textContent = currentURL;
    $('scan').disabled = false; $('open').disabled = false; $('copy').disabled = false;
    showResult(inspect(currentURL));
  } catch { $('target').textContent = 'Open an ordinary website tab to scan.'; showResult({ blocked:true, findings:[], score:null }); }
}
$('scan').addEventListener('click', () => { if (currentURL) showResult(inspect(currentURL)); });
$('open').addEventListener('click', async () => {
  if (!currentURL) return;
  try {
    const base = new URL(appAddress);
    if (!(base.protocol === 'https:' || (base.protocol === 'http:' && ['localhost','127.0.0.1'].includes(base.hostname)))) throw new Error('Use HTTPS or localhost');
    const destination = new URL('/url-analysis', base);
    // URL query may contain sensitive tokens. Share only the scheme, host and path by default.
    const current = new URL(currentURL);
    const sanitized = current.origin + current.pathname;
    destination.searchParams.set('url', sanitized);
    await chrome.tabs.create({ url: destination.toString() });
  } catch { $('settings').hidden = false; $('setting-note').textContent = 'Enter a valid HTTPS app address or localhost URL.'; }
});
$('copy').addEventListener('click', async () => { if (!currentURL) return; await navigator.clipboard.writeText(currentURL); $('copy').textContent='Copied'; });
$('settings-toggle').addEventListener('click', () => { $('settings').hidden=!$('settings').hidden; });
$('save-base').addEventListener('click', async () => {
  try {
    const base = new URL($('app-base').value.trim());
    if (!(base.protocol === 'https:' || (base.protocol === 'http:' && ['localhost','127.0.0.1'].includes(base.hostname))) || base.username || base.password) throw new Error();
    appAddress = base.origin;
    await chrome.storage.local.set({appAddress});
    $('setting-note').textContent = 'Saved: ' + appAddress;
  } catch { $('setting-note').textContent='Use a valid HTTPS address or http://localhost:3000.'; }
});
init().catch(() => { $('target').textContent='Unable to read current tab.'; });
