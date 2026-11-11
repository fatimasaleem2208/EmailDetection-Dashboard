# EmailDetection OTP and persistent scanner setup

## Supabase dashboard (required)

1. Authentication → Providers → Email: enable **Confirm email**. If it is disabled, signup can create an immediate session; this app refuses to proceed in that case.
2. Authentication → Email Templates → **Confirm signup**: use a six-digit code, for example `Your EmailDetection code: {{ .Token }}`. Do not leave only `{{ .ConfirmationURL }}` if you want a code rather than a link.
3. Authentication → Email Templates → **Magic Link / OTP**: use `Your EmailDetection sign-in code: {{ .Token }}`. This template is used for the second code after Google OAuth.
4. Authentication → Providers → Google: enable Google with actual Google OAuth client credentials. Add your app URL `/auth` to the Supabase **Redirect URLs** allow-list (e.g. `http://localhost:3000/auth` for local development and `https://your-domain.example/auth` for production). Configure the Google console's authorized redirect URI to the exact Supabase callback displayed in the Google provider settings.
5. For reliable delivery in production, configure custom SMTP in Supabase. Respect Supabase email OTP rate limits.

## Updated behavior

- Register → Supabase sends a six-digit code to the entered email → verify in the signup form → navigate to dashboard. No admin email auto-confirm or password-reset shortcut is used.
- Continue with Google → real Google OAuth → return to `/auth` → sign out of OAuth session → send separate email OTP to the verified Google email → enter code → navigate to dashboard. The *second stage* uses Supabase email OTP sign-in and does not create an extra Google identity.
- Ask AI from a scan → the chat opens with a question prefilled using the selected scan's subject, sender, verdict and score. Click Send to receive a Gemini answer; full scan indicators/URLs are still passed by scan ID on the server.
- Email scanner → draft and result persist across page navigation and browser restarts in this browser, until `Remove email and result` is clicked, or the user clears browser storage. This stores email content locally; avoid sharing a browser profile when scanning confidential messages.

## Security notes before production

- The additional Google OTP is a **UI-controlled step**, not formally enforced MFA against someone who already holds a valid Supabase OAuth access token. For mandatory, non-bypassable MFA implement server-enforced step-up authentication with a verified factor and access-control policy.
- Existing app's mock Supabase fallback/wrapping and other authorization paths must be audited before public deployment. The auth middleware now rejects invalid or missing tokens whenever Supabase is configured, rather than silently using a mock user.
- No secret keys are included in the ZIP. Transfer only your existing private `.env` to the project root; do not commit it.
