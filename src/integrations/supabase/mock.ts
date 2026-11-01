import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "./types";

export const MOCK_USER_ID = "00000000-0000-0000-0000-000000000001";

const LEGACY_DEAD_PROJECT_REF = "usifkdzrxyzrklyvrgxq";
const LEGACY_DEAD_KEY = "sb_publishable_JizTEztFNFGRgZVDCYKQxg_J7H_pU8V";

export function normalizeSupabaseUrl(raw?: string): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (trimmed.includes(LEGACY_DEAD_PROJECT_REF)) return undefined;
  try {
    const parsed = new URL(trimmed);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return trimmed
      .replace(/\/+(rest|auth|storage|functions)\/v\d+\/?.*$/i, "")
      .replace(/\/+$/, "");
  }
}

export function normalizeSupabaseKey(raw?: string): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === LEGACY_DEAD_KEY) return undefined;
  return trimmed;
}

export function resolveSupabaseConfig(): {
  url: string | undefined;
  publishableKey: string | undefined;
  serviceRoleKey: string | undefined;
} {
  const viteUrl =
    typeof import.meta !== "undefined" && import.meta.env
      ? (import.meta.env["VITE_SUPABASE_URL"] as string | undefined)
      : undefined;
  const viteKey =
    typeof import.meta !== "undefined" && import.meta.env
      ? (import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined)
      : undefined;

  const procViteUrl = typeof process !== "undefined" ? process.env["VITE_SUPABASE_URL"] : undefined;
  const procUrl = typeof process !== "undefined" ? process.env["SUPABASE_URL"] : undefined;
  const procViteKey =
    typeof process !== "undefined" ? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] : undefined;
  const procKey =
    typeof process !== "undefined" ? process.env["SUPABASE_PUBLISHABLE_KEY"] : undefined;
  const serviceRoleKey =
    typeof process !== "undefined"
      ? normalizeSupabaseKey(process.env["SUPABASE_SERVICE_ROLE_KEY"])
      : undefined;

  const url =
    normalizeSupabaseUrl(viteUrl) ??
    normalizeSupabaseUrl(procViteUrl) ??
    normalizeSupabaseUrl(procUrl);

  const publishableKey =
    normalizeSupabaseKey(viteKey) ??
    normalizeSupabaseKey(procViteKey) ??
    normalizeSupabaseKey(procKey);

  return { url, publishableKey, serviceRoleKey };
}

const DEFAULT_USER = {
  id: MOCK_USER_ID,
  aud: "authenticated",
  role: "authenticated",
  email: "analyst@phishguard.ai",
  email_confirmed_at: new Date().toISOString(),
  user_metadata: { full_name: "Alex Mercer" },
  app_metadata: { provider: "email", providers: ["email"] },
  created_at: new Date(Date.now() - 86400000 * 14).toISOString(),
};

export const DEFAULT_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJlbWFpbCI6ImFuYWx5c3RAcGhpc2hndWFyZC5haSIsInJvbGUiOiJhdXRoZW50aWNhdGVkIn0.mocksignature";

type AuthListener = (event: string, session: unknown) => void;
const authListeners = new Set<AuthListener>();

const STORAGE_KEY = "phishguard_mock_session";

function getStoredSession() {
  if (typeof window === "undefined") {
    return {
      access_token: DEFAULT_TOKEN,
      refresh_token: "mock-refresh-token",
      expires_in: 3600,
      token_type: "bearer",
      user: DEFAULT_USER,
    };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "signed_out") return null;
    if (raw) {
      return JSON.parse(raw) as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
        token_type: string;
        user: typeof DEFAULT_USER;
      };
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

function setStoredSession(
  session: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
    user: typeof DEFAULT_USER;
  } | null,
) {
  if (typeof window !== "undefined") {
    try {
      if (session === null) {
        window.localStorage.setItem(STORAGE_KEY, "signed_out");
      } else {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      }
    } catch {
      // ignore
    }
  }
}

function notifyAuth(event: string, session: unknown) {
  for (const listener of authListeners) {
    try {
      listener(event, session);
    } catch {
      // ignore listener errors
    }
  }
}

