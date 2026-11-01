import { z } from "zod";

export const analyzeInputSchema = z.object({
  subject: z.string().trim().max(500).default(""),
  sender: z.string().trim().max(320).optional().default(""),
  body: z.string().trim().min(1, "Email body is required").max(60000),
  source: z.enum(["paste", "txt", "eml"]).default("paste"),
  useAi: z.boolean().default(true),
});
export type AnalyzeInput = z.infer<typeof analyzeInputSchema>;

export const idSchema = z.object({ id: z.string().uuid() });

export const historyQuerySchema = z.object({
  search: z.string().trim().max(200).optional().default(""),
  verdict: z.enum(["all", "phishing", "legitimate"]).default("all"),
  limit: z.number().int().min(1).max(200).default(100),
});

export const chatInputSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  scanId: z.string().uuid().nullable().optional().default(null),
});

export const profileUpdateSchema = z.object({
  full_name: z.string().trim().min(1, "Full name is required").max(120),
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(32)
    .regex(/^[a-zA-Z0-9_.-]+$/, "Only letters, numbers, dots, dashes and underscores"),
});

export const settingsUpdateSchema = z.object({
  theme: z.enum(["dark", "light"]),
  notifications_enabled: z.boolean(),
  language: z.string().trim().min(2).max(10),
});

export const urlCheckSchema = z.object({
  input: z.string().trim().min(1, "Enter at least one URL").max(8000),
});

export const passwordSchema = z
  .string()
  .min(8, "At least 8 characters")
  .regex(/[A-Z]/, "At least one uppercase letter")
  .regex(/[a-z]/, "At least one lowercase letter")
  .regex(/[0-9]/, "At least one number")
  .regex(/[^A-Za-z0-9]/, "At least one special character");

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: "Too short" | "Weak" | "Medium" | "Strong" | "Very Strong";
  suggestions: string[];
  percent: number;
}

export function scorePassword(password: string): PasswordStrength {
  const suggestions: string[] = [];
  if (password.length < 8) suggestions.push("Use at least 8 characters");
  if (!/[A-Z]/.test(password)) suggestions.push("Add uppercase letters");
  if (!/[a-z]/.test(password)) suggestions.push("Add lowercase letters");
  if (!/[0-9]/.test(password)) suggestions.push("Add numbers");
  if (!/[^A-Za-z0-9]/.test(password)) suggestions.push("Use special characters");
  if (password.length > 0 && password.length < 14) suggestions.push("Longer passphrases are far harder to crack");
  if (/(.)\1{2,}/.test(password)) suggestions.push("Avoid repeated characters");
  if (/^(password|qwerty|12345|admin|letmein)/i.test(password)) suggestions.push("Avoid common words");

  let points = 0;
  if (password.length >= 8) points++;
  if (password.length >= 12) points++;
  if (password.length >= 16) points++;
  if (/[A-Z]/.test(password)) points++;
  if (/[a-z]/.test(password)) points++;
  if (/[0-9]/.test(password)) points++;
  if (/[^A-Za-z0-9]/.test(password)) points++;
  if (/^(password|qwerty|12345|admin|letmein)/i.test(password)) points -= 3;

  if (password.length === 0) {
    return { score: 0, label: "Too short", suggestions, percent: 0 };
  }
  if (password.length < 8 || points <= 2) {
    return { score: 1, label: "Weak", suggestions, percent: 25 };
  }
  if (points <= 4) return { score: 2, label: "Medium", suggestions, percent: 50 };
  if (points <= 6) return { score: 3, label: "Strong", suggestions, percent: 75 };
  return { score: 4, label: "Very Strong", suggestions, percent: 100 };
}
