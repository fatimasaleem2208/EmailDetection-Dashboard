# EmailDetection

### AI-powered phishing detection and email security analysis

EmailDetection is a full-stack cybersecurity application for investigating suspicious emails, URLs, email headers, and attachments. It combines explainable, rule-based checks with optional threat-intelligence lookups and Google Gemini-powered guidance.

**Project status:** Actively developed. Local development and production builds have been tested; production deployment and security review are ongoing.

> **Important:** A low risk score or an absence of threat-intelligence detections does **not** establish that an email, file, or website is safe. EmailDetection is a decision-support tool, not a replacement for enterprise email security or antivirus software.

## Features

| Module | Capabilities |
| --- | --- |
| **Email Scanner** | Paste or upload email text; detect urgent requests, impersonation, suspicious links, credential theft, invoice and payment scams; view an explainable risk score. |
| **URL Analysis** | Identify suspicious URL structure, shortened links, punycode, unusual domains and impersonation signals. Optional DNS, reputation and domain-intelligence checks. |
| **Email Header Analyzer** | Inspect pasted headers for reported SPF, DKIM and DMARC results, sender/Reply-To differences, and routing clues. |
| **Attachment Scanner** | Drag and drop files for local static checks, risky extensions, misleading filenames, basic file signatures, ZIP-entry filenames and SHA-256 hashes. |
| **Ask AI** | Send analysis findings and a prefilled question to a Google Gemini-powered assistant for plain-language explanations. |
| **Risk Dashboard** | Review heuristic risk scores, reasons, warning categories and supporting findings. |
| **Scan History & Activity** | View and revisit saved analyses; store scan records in Supabase and review security activity. |
| **Authentication** | Email verification with OTP, Google sign-in via Supabase OAuth and authenticated application pages. |
| **Reports** | Export security scan information where supported by the application. |
| **Chrome Extension** | Separately installed extension to inspect the active tab's URL and open it in EmailDetection. |

### Threat intelligence

When configured, the application can query external reputation providers, including **VirusTotal** for existing domain and file-hash reports and **Google Safe Browsing** for URL threat matches. An unknown, unavailable, or unconfigured lookup is not treated as a clean verdict.

Attachment checks are **static analysis only**: they do not execute files, unpack or run malware, or replace antivirus scanning. The local attachment inspection flow does not upload file bytes for scanning. Optional reputation queries may share a hash or domain with a provider when explicitly requested.

## Technology stack

- **Frontend:** React 19, TypeScript, Tailwind CSS, TanStack Router, TanStack Query
- **Full-stack framework:** TanStack Start, Vite, server functions
- **Authentication & database:** Supabase Auth, PostgreSQL, Row Level Security (RLS)
- **AI explanations:** Google Gemini API
- **Threat intelligence:** Optional VirusTotal and Google Safe Browsing integrations
- **Reporting & UI:** jsPDF, Recharts, Lucide icons, Radix-based components
- **Browser extension:** Chrome extension (separate installation)

## Getting started

### Prerequisites

- A supported Node.js version for the project's Vite/TanStack dependencies
- npm
- An existing Supabase project
- A Google Gemini API key

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
cd YOUR_REPOSITORY
npm install
```

### 2. Configure environment variables

Create `.env` in the project root (next to `package.json`). Use actual project credentials **only in your local environment or hosting provider's secret settings**.

```dotenv
# Google Gemini — server only
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=your_supported_gemini_model_id

# Supabase — public client configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key

# Supabase — server configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_server_only_secret_key

# Optional server-side reputation providers
VIRUSTOTAL_API_KEY=your_optional_virustotal_key
GOOGLE_SAFE_BROWSING_API_KEY=your_optional_safe_browsing_key
```

**Never commit `.env`**, or expose `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, or external threat-intelligence keys in browser-side code. A `VITE_` prefix exposes the value to the client build and must only be used for publishable configuration.

The exact Gemini model ID must be one available to your API account. Some API integrations are optional, so leave their keys unset if not in use.

### 3. Configure Supabase