type TableMap = {
  profiles: Array<Tables<"profiles">>;
  scans: Array<Tables<"scans">>;
  activity_logs: Array<Tables<"activity_logs">>;
  chat_messages: Array<Tables<"chat_messages">>;
  user_roles: Array<Tables<"user_roles">>;
};

const now = Date.now();

const memoryStore: TableMap = {
  profiles: [],
  user_roles: [],
  scans: [],
  activity_logs: [],
  chat_messages: [],
};

const seededUsers = new Set<string>();

export function ensureUserSeeded(userInfo: {
  id: string;
  email?: string | undefined;
  full_name?: string | undefined;
}) {
  const userId = userInfo.id || MOCK_USER_ID;
  const email = userInfo.email || "analyst@phishguard.ai";
  const fullName =
    userInfo.full_name ||
    (email.includes("@") ? (email.split("@")[0] ?? "Analyst") : "Alex Mercer");

  const existingProfile = memoryStore.profiles.find((p) => p.id === userId);
  if (existingProfile) {
    if (userInfo.email && !existingProfile.email) existingProfile.email = userInfo.email;
    if (userInfo.full_name && !existingProfile.full_name) {
      existingProfile.full_name = userInfo.full_name;
    }
    return;
  }

  if (seededUsers.has(userId)) return;
  seededUsers.add(userId);

  const baseUsername = (email.split("@")[0] ?? "analyst")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 20);

  memoryStore.profiles.push({
    id: userId,
    email,
    full_name: fullName,
    username: `${baseUsername || "analyst"}_${userId.slice(0, 4)}`,
    avatar_url: null,
    language: "en",
    notifications_enabled: true,
    theme: "dark",
    created_at: new Date(now - 86400000 * 7).toISOString(),
    updated_at: new Date(now).toISOString(),
  });

  memoryStore.user_roles.push({
    id: `role-${userId.slice(0, 8)}`,
    user_id: userId,
    role: "analyst",
    created_at: new Date(now - 86400000 * 7).toISOString(),
  });

  memoryStore.scans.push(
    {
      id: `scan-demo-1-${userId.slice(0, 6)}`,
      user_id: userId,
      subject: "URGENT: Your Microsoft 365 password expires in 2 hours",
      sender: "Microsoft Security <security-update@micros0ft-auth-portal.xyz>",
      body: "Dear User,\n\nYour corporate Microsoft 365 password is set to expire in 2 hours. Failure to validate your credentials immediately will result in account suspension.\n\nKeep same password: http://198.51.100.42/login/microsoft-verify\n\nIT Helpdesk",
      verdict: "phishing",
      risk_score: 92,
      confidence: 95,
      threat_level: "critical",
      indicators: [
        {
          id: "urgency",
          title: "Artificial urgency & deadline pressure",
          category: "social",
          severity: "high",
          weight: 18,
          description: "Pressures the recipient to act before thinking.",
          evidence: "expires in 2 hours",
        },
        {
          id: "brand_spoof",
          title: "Brand lookalike sender domain",
          category: "sender",
          severity: "critical",
          weight: 28,
          description:
            "Sender domain uses digit substitution (micros0ft) and high-risk TLD (.xyz).",
          evidence: "micros0ft-auth-portal.xyz",
        },
        {
          id: "ip_url",
          title: "Raw IP address URL",
          category: "url",
          severity: "critical",
          weight: 26,
          description:
            "Link points directly to an IPv4 address instead of a verified corporate domain.",
          evidence: "http://198.51.100.42/login/microsoft-verify",
        },
      ],
      urls: [
        {
          url: "http://198.51.100.42/login/microsoft-verify",
          host: "198.51.100.42",
          tld: "42",
          riskScore: 94,
          status: "malicious",
          reasons: [
            "Uses a raw IPv4 address instead of a domain name.",
            "Unencrypted HTTP protocol on a credential login path.",
            "References Microsoft brand on a non-Microsoft host.",
          ],
          breakdown: {
            ipHost: true,
            shortener: false,
            suspiciousTld: false,
            punycode: false,
            atSymbol: false,
            excessiveSubdomains: false,
            longUrl: false,
            brandImpersonation: "Microsoft",
            unencryptedHttp: true,
            redirectParam: false,
          },
        },
      ],
      headers: {
        spf: "fail",
        dkim: "none",
        dmarc: "fail",
        replyToMismatch: false,
        displayNameSpoof: true,
        notes: [
          "Display name claims Microsoft while sender domain is micros0ft-auth-portal.xyz.",
        ],
      },
      iocs: {
        urls: ["http://198.51.100.42/login/microsoft-verify"],
        domains: ["micros0ft-auth-portal.xyz"],
        ips: ["198.51.100.42"],
        emails: ["security-update@micros0ft-auth-portal.xyz"],
      },
      recommendations: [
        "Do not click the link or enter your Microsoft 365 credentials.",
        "Block micros0ft-auth-portal.xyz and 198.51.100.42 at the secure email gateway.",
        "Report the message to the SOC phishing triage queue.",
      ],
      click_impact: {
        headline: "Corporate SSO credential theft & session hijacking",
        stages: [
          "Browser opens a cloned Microsoft 365 login portal hosted on 198.51.100.42.",
          "Entered email, password, and MFA token are relayed to an attacker-controlled proxy.",
          "Attacker establishes persistent mailbox access and sets inbox forwarding rules.",
        ],
        likelyLoss: "Full compromise of corporate email, OneDrive files, and connected SSO apps.",
      },
      ai_explanation:
        "This message is a high-confidence credential harvesting attack impersonating Microsoft 365. It combines artificial urgency ('expires in 2 hours') with a lookalike sender domain ('micros0ft-auth-portal.xyz') that substitutes a zero for the letter 'o'. Most critically, the embedded verification link routes over unencrypted HTTP to a raw IP address (198.51.100.42) rather than an official microsoft.com domain. Do not click the link; quarantine the email and block the sender domain immediately.",
      source: "manual",
      created_at: new Date(now - 3600000 * 5).toISOString(),
    },
    {
      id: `scan-demo-2-${userId.slice(0, 6)}`,
      user_id: userId,
      subject: "Q3 Engineering Architecture Review Notes",
      sender: "Sarah Jenkins <s.jenkins@company.com>",
      body: "Hi team,\n\nThanks for joining the Q3 architecture review earlier today. I have uploaded the meeting notes and system diagrams to our internal workspace.\n\nLet me know if you have any edits before Friday.\n\nBest,\nSarah",
      verdict: "legitimate",
      risk_score: 6,
      confidence: 94,
      threat_level: "low",
      indicators: [],
      urls: [],
      headers: {
        spf: "pass",
        dkim: "pass",
        dmarc: "pass",
        replyToMismatch: false,
        displayNameSpoof: false,
        notes: ["No header anomalies detected."],
      },
      iocs: {
        urls: [],
        domains: ["company.com"],
        ips: [],
        emails: ["s.jenkins@company.com"],
      },
      recommendations: ["No action needed. Continue standard vigilance."],
      click_impact: {
        headline: "Minimal risk detected",
        stages: ["Message contains no suspicious links or credential requests."],
        likelyLoss: "None expected.",
      },
      ai_explanation:
        "No known phishing techniques were detected in this message. The sender address aligns with internal correspondence, there are no embedded external links or urgent credential prompts, and all heuristic checks scored within safe thresholds.",
      source: "manual",
      created_at: new Date(now - 3600000 * 2).toISOString(),
    },
  );

  memoryStore.activity_logs.push(
    {
      id: `log-demo-1-${userId.slice(0, 6)}`,
      user_id: userId,
      action: "email_scanned",
      detail: 'Phishing — "URGENT: Your Microsoft 365 password expires in 2 hours" (risk 92)',
      severity: "critical",
      created_at: new Date(now - 3600000 * 5).toISOString(),
    },
    {
      id: `log-demo-2-${userId.slice(0, 6)}`,
      user_id: userId,
      action: "email_scanned",
      detail: 'Legitimate — "Q3 Engineering Architecture Review Notes" (risk 6)',
      severity: "info",
      created_at: new Date(now - 3600000 * 2).toISOString(),
    },
  );

  memoryStore.chat_messages.push({
    id: `chat-demo-1-${userId.slice(0, 6)}`,
    user_id: userId,
    role: "assistant",
    content:
      "Welcome to the **PhishGuard AI SOC Assistant**. Ask me about any scanned email, suspicious URLs, SPF/DKIM/DMARC authentication failures, or incident response playbooks.",
    created_at: new Date(now - 3600000 * 6).toISOString(),
  });
}

