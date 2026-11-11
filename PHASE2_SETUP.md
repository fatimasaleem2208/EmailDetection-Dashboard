# EmailDetection — Phase 2 URL and Domain Reputation Checks

This patch is based on the latest OTP/Scanner project with Phase 1 email-analysis changes overlaid. It changes only the URL Analysis page and adds a new server-side helper. It does not modify Gemini, Supabase configuration, the database or authentication code.

## Copy into your existing project

1. **CREATE** `src/lib/url-reputation.functions.ts` (a new file in the existing `src/lib` folder).
2. **REPLACE** `src/routes/_authenticated/url-analysis.tsx` with the provided version.
3. Keep `.env`, all Phase 1 files, Supabase and OTP code unchanged.
4. Start with `npm run dev`, log in and open URL Analysis.

## How to test

Paste `https://www.wikipedia.org`, then click **Check live reputation**. You should see a DNS result. If the API key below is absent, reputation reads `not-configured`, **not** `safe`.

Paste `https://totally-made-up-phish-check-2026.example` to check that reserved example domains are intentionally skipped.

Existing instant structural scoring continues to work without configuration. The new button performs on-demand server-side DNS resolution (public A/AAAA records, no browsing the submitted website). Checks are limited to the first 10 URLs.

## Optional: Google Safe Browsing

To perform actual URL threat-list reputation checks, enable the appropriate Safe Browsing API for a Google Cloud project (subject to Google's eligibility, pricing and commercial-use terms) and create a restricted **server-side** key. Add to `.env`:

`GOOGLE_SAFE_BROWSING_API_KEY=your_server_side_api_key`

Restart the dev server. Do NOT prefix this variable with `VITE_`. The Google Safe Browsing v4 threatMatches endpoint is used; verify that it is available and permitted for your use case. Google may receive submitted URLs. Users should not submit private URLs without understanding this. Do not use a Gemini API key for this service unless the key is authorized for it.

## Limitations and safety

- DNS resolution says whether public A or AAAA records are found; it is not an assessment of trustworthiness.
- No URL redirects are followed and no remote web pages are visited. No domain-age/WHOIS checks are provided yet.
- A URL that is **not flagged** can still be malicious. A failed check is **inconclusive**.
- The old structural risk score is separate from the live reputation result. Neither is a calibrated probability.
- This patch has not been tested with your live Google/Supabase credentials. Live DNS and Safe Browsing checks depend on runtime access and API credentials.
- For a production launch, remove development auth bypasses, enforce server-side access control and rate limiting, and verify provider licensing.
