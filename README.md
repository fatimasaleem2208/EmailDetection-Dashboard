PhishGuard AI

AI-Powered Phishing Detection & Email Security Platform

PhishGuard AI is a full-stack cybersecurity application designed to detect and analyze phishing emails and suspicious URLs using security heuristics, URL forensics, and AI-powered explanations.

The platform provides users with an interactive security dashboard where they can scan emails, analyze URLs, review risk indicators, interact with an AI security assistant, and generate detailed PDF security reports.

---

 Features

Email Phishing Scanner

- Analyze suspicious emails by pasting their content.
- Upload ".txt" / email files for analysis.
- Extract and inspect suspicious URLs.
- Analyze sender and email content for phishing indicators.
- Generate an overall phishing risk score.

Threat Detection

PhishGuard AI evaluates multiple security signals, including:

- Suspicious sender addresses
- Urgency and social-engineering language
- Credential harvesting attempts
- Suspicious URLs
- Domain anomalies
- Payment/invoice fraud indicators
- Potential impersonation attempts
- Other phishing-related patterns

AI Security Assistant

Ask questions about an analyzed email and receive an AI-generated explanation of the detected threats.

Example:

«Why was this email classified as phishing?»

The assistant provides a plain-English explanation to help users understand the security risks.

URL Analysis

Analyze suspicious URLs separately and identify potentially malicious characteristics.

Security Dashboard

The dashboard provides visual security insights, including:

- Risk statistics
- Phishing detection trends
- Scan analytics
- Threat distribution
- Security activity

PDF Security Reports

Generate downloadable reports containing the scan verdict, risk score, indicators, and analysis details.

Authentication

The application includes a user authentication system to protect access to the security dashboard and scanning features.

---

Application Preview

Landing Page

"PhishGuard AI Landing Page" (screenshots/landing-page.png)

Security Dashboard

"PhishGuard AI Dashboard" (screenshots/dashboard.png)

Email Scanner

"Email Scanner" (screenshots/email-scanner.png)

Phishing Detection Result

"Phishing Detection Result" (screenshots/phishing-result.png)

URL Analysis

"URL Analysis" (screenshots/url-analysis.png)

AI Security Assistant

"AI Assistant" (screenshots/ai-assistant.png)

Generated Security Report

"PDF Security Report" (screenshots/security-report.png)

«Tip: Add your actual screenshots to a "screenshots/" folder in the repository and keep these filenames consistent.»

---

 How It Works

User
 │
 ▼
PhishGuard AI
 │
 ├── Email Scanner
 │      │
 │      ├── Email Content Analysis
 │      ├── Sender Analysis
 │      └── URL Extraction
 │
 ├── URL Forensics
 │
 ├── Phishing Detection Engine
 │      │
 │      ├── Security Heuristics
 │      ├── Threat Indicators
 │      └── Risk Scoring
 │
 ├── AI Security Assistant
 │
 └── PDF Report Generator
        │
        ▼
   Security Report

---

 Tech Stack

Frontend

- React
- TypeScript
- Tailwind CSS
- TanStack Router
- TanStack Query
- Lucide Icons

Backend

- TanStack Start
- Server Functions
- TypeScript

Security & Data

- Supabase
- Authentication
- Database-backed scan history
- Server-side API handling

AI

- Groq API
- AI-powered security explanations

Other Technologies

- Zod — input validation
- PDF generation
- Email parsing
- URL analysis
- Git & GitHub

---

Project Structure

src/
├── components/
│   ├── ui/
│   └── ...
│
├── lib/
│   ├── ai.server.ts
│   ├── scans.functions.ts
│   ├── scan-schemas.ts
│   ├── phishing-engine.ts
│   ├── eml-parser.ts
│   └── pdf-report.ts
│
├── routes/
│   ├── _authenticated/
│   │   ├── scanner.tsx
│   │   └── ...
│   └── ...
│
└── ...

---

Getting Started

1. Clone the repository

git clone YOUR_GITHUB_REPOSITORY_URL
cd YOUR_PROJECT_FOLDER

2. Install dependencies

npm install

3. Configure environment variables

Create a ".env" file in the project root:

SUPABASE_URL=your_supabase_url
SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
SUPABASE_PROJECT_ID=your_supabase_project_id
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
VITE_SUPABASE_PROJECT_ID=your_supabase_project_id
GROQ_API_KEY=your_groq_api_key


4. Start the development server

npm run dev

Then open the local URL provided by Vite/TanStack Start.

---

Security Considerations

PhishGuard AI follows several security practices:

- API keys are stored in environment variables.
- Sensitive server-side operations are kept outside the client bundle.
- Input validation is implemented using Zod.
- Authentication protects application access.
- Secrets are excluded from version control using ".gitignore".

Important: This project is intended as a cybersecurity learning and portfolio project. Detection results should not be treated as a replacement for professional security analysis.

---

Project Goals

PhishGuard AI was built to explore the intersection of:

- Cybersecurity
- Artificial Intelligence
- Web application development
- Threat detection
- Security automation
- Explainable security analysis

The goal is to make phishing analysis more understandable by combining automated detection with human-readable explanations.

---

Future Improvements

Potential future enhancements include:

- [ ] Advanced machine-learning phishing classification
- [ ] Real-time threat intelligence integration
- [ ] Domain reputation checking
- [ ] DNS and WHOIS analysis
- [ ] Attachment malware analysis
- [ ] Browser extension integration
- [ ] Expanded email header forensics
- [ ] Real-time security monitoring
- [ ] More detailed threat intelligence reports

---

Project Status

Status: Active / Portfolio Project

PhishGuard AI currently supports authentication, email analysis, phishing detection, URL analysis, AI-assisted explanations, dashboard analytics, and PDF security reports.

---

Author

Fatima Saleem

BS Cyber Security Student
Interested in Cybersecurity • AI • Cloud Security

---

Support

If you find this project useful or interesting, consider giving the repository a "Star" on GitHub.