// Seed default mock user immediately
ensureUserSeeded({ id: MOCK_USER_ID, email: DEFAULT_USER.email, full_name: "Alex Mercer" });

export class MockQueryBuilder {
  private table: keyof TableMap;
  private operation: "select" | "insert" | "update" | "delete" = "select";
  private headOnly = false;
  private wantCount = false;
  private filters: Array<(row: Record<string, unknown>) => boolean> = [];
  private orderField: string | null = null;
  private orderAsc = true;
  private limitCount: number | null = null;
  private singleMode: "none" | "single" | "maybeSingle" = "none";
  private payload: unknown = null;

  constructor(table: keyof TableMap) {
    this.table = table;
  }

  select(_columns?: string, opts?: { count?: string; head?: boolean }) {
    if (this.operation === "select") {
      this.operation = "select";
    }
    if (opts?.head) this.headOnly = true;
    if (opts?.count) this.wantCount = true;
    return this;
  }

  insert(values: unknown) {
    this.operation = "insert";
    this.payload = values;
    return this;
  }

  update(values: unknown) {
    this.operation = "update";
    this.payload = values;
    return this;
  }

  delete() {
    this.operation = "delete";
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  ilike(column: string, pattern: string) {
    const clean = pattern.replace(/%/g, "").toLowerCase();
    this.filters.push((row) =>
      String(row[column] ?? "")
        .toLowerCase()
        .includes(clean),
    );
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }) {
    this.orderField = column;
    this.orderAsc = opts?.ascending ?? true;
    return this;
  }

