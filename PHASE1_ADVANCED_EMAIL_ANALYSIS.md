# Phase 1: Advanced Email Threat Analysis

This update builds on the existing rule-based detection engine without changing Gemini, Supabase credentials, database columns, or existing sign-in/OTP functionality.

## Files to replace (copy into the same paths in your existing VS Code project)

1. `src/lib/phishing-engine.ts` — Adds detection of QR-code phishing lures, business email compromise/payment destination changes, gift-card code requests, remote-access software lures, and compounded suspicious credential/payment signals.
2. `src/lib/scans.server.ts` — Makes Gemini explanations state uncertainty clearly and ignore instructions embedded in the analyzed email.
3. `src/components/scan-result-view.tsx` — Renames the misleading “Model confidence” label to “Heuristic confidence”. This score is not an empirically calibrated probability.

No new `src/data` folder or `.env` variables are required. Keep your existing `.env`, `supabase/`, and authentication files intact.

## Install

1. Make a backup of your current project.
2. Copy **only the three paths above** into their matching locations and replace those files.
3. Do not copy this patch as a nested `phish-ai` folder inside `src`.
4. Run `npm run dev` and test the scans.

## Test emails

**QR phishing** — Subject: Verify your account. Body: "Please scan the QR code to verify your account and sign in immediately."

**Business email compromise** — Subject: Invoice details changed. Body: "Our bank details have changed. Keep this between us, send the invoice payment to the new account."

**Gift-card fraud** — Subject: Quick favour. Body: "Please buy some gift cards and send the gift card codes to me privately."

**Remote-access lure** — Subject: Support check. Body: "Please install AnyDesk so our technician can help."

**Benign comparison** — Subject: Team meeting. Body: "Hello team, here are the project notes. We will meet Thursday at noon for the design review."

Check the indicator list, not just the headline verdict. Indicators and risk scores are heuristics and can produce false positives and false negatives. A low score does not certify an email safe. This phase does **not** perform live domain reputation checks or inspect real attachments.

## Safety and privacy

Your existing application stores scan contents in Supabase and sends truncated email content to Gemini when AI explanation is enabled. Do not scan highly sensitive emails without understanding those data flows. Before public deployment, review authentication fallback behavior, Supabase row-level security, retention, and consent for external intelligence services.
