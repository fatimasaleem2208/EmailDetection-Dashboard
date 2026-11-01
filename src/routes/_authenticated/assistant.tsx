import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Bot, Loader2, Send, Sparkles, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { clearChatHistory, getChatHistory, sendChatMessage } from "@/lib/chat.functions";
import { getScan } from "@/lib/scans.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/assistant")({
  validateSearch: z.object({ scanId: z.string().uuid().optional() }),
  head: () => ({
    meta: [
      { title: "AI Cybersecurity Assistant — PhishGuard AI" },
      {
        name: "description",
        content:
          "Ask an AI security analyst about phishing tactics, suspicious emails, incident response and safe browsing habits.",
      },
      { property: "og:title", content: "AI Cybersecurity Assistant — PhishGuard AI" },
      {
        property: "og:description",
        content: "An always-on AI analyst for phishing questions and incident guidance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AssistantPage,
});

const PROMPTS = [
  "How do I spot a spoofed sender address?",
  "What should I do after clicking a phishing link?",
  "Explain business email compromise in simple terms.",
  "How do I report phishing to my IT team?",
];

interface Message {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

function AssistantPage() {
  const { scanId } = useSearch({ from: "/_authenticated/assistant" });
  const queryClient = useQueryClient();
  const fetchHistory = useServerFn(getChatHistory);
  const send = useServerFn(sendChatMessage);
  const clear = useServerFn(clearChatHistory);
  const fetchScan = useServerFn(getScan);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");
  const [pendingUser, setPendingUser] = useState<string | null>(null);

  const { data: history = [], isLoading } = useQuery({
    queryKey: ["chat"],
    queryFn: () => fetchHistory(),
  });

  const { data: scan } = useQuery({
    queryKey: ["scan", scanId],
    queryFn: () => fetchScan({ data: { id: scanId! } }),
    enabled: Boolean(scanId),
  });

  const messages = useMemo(() => history as Message[], [history]);

  const mutation = useMutation({
    mutationFn: async (message: string) =>
      send({ data: { message, scanId: scanId ?? undefined } }),
    onSuccess: () => {
      setPendingUser(null);
      queryClient.invalidateQueries({ queryKey: ["chat"] });
    },
    onError: (error: Error) => {
      setPendingUser(null);
      toast.error(error.message);
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, pendingUser, mutation.isPending]);

  const submit = (text: string) => {
    const message = text.trim();
    if (!message || mutation.isPending) return;
    setDraft("");
    setPendingUser(message);
    mutation.mutate(message);
  };

  return (
    <AppShell
      title="AI Cybersecurity Assistant"
      description="Ask anything about phishing, email security and incident response."
      actions={
        messages.length > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await clear();
              queryClient.invalidateQueries({ queryKey: ["chat"] });
              toast.success("Conversation cleared");
            }}
          >
            <Trash2 className="size-4" />
            Clear
          </Button>
        ) : null
      }
    >
      <div className="mx-auto flex h-[calc(100vh-11rem)] max-w-3xl flex-col">
        {scan && (
          <div className="glass-panel mb-3 flex items-center gap-3 rounded-xl px-4 py-3">
            <Sparkles className="size-4 shrink-0 text-primary" />
            <p className="min-w-0 truncate text-sm">
              Grounded in scan:{" "}
              <span className="font-medium">{scan.subject || "(no subject)"}</span> · risk{" "}
              <span className="font-mono">{scan.risk_score}</span>
            </p>
          </div>
        )}

        <div className="glass-panel flex min-h-0 flex-1 flex-col rounded-2xl">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {isLoading && (
              <div className="flex justify-center py-8">
                <Loader2 className="size-5 animate-spin text-primary" />
              </div>
            )}

            {!isLoading && messages.length === 0 && !pendingUser && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary glow-ring">
                  <Bot className="size-6" />
                </span>
                <p className="mt-4 text-sm font-medium">Your security analyst is standing by</p>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  Ask about a suspicious message, a phishing technique or what to do after an
                  incident.
                </p>
                <div className="mt-5 grid w-full max-w-lg gap-2 sm:grid-cols-2">
                  {PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => submit(prompt)}
                      className="rounded-xl border border-border/60 px-3.5 py-3 text-left text-sm transition-colors hover:border-primary/50 hover:bg-primary/5"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => (
              <Bubble key={message.id} role={message.role} content={message.content} />
            ))}
            {pendingUser && <Bubble role="user" content={pendingUser} />}
            {mutation.isPending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-primary" />
                Analyzing…
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form
            className="flex items-end gap-2 border-t border-border/60 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit(draft);
            }}
          >
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit(draft);
                }
              }}
              rows={1}
              placeholder="Ask about phishing, a suspicious email, or next steps…"
              className="max-h-40 min-h-11 resize-none"
            />
            <Button type="submit" size="icon" disabled={mutation.isPending || !draft.trim()}>
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}

function Bubble({ role, content }: { role: string; content: string }) {
  const isUser = role === "user";
  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          isUser ? "bg-secondary text-secondary-foreground" : "bg-primary/15 text-primary",
        )}
      >
        {isUser ? <UserRound className="size-4" /> : <Bot className="size-4" />}
      </span>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-primary/12 text-foreground"
            : "border border-border/60 bg-card/60 text-foreground",
        )}
      >
        <MarkdownLite text={content} />
      </div>
    </div>
  );
}

/** Tiny markdown renderer: bold, inline code, bullets and headings. */
function MarkdownLite({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5">
      {lines.map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={index} className="h-1" />;
        if (/^#{1,4}\s/.test(trimmed)) {
          return (
            <p key={index} className="pt-1 text-sm font-semibold">
              {inline(trimmed.replace(/^#{1,4}\s/, ""))}
            </p>
          );
        }
        if (/^[-*]\s/.test(trimmed)) {
          return (
            <p key={index} className="flex gap-2 pl-1">
              <span className="mt-2 size-1 shrink-0 rounded-full bg-primary" />
              <span>{inline(trimmed.replace(/^[-*]\s/, ""))}</span>
            </p>
          );
        }
        if (/^\d+\.\s/.test(trimmed)) {
          return (
            <p key={index} className="pl-1">
              {inline(trimmed)}
            </p>
          );
        }
        return <p key={index}>{inline(trimmed)}</p>;
      })}
    </div>
  );
}

function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={index} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px]">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={index}>{part}</span>;
  });
}