  limit(n: number) {
    this.limitCount = n;
    return this;
  }

  single() {
    this.singleMode = "single";
    return this;
  }

  maybeSingle() {
    this.singleMode = "maybeSingle";
    return this;
  }

  execute(): { data: unknown; error: null; count?: number } {
    const list = (memoryStore[this.table] ?? []) as unknown as Array<Record<string, unknown>>;

    if (this.operation === "insert") {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload];
      const inserted: Array<Record<string, unknown>> = [];
      const baseTime = Date.now();
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const record: Record<string, unknown> = {
          id: `${this.table}-${baseTime + i}-${Math.random().toString(36).slice(2, 8)}`,
          created_at: new Date(baseTime + i).toISOString(),
          ...(item as Record<string, unknown>),
        };
        list.push(record);
        inserted.push(record);
      }
      const data =
        this.singleMode !== "none"
          ? (inserted[0] ?? null)
          : Array.isArray(this.payload)
            ? inserted
            : inserted;
      return { data, error: null };
    }

    if (this.operation === "update") {
      const patch = (this.payload ?? {}) as Record<string, unknown>;
      const updated: Array<Record<string, unknown>> = [];
      for (const row of list) {
        if (this.filters.every((fn) => fn(row))) {
          Object.assign(row, patch, { updated_at: new Date().toISOString() });
          updated.push(row);
        }
      }
      return {
        data: this.singleMode !== "none" ? (updated[0] ?? null) : updated,
        error: null,
      };
    }

    if (this.operation === "delete") {
      for (let i = list.length - 1; i >= 0; i--) {
        const row = list[i];
        if (row && this.filters.every((fn) => fn(row))) {
          list.splice(i, 1);
        }
      }
      return { data: null, error: null };
    }

    // select
    let matched = list.filter((row) => this.filters.every((fn) => fn(row)));
    const totalCount = matched.length;

    if (this.orderField) {
      const field = this.orderField;
      const dir = this.orderAsc ? 1 : -1;
      matched = [...matched].sort((a, b) => {
        const va = String(a[field] ?? "");
        const vb = String(b[field] ?? "");
        return va < vb ? -1 * dir : va > vb ? 1 * dir : 0;
      });
    }

    if (this.limitCount !== null) {
      matched = matched.slice(0, this.limitCount);
    }

    if (this.headOnly) {
      return { data: null, error: null, ...(this.wantCount ? { count: totalCount } : {}) };
    }

    if (this.singleMode !== "none") {
      return { data: matched[0] ?? null, error: null };
    }

    return {
      data: matched,
      error: null,
      ...(this.wantCount ? { count: totalCount } : {}),
    };
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: unknown; error: null; count?: number }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

