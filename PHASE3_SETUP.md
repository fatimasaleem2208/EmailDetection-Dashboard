# EmailDetection Phase 3 — Email Header Analyzer

Copy these **three** source files into your existing project, preserving their folder paths:

1. `src/lib/email-header-analyzer.ts` — NEW parser
2. `src/routes/_authenticated/header-analysis.tsx` — NEW page
3. `src/components/app-shell.tsx` — REPLACE (adds navigation)

No `.env` changes, API keys, npm packages, database migrations, or SMTP changes needed.

Restart `npm run dev`. With TanStack Router file-based routing, Vite regenerates `routeTree.gen.ts` automatically; do NOT manually edit that generated file.

Visit http://localhost:3000/header-analysis. Click **Load sample**, then **Analyze headers**. Expected: SPF pass, DKIM fail, DMARC fail, and Reply-To mismatch warning. Test a second header with `spf=pass; dkim=pass; dmarc=pass` and matching From/Reply-To. The tool reports evidence only and does not prove safety.

Privacy: header text is analyzed in the browser and is not sent to Gemini or other services by this feature. Do not paste real private headers into a public chat. The browser state clears if this page is reloaded.
