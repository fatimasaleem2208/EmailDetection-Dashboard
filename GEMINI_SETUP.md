# Gemini AI setup

1. Create an API key at https://aistudio.google.com/apikey.
2. Copy `.env.example` to `.env` in the project root.
3. Set `GEMINI_API_KEY` to your key and leave `GEMINI_MODEL=gemini-3.5-flash` (or change to a model that is available to your key).
4. Restart your dev server: `npm install` then `npm run dev`.
5. Test the AI Assistant with unrelated questions; they should receive question-specific responses.

`GEMINI_API_KEY` is server-only. Never add `VITE_` to its name or commit `.env`.

The application uses Gemini in `src/lib/ai.server.ts` for both assistant conversations and scan explanations. If configuration is absent, chat now returns a configuration error instead of repeating a hardcoded phishing response. Scan explanations can still use the existing heuristic fallback when Gemini is unavailable.