class FallbackQueryBuilder {
  private realQuery: Record<string, (...args: unknown[]) => unknown>;
  private mockQuery: MockQueryBuilder;

  constructor(realClient: SupabaseClient<Database>, table: keyof TableMap) {
    this.realQuery = (realClient.from as unknown as (t: string) => Record<string, (...args: unknown[]) => unknown>)(
      table,
    );
    this.mockQuery = new MockQueryBuilder(table);
  }

  select(columns?: string, opts?: { count?: string; head?: boolean }) {
    if (typeof this.realQuery["select"] === "function") {
      this.realQuery = this.realQuery["select"](columns, opts) as Record<
        string,
        (...args: unknown[]) => unknown
      >;
    }
    this.mockQuery.select(columns, opts);
    return this;
  }

  insert(values: unknown) {
    if (typeof this.realQuery["insert"] === "function") {
      this.realQuery = this.realQuery["insert"](values) as Record<
        string,
        (...args: unknown[]) => unknown
      >;
    }
    this.mockQuery.insert(values);
    return this;
  }

  update(values: unknown) {
    if (typeof this.realQuery["update"] === "function") {
      this.realQuery = this.realQuery["update"](values) as Record<
        string,
        (...args: unknown[]) => unknown
      >;
    }
    this.mockQuery.update(values);
    return this;
  }

  delete() {
    if (typeof this.realQuery["delete"] === "function") {
      this.realQuery = this.realQuery["delete"]() as Record<
        string,
        (...args: unknown[]) => unknown
      >;
    }
    this.mockQuery.delete();
    return this;
  }

  eq(column: string, value: unknown) {
    if (typeof this.realQuery["eq"] === "function") {
      this.realQuery = this.realQuery["eq"](column, value) as Record<
        string,
        (...args: unknown[]) => unknown
      >;
    }
    this.mockQuery.eq(column, value);
    return this;
  }

  ilike(column: string, pattern: string) {
    if (typeof this.realQuery["ilike"] === "function") {
      this.realQuery = this.realQuery["ilike"](column, pattern) as Record<
        string,
        (...args: unknown[]) => unknown
      >;
    }
    this.mockQuery.ilike(column, pattern);
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }) {
    if (typeof this.realQuery["order"] === "function") {
      this.realQuery = this.realQuery["order"](column, opts) as Record<
        string,
        (...args: unknown[]) => unknown
      >;
    }
    this.mockQuery.order(column, opts);
    return this;
  }

  limit(n: number) {
    if (typeof this.realQuery["limit"] === "function") {
      this.realQuery = this.realQuery["limit"](n) as Record<
        string,
        (...args: unknown[]) => unknown
      >;
    }
    this.mockQuery.limit(n);
    return this;
  }

  single() {
    if (typeof this.realQuery["single"] === "function") {
      this.realQuery = this.realQuery["single"]() as Record<
        string,
        (...args: unknown[]) => unknown
      >;
    }
    this.mockQuery.single();
    return this;
  }

  maybeSingle() {
    if (typeof this.realQuery["maybeSingle"] === "function") {
      this.realQuery = this.realQuery["maybeSingle"]() as Record<
        string,
        (...args: unknown[]) => unknown
      >;
    }
    this.mockQuery.maybeSingle();
    return this;
  }

  private async runWithFallback(): Promise<{ data: unknown; error: unknown; count?: number }> {
    try {
      const res = (await (this.realQuery as unknown as Promise<{
        data: unknown;
        error: { code?: string; message?: string } | null;
        count?: number;
      }>)) ?? { data: null, error: null };
      if (res.error) {
        // Keep unique username constraint errors if table exists, otherwise fallback to memoryStore
        if (res.error.code === "23505") {
          return res;
        }
        return this.mockQuery.execute();
      }
      return res;
    } catch {
      return this.mockQuery.execute();
    }
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: unknown; error: unknown; count?: number }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.runWithFallback().then(onfulfilled, onrejected);
  }
}