1. Enable email-based authentication and, if required, Google OAuth under **Authentication → Sign In / Providers**.
2. Configure **Authentication → URL Configuration** for the local app and the eventual deployed origin.
3. Configure an SMTP provider and email templates for OTP delivery. To show the actual token, the relevant Supabase email template should include `{{ .Token }}`.
4. Ensure required database migrations have been applied and the scan-history tables exist.
5. Confirm RLS policies restrict each user to their own saved scans.

Do **not** rerun migrations against an established production database without checking whether they have already been applied.

### 4. Start development

```bash
npm run dev
```

Open **http://localhost:3000**.

### 5. Verify production build

```bash
npm run build
```

A successful build checks compilation; it does **not** prove the deployment is secure or fully functional.

## How it works

```text
User
 ├── Email Scanner ─────────────┐
 ├── URL Analysis ──────────────┤
 ├── Email Header Analyzer ─────┼── Findings + heuristic risk assessment
 └── Attachment Scanner ────────┘                 │
                                                ├── Explain with Gemini (Ask AI)
                                                ├── Optional reputation lookups
                                                └── Saved history / activity (Supabase)
```

Risk scores are **heuristic indicators**, not verified probabilities of maliciousness. Email-header results reflect the pasted header contents and should not be mistaken for independently authenticated server-side checks.

## Project layout

```text
src/
  components/             # Shared UI, app shell, analysis result views
  integrations/supabase/  # Supabase clients and authentication integration
  lib/                    # Detection engines, server functions, AI integrations
  routes/
    _authenticated/
      scanner.tsx          # Email scanner
      url-analysis.tsx     # URL and domain analysis
      header-analysis.tsx  # Header analyzer
      attachment-analysis.tsx # Attachment scanner
      assistant.tsx        # Gemini assistant
      history.tsx          # Saved scan history
      activity.tsx         # Activity records
supabase/
  migrations/             # Database migrations
public/                   # Static assets
package.json
vite.config.ts
```

The Chrome extension, if installed, is maintained as a separate browser package and may not be included in the website source tree.

## Security and privacy

- Treat all submitted emails, links and attachments as untrusted input.
- Run AI and reputation API requests from the server; never embed private API keys in client code.
- Verify authentication **and authorization** for every protected server function and database operation.
- Maintain and test Supabase RLS on every user-owned table.
- Avoid storing sensitive email content longer than necessary; provide clear deletion controls.
- Obtain appropriate consent before sharing URLs, domains or file hashes with external reputation providers.
- Remove development/mock authentication and database fallback paths before public launch.
- Apply rate limits, abuse controls and request-size limits in production.

**Google login note:** OAuth sign-in and an additional email OTP challenge are separate controls. An additional post-Google OTP must be enforced server-side before it can be regarded as mandatory MFA.

**Provider usage note:** VirusTotal's public API has usage and commercial restrictions. Confirm licensing, quotas and provider terms before commercial deployment.

## Deployment

The application is intended for deployment on a host that supports **TanStack Start server-side rendering and server functions**. Validate the Nitro/server target for the chosen provider before deploying.

For a production release:

1. Remove mock fallbacks and verify authorization and Supabase RLS.
2. Build and test the production server target.
3. Configure private environment variables in the hosting dashboard.
4. Deploy to an HTTPS URL.
5. Update Supabase allowed redirect URLs and Google OAuth configuration as needed.
6. Test OTP, OAuth, scanning, AI, persistence and delete flows on the live site.
7. Point the Chrome extension at the deployed URL.

## Current limitations

- Detection is advisory, not a guarantee of safety.
- Static attachment inspection does not replace sandboxing or antivirus engines.
- External reputation services require appropriate keys and may be unavailable or rate-limited.
- Browser-extension inspection is limited to URL-level analysis; it does not read page content or automatically scan browsing history.
- Public deployment should happen only after end-to-end authentication, authorization and security review.

## Disclaimer

EmailDetection is an educational and cybersecurity analysis project. Always verify suspicious messages through official channels and do not open untrusted links or attachments solely because a scanner reports a low risk score.