export function wrapSupabaseWithFallback(
  realClient: SupabaseClient<Database>,
  userInfo?: { id: string; email?: string | undefined; full_name?: string | undefined },
): SupabaseClient<Database> {
  if (userInfo?.id) {
    ensureUserSeeded(userInfo);
  }
  return new Proxy(realClient, {
    get(target, prop, receiver) {
      if (prop === "from") {
        return (table: keyof TableMap) => new FallbackQueryBuilder(target, table);
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

export function createMockSupabaseClient(): SupabaseClient<Database> {
  const client = {
    from: (table: keyof TableMap) => new MockQueryBuilder(table),
    auth: {
      getSession: async () => {
        const session = getStoredSession();
        return { data: { session }, error: null };
      },
      getUser: async () => {
        const session = getStoredSession();
        return {
          data: { user: session ? session.user : null },
          error: null,
        };
      },
      getClaims: async (_token?: string) => {
        return {
          data: {
            claims: {
              sub: MOCK_USER_ID,
              email: DEFAULT_USER.email,
              role: "authenticated",
            },
          },
          error: null,
        };
      },
      onAuthStateChange: (callback: AuthListener) => {
        authListeners.add(callback);
        const session = getStoredSession();
        if (session) {
          setTimeout(() => callback("INITIAL_SESSION", session), 0);
        }
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                authListeners.delete(callback);
              },
            },
          },
        };
      },
      signInWithPassword: async ({ email }: { email: string; password?: string }) => {
        const user = {
          ...DEFAULT_USER,
          email: email || DEFAULT_USER.email,
        };
        const session = {
          access_token: DEFAULT_TOKEN,
          refresh_token: "mock-refresh-token",
          expires_in: 3600,
          token_type: "bearer",
          user,
        };
        ensureUserSeeded({ id: user.id, email: user.email });
        const profile = memoryStore.profiles.find((p) => p.id === user.id);
        if (profile && email) {
          profile.email = email;
        }
        setStoredSession(session);
        notifyAuth("SIGNED_IN", session);
        return { data: { user, session }, error: null };
      },
      signUp: async ({
        email,
        options,
      }: {
        email: string;
        password?: string;
        options?: { data?: { full_name?: string } };
      }) => {
        const fullName = options?.data?.full_name || "Alex Mercer";
        const user = {
          ...DEFAULT_USER,
          email: email || DEFAULT_USER.email,
          user_metadata: { full_name: fullName },
        };
        const session = {
          access_token: DEFAULT_TOKEN,
          refresh_token: "mock-refresh-token",
          expires_in: 3600,
          token_type: "bearer",
          user,
        };
        ensureUserSeeded({ id: user.id, email: user.email, full_name: fullName });
        const profile = memoryStore.profiles.find((p) => p.id === user.id);
        if (profile) {
          profile.email = user.email;
          profile.full_name = fullName;
        }
        setStoredSession(session);
        notifyAuth("SIGNED_IN", session);
        return { data: { user, session }, error: null };
      },
      resetPasswordForEmail: async () => {
        return { data: {}, error: null };
      },
      updateUser: async () => {
        const session = getStoredSession();
        return { data: { user: session?.user ?? DEFAULT_USER }, error: null };
      },
      setSession: async () => {
        const session = {
          access_token: DEFAULT_TOKEN,
          refresh_token: "mock-refresh-token",
          expires_in: 3600,
          token_type: "bearer",
          user: DEFAULT_USER,
        };
        setStoredSession(session);
        notifyAuth("SIGNED_IN", session);
        return { data: { user: DEFAULT_USER, session }, error: null };
      },
      signOut: async () => {
        setStoredSession(null);
        notifyAuth("SIGNED_OUT", null);
        return { error: null };
      },
      admin: {
        deleteUser: async () => {
          setStoredSession(null);
          return { data: { user: null }, error: null };
        },
        createUser: async (attrs: {
          email?: string;
          user_metadata?: { full_name?: string };
        }) => {
          const user = {
            ...DEFAULT_USER,
            email: attrs.email || DEFAULT_USER.email,
            user_metadata: {
              full_name: attrs.user_metadata?.full_name || "Alex Mercer",
            },
          };
          ensureUserSeeded({
            id: user.id,
            email: user.email,
            full_name: user.user_metadata.full_name,
          });
          return { data: { user }, error: null };
        },
        listUsers: async () => {
          return { data: { users: [DEFAULT_USER] }, error: null };
        },
        updateUserById: async () => {
          return { data: { user: DEFAULT_USER }, error: null };
        },
      },
    },
  };

  return client as unknown as SupabaseClient<Database>;
}
